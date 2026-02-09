let activeDropdown = null;
let infoOpen = false;

function closeDropdown() {
  if (activeDropdown) {
    activeDropdown.remove();
    activeDropdown = null;
  }
  const panel = document.getElementById("info-panel");
  if (panel) {
    panel.style.display = "none";
    infoOpen = false;
  }
}

function showDropdown(badge, items, onSelect) {
  const dropdown = document.createElement("div");
  dropdown.className = "stat-dropdown";
  for (const f of items) {
    const item = document.createElement("div");
    item.className = "stat-dropdown-item";
    item.textContent = f.name;
    item.addEventListener("click", (ev) => {
      ev.stopPropagation();
      onSelect(f.business_id);
    });
    dropdown.appendChild(item);
  }
  badge.closest(".stat-badge-wrap").appendChild(dropdown);
  activeDropdown = dropdown;
}

function setupBadgeDropdown(badge, facilities, resultCode, onSelect) {
  badge.addEventListener("click", (e) => {
    e.stopPropagation();

    if (activeDropdown && activeDropdown.parentElement === badge.closest(".stat-badge-wrap")) {
      closeDropdown();
      return;
    }
    closeDropdown();

    const matches = facilities.filter((f) => f.latest_result === resultCode);
    if (!matches.length) return;

    showDropdown(badge, matches, onSelect);
  });
}

function cutoffDate(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function getClosures(facilities, days) {
  const cutoff = cutoffDate(days);
  return facilities.filter((f) => f.latest_red_date && f.latest_red_date >= cutoff);
}

function formatDate(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

document.addEventListener("click", closeDropdown);

// Info button toggle
const infoBtn = document.getElementById("info-btn");
const infoPanel = document.getElementById("info-panel");
if (infoBtn && infoPanel) {
  infoBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (infoOpen) {
      closeDropdown();
    } else {
      closeDropdown();
      infoPanel.style.display = "block";
      infoOpen = true;
    }
  });
  infoPanel.addEventListener("click", (e) => e.stopPropagation());
}

export function renderStats(stats, facilities, onSelect) {
  document.getElementById("stat-facilities").textContent = `${stats.total_facilities.toLocaleString()} facilities`;

  const yellowBadge = document.getElementById("stat-yellow");
  yellowBadge.textContent = `${stats.status_y.toLocaleString()} yellow`;

  const redBadge = document.getElementById("stat-red");
  redBadge.textContent = `${stats.status_r.toLocaleString()} closed`;

  // Populate freshness info (panel + header)
  const freshnessEl = document.getElementById("info-freshness");
  if (freshnessEl) {
    const lines = [];
    if (stats.source_updated_at) {
      lines.push(`<div class="info-freshness-row">County portal updated: ${formatDate(stats.source_updated_at)}</div>`);
    }
    if (stats.last_sync) {
      lines.push(`<div class="info-freshness-row">Synced to this site: ${formatDate(stats.last_sync)}</div>`);
    }
    if (lines.length) {
      freshnessEl.innerHTML = `<div class="info-heading">Data freshness</div>${lines.join("")}`;
    }
  }
  const headerFreshness = document.getElementById("stat-freshness");
  if (headerFreshness && stats.source_updated_at) {
    headerFreshness.textContent = `County data: ${formatDate(stats.source_updated_at)}`;
  }

  if (facilities && onSelect) {
    setupBadgeDropdown(yellowBadge, facilities, "Y", onSelect);
    setupBadgeDropdown(redBadge, facilities, "R", onSelect);

    // Closures with period selector
    const closuresBadge = document.getElementById("stat-closures");
    let activeDays = 365;

    function updateClosures() {
      const closures = getClosures(facilities, activeDays);
      closuresBadge.textContent = `${closures.length} closures`;
    }

    closuresBadge.addEventListener("click", (e) => {
      e.stopPropagation();
      const wrap = closuresBadge.closest(".stat-badge-wrap");
      if (activeDropdown && activeDropdown.parentElement === wrap) {
        closeDropdown();
        return;
      }
      closeDropdown();

      const closures = getClosures(facilities, activeDays);
      if (!closures.length) return;
      showDropdown(closuresBadge, closures, onSelect);
    });

    for (const chip of document.querySelectorAll("#closures-periods .period-chip")) {
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        activeDays = Number(chip.dataset.days);
        document
          .querySelectorAll("#closures-periods .period-chip")
          .forEach((c) => c.classList.toggle("active", c === chip));
        updateClosures();
        // Refresh dropdown if open
        const wrap = closuresBadge.closest(".stat-badge-wrap");
        if (activeDropdown && activeDropdown.parentElement === wrap) {
          closeDropdown();
          const closures = getClosures(facilities, activeDays);
          if (closures.length) showDropdown(closuresBadge, closures, onSelect);
        }
      });
    }

    updateClosures();
  }
}
