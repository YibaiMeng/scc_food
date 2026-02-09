import { fetchFacility } from "./api.js";

const sidebar = document.getElementById("sidebar");
const content = document.getElementById("sidebar-content");
const closeBtn = document.getElementById("sidebar-close");

closeBtn.addEventListener("click", () => hide());

export function hide() {
  sidebar.classList.add("hidden");
}

export async function show(businessId) {
  sidebar.classList.remove("hidden");
  content.innerHTML = '<p style="color:#94a3b8;padding:8px 0">Loading…</p>';

  try {
    const detail = await fetchFacility(businessId);
    content.innerHTML = renderDetail(detail);
  } catch {
    content.innerHTML = `<p style="color:var(--red)">Failed to load details.</p>`;
  }
}

function formatDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length < 8) return yyyymmdd;
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  return `${y}-${m}-${d}`;
}

function daysSince(yyyymmdd) {
  if (!yyyymmdd) return null;
  const d = new Date(`${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`);
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  return diff;
}

function scoreClass(score) {
  if (score === null || score === undefined) return "";
  if (score >= 85) return "score-high";
  if (score >= 70) return "score-mid";
  return "score-low";
}

function resultChip(result) {
  const cls = result ? `result-${result}` : "result-unknown";
  const label = result || "?";
  return `<span class="result-chip ${cls}">${label}</span>`;
}

function renderViolations(violations) {
  if (!violations.length) return "";
  return `
    <div class="violations-list">
      ${violations
        .map(
          (v) => `
        <div class="violation-item">
          ${v.critical ? '<div class="violation-critical-dot"></div>' : '<div style="width:6px;flex-shrink:0"></div>'}
          <span class="violation-code">${v.code}</span>
          <span>${v.description}${v.violation_comment ? ` — <em>${v.violation_comment}</em>` : ""}</span>
        </div>
      `,
        )
        .join("")}
    </div>
  `;
}

function renderDetail(detail) {
  const { business, inspections } = detail;
  const latest = inspections[0];
  const days = latest ? daysSince(latest.date) : null;

  return `
    <div class="facility-name">${business.name}</div>
    <div class="facility-address">${business.address}, ${business.city}, ${business.state} ${business.postal_code}</div>
    ${business.phone_number ? `<div class="facility-phone">${business.phone_number}</div>` : ""}

    ${days !== null ? `<div style="font-size:12px;color:#64748b;margin-bottom:8px">Last inspected ${days} day${days === 1 ? "" : "s"} ago</div>` : ""}

    <div class="section-title">Inspection History (${inspections.length})</div>

    ${inspections
      .map(
        (insp) => `
      <div class="inspection-card">
        <div class="inspection-header">
          ${insp.score !== null ? `<span class="score-badge ${scoreClass(insp.score)}">${insp.score}</span>` : ""}
          ${resultChip(insp.result)}
          <span class="inspection-meta">${formatDate(insp.date)} · ${insp.type}</span>
        </div>
        ${insp.inspection_comment ? `<div class="inspection-comment">${insp.inspection_comment}</div>` : ""}
        ${renderViolations(insp.violations)}
      </div>
    `,
      )
      .join("")}
  `;
}
