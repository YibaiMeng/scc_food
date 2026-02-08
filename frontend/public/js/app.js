import { fetchStats, fetchFacilities } from "./api.js";
import { renderStats } from "./stats.js";
import { initMap } from "./map.js";
import { show as showSidebar } from "./sidebar.js";

// Show loading overlay
const overlay = document.createElement("div");
overlay.id = "loading-overlay";
overlay.textContent = "Loading facilities…";
document.body.appendChild(overlay);

try {
  const [stats, facilities] = await Promise.all([fetchStats(), fetchFacilities()]);

  const map = initMap(facilities, showSidebar);

  renderStats(stats, facilities, (businessId) => {
    const f = facilities.find((fac) => fac.business_id === businessId);
    if (f) map.flyTo([f.latitude, f.longitude], 18);
    showSidebar(businessId);
  });
} catch (e) {
  overlay.textContent = "Failed to load data. Please refresh.";
  console.error(e);
  throw e;
} finally {
  overlay.remove();
}
