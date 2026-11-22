/* ==========================================================================
   SkillSwap — Swap requests
   APIs: GET /api/requests/received, GET /api/requests/sent,
         GET /api/requests/next (head of the SwapRequestQueue),
         POST /api/requests/{id}/accept|reject|cancel|complete
   ========================================================================== */
(function () {
  "use strict";

  const esc = UI.escapeHtml;
  const list = document.getElementById("requestList");
  let me = null;
  let data = { received: [], sent: [] };
  let next = null;
  let tab = UI.qs("tab") === "sent" ? "sent" : "received";
  let status = (UI.qs("status") || "ALL").toUpperCase();

  // Pending first in queue order (oldest first), everything else newest first.
  function sortRequests(arr) {
    const pending = arr.filter(function (r) { return r.status === "PENDING"; });
    const rest = arr.filter(function (r) { return r.status !== "PENDING"; }).slice().reverse();
    return pending.concat(rest);
  }

  function renderSpotlight() {
    const box = document.getElementById("queueSpotlight");
    if (!next) { box.innerHTML = ""; return; }
    const partner = Components.people.get(Number(next.from && next.from.userId)) || { userId: next.from.userId, name: next.from.name };
    box.innerHTML = '<div class="spotlight">' + UI.avatar(partner, "avatar-lg") +
      '<div class="flex-grow-1 min-w-0"><div class="spotlight-tag"><i class="bi bi-sort-up"></i>Next in your queue</div>' +
      '<div class="fw-semibold mt-1">' + esc(next.from.name) + " wants to swap</div>" +
      '<div class="small text-secondary">' + (next.offeredSkill ? "They teach you <strong>" + esc(next.offeredSkill) + "</strong> · you teach them <strong>" + esc(next.requestedSkill) + "</strong>" : "They want to learn <strong>" + esc(next.requestedSkill) + "</strong> · nothing offered in return") + "</div></div>" +
      '<div class="d-flex gap-2" data-request-id="' + esc(next.requestId) + '">' +
      '<button class="btn btn-primary btn-sm" data-req-act="accept"><i class="bi bi-check-lg"></i>Accept</button>' +
      '<button class="btn btn-soft-danger btn-sm" data-req-act="reject"><i class="bi bi-x-lg"></i>Reject</button></div></div>';
  }

  function render() {
    document.querySelectorAll("[data-tab]").forEach(function (b) {
      const on = b.getAttribute("data-tab") === tab;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    document.querySelector('[data-tab-count="received"]').textContent = data.received.length;
    document.querySelector('[data-tab-count="sent"]').textContent = data.sent.length;

    const all = data[tab];
    document.querySelectorAll("#statusFilter button").forEach(function (b) {
      const s = b.getAttribute("data-status");
      const n = s === "ALL" ? all.length : all.filter(function (r) { return r.status === s; }).length;
      b.classList.toggle("active", s === status);
      b.textContent = b.textContent.replace(/\s*\(\d+\)$/, "") + (n ? " (" + n + ")" : "");
    });

    const filtered = sortRequests(status === "ALL" ? all : all.filter(function (r) { return r.status === status; }));
    if (!filtered.length) {
      const msg = !all.length
        ? (tab === "received" ? ["bi-inbox", "No requests received yet", "When someone wants to swap skills with you, their request will appear here."]
                              : ["bi-send", "You haven't sent any requests", "Find someone who teaches what you want to learn and send them a swap request."])
        : ["bi-funnel", "Nothing with this status", "Try a different filter."];
      list.innerHTML = '<div class="card">' + UI.emptyState(msg[0], msg[1], msg[2],
        tab === "sent" && !all.length ? '<a class="btn btn-primary btn-sm" href="/search.html"><i class="bi bi-search"></i>Discover people</a>' : "") + "</div>";
      return;
    }
    list.innerHTML = filtered.map(function (r) { return Components.requestCard(r, me.userId); }).join("");
  }

  function updateUrl() {
    const url = new URL(window.location.href);
    url.search = "";
    if (tab !== "received") url.searchParams.set("tab", tab);
    if (status !== "ALL") url.searchParams.set("status", status);
    window.history.replaceState({}, "", url.pathname + url.search);
  }

  async function load(showSkeleton) {
    if (showSkeleton) list.innerHTML = '<div class="card">' + UI.skeletonRows(3) + "</div>";
    try {
      const res = await Promise.all([API.getReceivedRequests(), API.getSentRequests(), API.getNextRequest()]);
      data.received = res[0] || [];
      data.sent = res[1] || [];
      next = res[2] && res[2].requestId ? res[2] : null;
      render();
      renderSpotlight();
      enrich();
      return data;
    } catch (e) {
      list.innerHTML = '<div class="card" data-err></div>';
      UI.renderError(list.querySelector("[data-err]"), e, function () { load(true); });
    }
  }

  // Fill in partner photos and contact details (GET /api/users/{id}).
  async function enrich() {
    const items = data.received.concat(data.sent).map(function (r) { return UI.perspective(r, me.userId); });
    const before = Components.people.size;
    await Components.resolvePeople(items);
    if (Components.people.size !== before) { render(); renderSpotlight(); }
  }

  document.querySelectorAll("[data-tab]").forEach(function (b) {
    b.addEventListener("click", function () { tab = b.getAttribute("data-tab"); status = "ALL"; updateUrl(); render(); });
  });
  document.getElementById("statusFilter").addEventListener("click", function (e) {
    const b = e.target.closest("[data-status]");
    if (!b) return;
    status = b.getAttribute("data-status");
    updateUrl();
    render();
  });
  document.getElementById("refreshBtn").addEventListener("click", async function () {
    UI.setLoading(this, true);
    await load(false);
    UI.setLoading(this, false);
  });

  const onDone = async function (act, id) {
    const fresh = await load(false);
    if (act === "complete" && fresh) Components.reportCompletion(fresh.received.concat(fresh.sent), id);
  };
  Components.bindRequestActions(list, onDone);
  Components.bindRequestActions(document.getElementById("queueSpotlight"), onDone);

  App.ready.then(function (user) {
    me = user;
    load(true);
  });
})();
