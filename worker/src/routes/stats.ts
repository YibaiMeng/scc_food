import type { Env, Stats } from "../types";

export async function handleStats(request: Request, env: Env): Promise<Response> {
  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).toString());

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const row = await env.DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM business) AS total_facilities,
      (SELECT COUNT(*) FROM inspection) AS total_inspections,
      (SELECT ROUND(AVG(score), 2) FROM inspection WHERE score IS NOT NULL) AS avg_score,
      (SELECT COUNT(*) FROM inspection WHERE result = 'G') AS result_g,
      (SELECT COUNT(*) FROM inspection WHERE result = 'Y') AS result_y,
      (SELECT COUNT(*) FROM inspection WHERE result = 'R') AS result_r,
      (SELECT COUNT(*) FROM violation WHERE critical = 1) AS critical_violations
  `).first<{
    total_facilities: number;
    total_inspections: number;
    avg_score: number;
    result_g: number;
    result_y: number;
    result_r: number;
    critical_violations: number;
  }>();

  if (!row) {
    return new Response(JSON.stringify({ error: "No data" }), { status: 500 });
  }

  const stats: Stats = {
    total_facilities: row.total_facilities,
    total_inspections: row.total_inspections,
    avg_score: row.avg_score,
    result_distribution: { G: row.result_g, Y: row.result_y, R: row.result_r },
    critical_violations: row.critical_violations,
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
