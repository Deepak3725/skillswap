/* ==========================================================================
   SkillSwap — Notifications
   APIs: GET /api/notifications, POST /api/notifications/{id}/read,
         POST /api/notifications/read-all
   ========================================================================== */
(function () {
  "use strict";

  const esc = UI.escapeHtml;
  const box = document.getElementById("notifList");
  const readAllBtn = document.getElementById("readAllBtn");
  let items = [];
  let filter = UI.qs("filter") === "unread" ? "unread" : "all";

  function render() {
    const unread = items.filter(function (n) { return !n.isRead; }).length;
    document.querySelector('[data-filter-count="all"]').textContent = items.length;
    document.querySelector('[data-filter-count="unread"]').textContent = unread;
    document.getElementById("unreadSummary").textContent = unread
      ? "You have " + unread + " unread notification" + (unread === 1 ? "" : "s") + "."
      : "You're all caught up.";
    readAllBtn.disabled = unread === 0;
    App.setBadge("notifications", unread);
    document.querySelectorAll("[data-filter]").forEach(function (b) {
      const on = b.getAttribute("data-filter") === filter;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });

    const list = filter === "unread" ? items.filter(function (n) { return !n.isRead; }) : items;
    if (!list.length) {
      box.innerHTML = filter === "unread"
        ? UI.emptyState("bi-check2-all", "No unread notifications", "Everything has been read.")
        : UI.emptyState("bi-bell", "No notifications yet", "You'll be notified when someone sends you a request or responds to yours.");
      return;
    }
    box.innerHTML = list.map(function (n) {
      const meta = Components.notificationMeta(n.message);
      return '<div class="notif-item' + (n.isRead ? "" : " unread") + '" data-id="' + esc(n.notificationId) + '">' +
        '<span class="notif-icon" style="color:' + meta.color + ";background:" + meta.bg + '"><i class="bi ' + meta.icon + '"></i></span>' +
        '<div class="notif-body"><div class="notif-message">' + esc(n.message) + "</div>" +
        '<div class="notif-time" title="' + esc(UI.formatDate(n.createdAt, true)) + '">' + esc(UI.timeAgo(n.createdAt)) +
        (n.requestId ? " · Request #" + esc(n.requestId) : "") + "</div></div>" +
        '<div class="notif-actions">' +
        (meta.href ? '<a class="btn btn-light btn-sm" href="' + meta.href + '" data-open>View</a>' : "") +
        (n.isRead ? "" : '<button type="button" class="btn btn-outline-primary btn-sm" data-read><i class="bi bi-check2"></i>Mark read</button>') +
        "</div></div>";
    }).join("");
  }

  async function load() {
    box.innerHTML = UI.skeletonRows(4);
    try {
      items = await API.getNotifications();
      render();
    } catch (e) {
      UI.renderError(box, e, load);
    }
  }

  async function markRead(id) {
    await API.markNotificationRead(id);
    const n = items.find(function (x) { return String(x.notificationId) === String(id); });
    if (n) n.isRead = true;
  }

  box.addEventListener("click", async function (e) {
    const row = e.target.closest("[data-id]");
    if (!row) return;
    const id = row.getAttribute("data-id");
    const n = items.find(function (x) { return String(x.notificationId) === String(id); });

    const readBtn = e.target.closest("[data-read]");
    if (readBtn) {
      UI.setLoading(readBtn, true);
      try { await markRead(id); render(); } catch (err) { UI.setLoading(readBtn, false); UI.toast(err.message, "error"); }
      return;
    }
    // "View" marks the notification as read before navigating.
    const open = e.target.closest("[data-open]");
    if (open && n && !n.isRead) {
      e.preventDefault();
      try { await markRead(id); } catch (err) { /* navigation still useful */ }
      window.location.href = open.getAttribute("href");
    }
  });

  readAllBtn.addEventListener("click", async function () {
    UI.setLoading(readAllBtn, true, "Marking…");
    try {
      await API.markAllNotificationsRead();
      items = await API.getNotifications();
      UI.toast("All notifications marked as read.");
    } catch (err) {
      UI.toast(err.message, "error");
    } finally {
      UI.setLoading(readAllBtn, false);
      render();
    }
  });

  document.querySelectorAll("[data-filter]").forEach(function (b) {
    b.addEventListener("click", function () {
      filter = b.getAttribute("data-filter");
      const url = new URL(window.location.href);
      if (filter === "unread") url.searchParams.set("filter", "unread"); else url.searchParams.delete("filter");
      window.history.replaceState({}, "", url.pathname + url.search);
      render();
    });
  });

  App.ready.then(load);
})();
