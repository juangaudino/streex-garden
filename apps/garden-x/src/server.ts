import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
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
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

/**
 * Gardenpedia is a public route. Its SSR manifest currently knows about the
 * authenticated Garden X route graph too, so TanStack can emit modulepreload
 * hints for private/heavy chunks that are not part of the public surface.
 * Avoid fetching that graph on a cold mobile visit; normal ES imports still
 * load every module when its React surface is actually entered.
 */
export function stripPublicGardenpediaModulepreloads(html: string): string {
  return html.replace(/<link\s+rel="modulepreload"[^>]*>\s*/g, "");
}

async function trimPublicGardenpediaPreloads(
  request: Request,
  response: Response,
): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  const contentType = response.headers.get("content-type") ?? "";
  if (
    response.status >= 500 ||
    !pathname.startsWith("/gardenpedia") ||
    !contentType.includes("text/html")
  ) {
    return response;
  }

  const body = await response.text();
  const trimmed = stripPublicGardenpediaModulepreloads(body);
  if (trimmed === body) return response;

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(trimmed, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      return await trimPublicGardenpediaPreloads(request, normalized);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
