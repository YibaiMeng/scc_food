import type { Env, FacilityMarker } from "../types";

// Two years ago in YYYYMMDD format
function twoYearsAgo(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 2);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

export async function handleFacilities(request: Request, env: Env): Promise<Response> {
  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).toString());

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const cutoff = twoYearsAgo();

  const { results } = await env.DB.prepare(`
    SELECT
      b.business_id,
      b.name,
      b.latitude,
      b.longitude,
      b.address,
      b.city,
      b.postal_code,
      i.date        AS latest_date,
      i.score       AS latest_score,
      i.result      AS latest_result,
      (SELECT COUNT(*) FROM inspection i2 WHERE i2.business_id = b.business_id) AS inspection_count,
      (
        SELECT COUNT(*) FROM violation v
        JOIN inspection i3 ON v.inspection_id = i3.inspection_id
        WHERE i3.business_id = b.business_id AND v.critical = 1
      ) AS critical_violation_count,
      (
        SELECT EXISTS(
          SELECT 1 FROM inspection i4
          WHERE i4.business_id = b.business_id
            AND i4.result = 'R'
            AND i4.date >= ?
        )
      ) AS has_recent_red
    FROM business b
    LEFT JOIN inspection i ON i.inspection_id = (
      SELECT inspection_id FROM inspection
      WHERE business_id = b.business_id
      ORDER BY date DESC,
        CASE result WHEN 'G' THEN 0 WHEN 'Y' THEN 1 ELSE 2 END
      LIMIT 1
    )
    WHERE b.latitude IS NOT NULL
      AND b.longitude IS NOT NULL
  `).bind(cutoff).all<FacilityMarker>();

  const response = new Response(JSON.stringify(results), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
  await cache.put(cacheKey, response.clone());
  return response;
}
