import type { Env, FacilityDetail, InspectionWithViolations, Violation } from "../types";

export async function handleFacility(id: string, env: Env): Promise<Response> {
  const business = await env.DB.prepare(
    "SELECT * FROM business WHERE business_id = ?"
  ).bind(id).first();

  if (!business) {
    return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
  }

  const { results: inspections } = await env.DB.prepare(
    "SELECT * FROM inspection WHERE business_id = ? ORDER BY date DESC, CASE result WHEN 'G' THEN 0 WHEN 'Y' THEN 1 ELSE 2 END"
  ).bind(id).all<{
    inspection_id: string;
    date: string;
    score: number | null;
    result: string | null;
    type: string;
    inspection_comment: string | null;
  }>();

  const { results: violations } = await env.DB.prepare(`
    SELECT v.inspection_id, v.code, v.description, v.critical, v.violation_comment
    FROM violation v
    JOIN inspection i ON v.inspection_id = i.inspection_id
    WHERE i.business_id = ?
    ORDER BY i.date DESC, v.critical DESC, v.code
  `).bind(id).all<{
    inspection_id: string;
    code: string;
    description: string;
    critical: number;
    violation_comment: string | null;
  }>();

  // Group violations by inspection_id
  const violationsByInspection = new Map<string, Violation[]>();
  for (const v of violations) {
    const list = violationsByInspection.get(v.inspection_id) ?? [];
    list.push({
      code: v.code,
      description: v.description,
      critical: v.critical,
      violation_comment: v.violation_comment,
    });
    violationsByInspection.set(v.inspection_id, list);
  }

  const detail: FacilityDetail = {
    business: business as FacilityDetail["business"],
    inspections: inspections.map((insp): InspectionWithViolations => ({
      inspection_id: insp.inspection_id,
      date: insp.date,
      score: insp.score,
      result: insp.result,
      type: insp.type,
      inspection_comment: insp.inspection_comment,
      violations: violationsByInspection.get(insp.inspection_id) ?? [],
    })),
  };

  return new Response(JSON.stringify(detail), {
    headers: { "Content-Type": "application/json" },
  });
}
