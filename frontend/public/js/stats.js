export function renderStats(stats) {
  document.getElementById("stat-facilities").textContent =
    `${stats.total_facilities.toLocaleString()} facilities`;
  document.getElementById("stat-yellow").textContent =
    `${stats.status_y.toLocaleString()} yellow`;
  document.getElementById("stat-red").textContent =
    `${stats.status_r.toLocaleString()} closed`;
  document.getElementById("stat-closures").textContent =
    `${stats.closures_past_year.toLocaleString()} closures past year`;
}
