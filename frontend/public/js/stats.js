let activeDropdown = null;

function closeDropdown() {
  if (activeDropdown) {
    activeDropdown.remove();
    activeDropdown = null;
  }
}

function setupBadgeDropdown(badge, facilities, resultCode, onSelect) {
  badge.addEventListener("click", (e) => {
    e.stopPropagation();

    // Toggle if already open
    if (activeDropdown && activeDropdown.parentElement === badge.parentElement) {
      closeDropdown();
      return;
    }
    closeDropdown();

    const matches = facilities.filter((f) => f.latest_result === resultCode);
    if (!matches.length) return;

    const dropdown = document.createElement("div");
    dropdown.className = "stat-dropdown";
    for (const f of matches) {
      const item = document.createElement("div");
      item.className = "stat-dropdown-item";
      item.textContent = f.name;
      item.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onSelect(f.business_id);
      });
      dropdown.appendChild(item);
    }
    badge.parentElement.appendChild(dropdown);
    activeDropdown = dropdown;
  });
}

document.addEventListener("click", closeDropdown);

export function renderStats(stats, facilities, onSelect) {
  document.getElementById("stat-facilities").textContent =
    `${stats.total_facilities.toLocaleString()} facilities`;

  const yellowBadge = document.getElementById("stat-yellow");
  yellowBadge.textContent = `${stats.status_y.toLocaleString()} yellow`;

  const redBadge = document.getElementById("stat-red");
  redBadge.textContent = `${stats.status_r.toLocaleString()} closed`;

  document.getElementById("stat-closures").textContent =
    `${stats.closures_past_year.toLocaleString()} closures past year`;

  if (facilities && onSelect) {
    setupBadgeDropdown(yellowBadge, facilities, "Y", onSelect);
    setupBadgeDropdown(redBadge, facilities, "R", onSelect);
  }
}
