export function renderStats(stats) {
  document.getElementById("stat-facilities").textContent =
    `${stats.total_facilities.toLocaleString()} facilities`;
  document.getElementById("stat-avg-score").textContent =
    `avg score ${stats.avg_score}`;
  document.getElementById("stat-green").textContent =
    `G: ${stats.result_distribution.G.toLocaleString()}`;
  document.getElementById("stat-yellow").textContent =
    `Y: ${stats.result_distribution.Y.toLocaleString()}`;
  document.getElementById("stat-red").textContent =
    `R: ${stats.result_distribution.R.toLocaleString()}`;
}
