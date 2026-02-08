import type { Env } from "./types";
import { handleFacilities } from "./routes/facilities";
import { handleFacility } from "./routes/facility";
import { handleStats } from "./routes/stats";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, { status: response.status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const path = new URL(request.url).pathname;

    if (path === "/api/stats") {
      return withCors(await handleStats(request, env));
    } else if (path === "/api/facilities") {
      return withCors(await handleFacilities(request, env));
    } else if (path.startsWith("/api/facilities/")) {
      const id = path.slice("/api/facilities/".length);
      return withCors(await handleFacility(id, env));
    }

    return env.ASSETS.fetch(request);
  },
};
