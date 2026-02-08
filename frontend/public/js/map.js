import { show as showSidebar } from "./sidebar.js";

const RESULT_COLORS = {
  G: "#22c55e",
  Y: "#eab308",
  R: "#ef4444",
  null: "#9ca3af",
};

function markerColor(result) {
  return RESULT_COLORS[result] ?? RESULT_COLORS.null;
}

function createMarkerIcon(facility) {
  const color = markerColor(facility.latest_result);
  const pulse = facility.has_recent_red ? " map-marker-pulse" : "";
  const resultClass = facility.latest_result
    ? `map-marker-${facility.latest_result}`
    : "map-marker-null";
  return L.divIcon({
    className: "",
    html: `<div class="map-marker ${resultClass}${pulse}"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export function initMap(facilities, onMarkerClick) {
  const map = L.map("map", {
    center: [37.35, -121.9],
    zoom: 10,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  const cluster = L.markerClusterGroup({
    chunkedLoading: true,
    iconCreateFunction(group) {
      const markers = group.getAllChildMarkers();
      const hasR = markers.some((m) => m.options.result === "R");
      const hasY = markers.some((m) => m.options.result === "Y");
      const color = hasR ? "#ef4444" : hasY ? "#eab308" : "#22c55e";
      const count = group.getChildCount();
      return L.divIcon({
        className: "",
        html: `<div class="cluster-icon" style="background:${color}">${count}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
    },
  });

  for (const f of facilities) {
    const marker = L.marker([f.latitude, f.longitude], {
      icon: createMarkerIcon(f),
      result: f.latest_result,
      title: f.name,
    });
    marker.on("click", () => onMarkerClick(f.business_id));
    cluster.addLayer(marker);
  }

  map.addLayer(cluster);
  return map;
}
