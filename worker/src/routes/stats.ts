import type { Env, Stats } from "../types";

export async function handleStats(request: Request, env: Env): Promise<Response> {
  const cache = caches.default;
  const url = new URL(request.url);
  url.searchParams.set("_v", env.CF_VERSION.id);
  const cacheKey = new Request(url.toString());

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const row = await env.DB.prepare(`
    SELECT
      COUNT(*) AS total_facilities,
      SUM(CASE WHEN latest_result = 'G' THEN 1 ELSE 0 END) AS status_g,
      SUM(CASE WHEN latest_result = 'Y' THEN 1 ELSE 0 END) AS status_y,
      SUM(CASE WHEN latest_result = 'R' THEN 1 ELSE 0 END) AS status_r
    FROM (
      SELECT b.business_id,
        (SELECT result FROM inspection
         WHERE business_id = b.business_id
         ORDER BY date DESC,
           CASE result WHEN 'G' THEN 0 WHEN 'Y' THEN 1 ELSE 2 END
         LIMIT 1
        ) AS latest_result
      FROM business b
      WHERE b.latitude IS NOT NULL AND b.longitude IS NOT NULL
    )
  `).first<{
    total_facilities: number;
    status_g: number;
    status_y: number;
    status_r: number;
  }>();

  if (!row) {
    return new Response(JSON.stringify({ error: "No data" }), { status: 500 });
  }

  const stats: Stats = {
    total_facilities: row.total_facilities,
    status_g: row.status_g,
    status_y: row.status_y,
    status_r: row.status_r,
  };

  const response = new Response(JSON.stringify(stats), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=21600",
    },
  });
  await cache.put(cacheKey, response.clone());
  return response;
}
