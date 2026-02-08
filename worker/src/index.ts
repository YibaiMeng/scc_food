import type { Env } from "./types";
import { handleFacilities } from "./routes/facilities";
import { handleFacility } from "./routes/facility";
import { handleStats } from "./routes/stats";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    let response: Response;

    if (path === "/api/stats") {
      response = await handleStats(request, env);
    } else if (path === "/api/facilities") {
      response = await handleFacilities(request, env);
    } else if (path.startsWith("/api/facilities/")) {
      const id = path.slice("/api/facilities/".length);
      response = await handleFacility(id, env);
    } else {
      response = new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Attach CORS headers to all responses
    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      newHeaders.set(key, value);
    }
    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  },
};
