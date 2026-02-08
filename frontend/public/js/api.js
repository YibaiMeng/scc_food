// Replace with your Worker URL once deployed
const API_BASE = "https://scc-food-api.yibai.workers.dev/api";

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export async function fetchFacilities() {
  const res = await fetch(`${API_BASE}/facilities`);
  if (!res.ok) throw new Error("Failed to fetch facilities");
  return res.json();
}

export async function fetchFacility(id) {
  const res = await fetch(`${API_BASE}/facilities/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error("Failed to fetch facility");
  return res.json();
}
