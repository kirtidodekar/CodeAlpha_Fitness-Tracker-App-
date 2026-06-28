import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env?: unknown, ctx?: unknown) => Promise<Response> | Response;
};

type NodeRequest = {
  url?: string;
  method?: string;
  headers: Record<string, string | string[]>;
};

type NodeResponse = {
  statusCode?: number;
  setHeader: (name: string, value: string) => void;
  end: (data?: string | Uint8Array) => void;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

async function handleRequest(request: Request): Promise<Response> {
  if (new URL(request.url).pathname === "/favicon.ico") {
    return Response.redirect("/favicon.svg", 302);
  }

  try {
    const handler = await getServerEntry();
    if (typeof handler?.fetch !== "function") {
      throw new Error("The TanStack Start server entry did not expose a fetch handler.");
    }

    const response = await handler.fetch(request, undefined, undefined);
    return await normalizeCatastrophicSsrResponse(response);
  } catch (error) {
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
}

async function handleNodeRequest(req: NodeRequest, res: NodeResponse) {
  const host = (req.headers.host as string) || "localhost";
  const url = new URL(req.url ?? "/", `https://${host}`);
  const request = new Request(url.toString(), {
    method: req.method,
    headers: req.headers as HeadersInit,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : (req as BodyInit),
  });

  const response = await handleRequest(request);

  res.statusCode = response.status;
  response.headers.forEach((value, name) => {
    res.setHeader(name, value);
  });

  if (response.body) {
    const bodyBuffer = Buffer.from(await response.arrayBuffer());
    res.end(bodyBuffer);
  } else {
    res.end();
  }
}

const serverHandler = Object.assign(
  async function serverHandler(input: Request | NodeRequest, maybeRes?: NodeResponse) {
    if (input instanceof Request) {
      return handleRequest(input);
    }

    if (maybeRes) {
      return handleNodeRequest(input, maybeRes);
    }

    throw new TypeError("Expected a Request object or a Node request/response pair.");
  },
  {
    fetch: (request: Request) => handleRequest(request),
  },
);

export default serverHandler;
export { handleNodeRequest as handler };
