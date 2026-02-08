import { show as showSidebar } from "./sidebar.js";

const RESULT_COLORS = {
  G: "#22c55e",
  Y: "#eab308",
  R: "#ef4444",
  null: "#9ca3af",
};

const DETAIL_ZOOM = 16;

function markerColor(result) {
  return RESULT_COLORS[result] ?? RESULT_COLORS.null;
}

function tooltipContent(f) {
  const score =
    f.latest_score !== null ? `<strong>${f.latest_score}</strong>` : "—";
  const recentR = f.has_recent_red
    ? '<span class="tt-closure">Recent closure</span>'
    : "";
  return `<div class="tt-card"><div class="tt-name">${f.name}</div><div class="tt-row">Score: ${score}${recentR}</div></div>`;
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
  const SCC_BOUNDS = L.latLngBounds([36.85, -122.30], [37.50, -121.10]);

  const map = L.map("map", {
    center: [37.345, -121.983],
    zoom: 12,
    minZoom: 12,
    maxBounds: SCC_BOUNDS,
    maxBoundsViscosity: 1.0,
    zoomControl: false,
  });

  L.control.zoom({ position: "topright" }).addTo(map);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  // Canvas layer: fast overview, always holds all facilities
  const canvasRenderer = L.canvas();
  const canvasLayer = L.layerGroup();
  const canvasMarkers = [];

  function zoomRadius(zoom) {
    return Math.max(2, 0.5 * (zoom - 8));
  }

  for (const f of facilities) {
    const color = markerColor(f.latest_result);
    const cm = L.circleMarker([f.latitude, f.longitude], {
      renderer: canvasRenderer,
      radius: zoomRadius(map.getZoom()),
      color,
      fillColor: color,
      fillOpacity: 0.8,
      weight: 1,
    });
    cm.bindTooltip(tooltipContent(f), { className: "tt", direction: "top", offset: [0, -6] });
    cm.on("click", () => onMarkerClick(f.business_id));
    cm.addTo(canvasLayer);
    canvasMarkers.push(cm);
  }

  // Detail layer: CSS markers, viewport-culled, shown when zoomed in
  const detailLayer = L.layerGroup();
  let detailMode = false;

  function refresh() {
    const zoom = map.getZoom();
    const wantDetail = zoom >= DETAIL_ZOOM;

    if (!wantDetail) {
      const r = zoomRadius(zoom);
      for (const cm of canvasMarkers) cm.setRadius(r);
    }

    if (wantDetail !== detailMode) {
      detailMode = wantDetail;
      if (wantDetail) {
        map.removeLayer(canvasLayer);
        map.addLayer(detailLayer);
      } else {
        map.removeLayer(detailLayer);
        map.addLayer(canvasLayer);
      }
    }

    if (detailMode) {
      detailLayer.clearLayers();
      const bounds = map.getBounds();
      for (const f of facilities) {
        if (!bounds.contains([f.latitude, f.longitude])) continue;
        const marker = L.marker([f.latitude, f.longitude], {
          icon: createMarkerIcon(f),
          title: f.name,
        });
        marker.bindTooltip(tooltipContent(f), { className: "tt", direction: "top", offset: [0, -10] });
        marker.on("click", () => onMarkerClick(f.business_id));
        marker.addTo(detailLayer);
      }
    }
  }

  canvasLayer.addTo(map);
  map.on("zoomend moveend", refresh);

  return map;
}
