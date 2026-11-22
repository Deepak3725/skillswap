/* ==========================================================================
   SkillSwap — Dashboard
   APIs: /api/skills, /api/matches/top?limit=4 (MatchMaxHeap),
         /api/matches (count), /api/requests/sent, /api/requests/received,
         /api/requests/next (SwapRequestQueue head), /api/notifications
   ========================================================================== */
(function () {
  "use strict";

  const esc = UI.escapeHtml;
  let me = null;
  let mySkills = { teachingSkills: [], learningSkills: [] };
  let pendingTargets = new Map();

  function greeting() {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  }

  function setStat(name, value) {
    const el = document.querySelector('[data-stat="' + name + '"]');
    if (el) el.textContent = value;
  }

  function renderWelcome() {
    document.getElementById("welcomeAvatar").innerHTML = UI.avatar(me, "avatar-lg");
    const first = String(me.name || "").split(/\s+/)[0];
    document.getElementById("welcomeTitle").textContent = (UI.qs("welcome") ? "Welcome to SkillSwap, " : greeting() + ", ") + first;
  }

  function renderSkills() {
    setStat("teach", mySkills.teachingSkills.length);
    setStat("learn", mySkills.learningSkills.length);
    document.getElementById("mySkills").innerHTML =
      '<div class="mb-3"><div class="user-card-section-label">I can teach</div>' + UI.chipList(mySkills.teachingSkills, "teach", null, "Nothing yet") + "</div>" +
      '<div><div class="user-card-section-label">I want to learn</div>' + UI.chipList(mySkills.learningSkills, "learn", null, "Nothing yet") + "</div>";

    // Getting-started checklist built from the real profile state.
    const steps = [
      { done: !!UI.safeImageSrc(me.profilePicture) || !!me.bio, text: "Add a photo or bio", href: "/profile.html" },
      { done: mySkills.teachingSkills.length > 0, text: "Add a skill you can teach", href: "/profile.html#teach" },
      { done: mySkills.learningSkills.length > 0, text: "Add a skill you want to learn", href: "/profile.html#learn" }
    ];
    const box = document.getElementById("onboarding");
    if (steps.every(function (s) { return s.done; })) { box.innerHTML = ""; return; }
    box.innerHTML = '<section class="card mb-4"><div class="card-body d-flex flex-wrap gap-4 align-items-center">' +
      '<div style="flex:1 1 260px"><h2 class="h6 mb-1">Complete your profile to get matched</h2><p class="hint mb-0">Matches are calculated from what you teach and what you want to learn.</p></div>' +
      '<div style="flex:1 1 260px">' + steps.map(function (s) {
        return '<div class="checklist-item' + (s.done ? " done" : "") + '"><i class="bi ' + (s.done ? "bi-check-circle-fill" : "bi-circle") + '"></i>' +
          (s.done ? esc(s.text) : '<a href="' + s.href + '">' + esc(s.text) + "</a>") + "</div>";
      }).join("") + "</div></div></section>";
  }

  async function loadTopMatches() {
    const box = document.getElementById("topMatches");
    box.innerHTML = UI.skeletonCards(2, "col-md-6");
    try {
      const matches = await API.getTopMatches(4);
      Components.remember(matches);
      if (!matches.length) {
        box.innerHTML = '<div class="col-12">' + UI.emptyState("bi-people", "No matches yet",
          mySkills.teachingSkills.length && mySkills.learningSkills.length
            ? "Nobody currently teaches what you want while wanting what you teach. Try searching for a skill instead."
            : "Add skills you teach and skills you want to learn — matches need both.",
          '<a class="btn btn-primary btn-sm" href="' + (mySkills.teachingSkills.length && mySkills.learningSkills.length ? "/search.html" : "/profile.html#skills") + '">' +
          (mySkills.teachingSkills.length && mySkills.learningSkills.length ? "Search skills" : "Add skills") + "</a>", true) + "</div>";
        return;
      }
      box.innerHTML = matches.map(function (u) {
        return '<div class="col-md-6">' + Components.userCard(u, { mySkills: mySkills, score: u.compatibilityScore, pending: pendingTargets.get(Number(u.userId)) }) + "</div>";
      }).join("");
    } catch (e) {
      UI.renderError(box, e, loadTopMatches, true);
    }
  }

  async function loadMatchCount() {
    try {
      const all = await API.getMatches();
      setStat("matches", all.length);
    } catch (e) {
      setStat("matches", "—");
    }
  }

  function pendingRow(r, isNext) {
    return '<div class="list-row" data-request="' + esc(r.requestId) + '">' +
      UI.avatar({ userId: r.senderId, name: r.senderName, profilePicture: (Components.people.get(Number(r.senderId)) || {}).profilePicture }, "avatar-sm") +
      '<div class="list-row-main"><div class="list-row-title">' + esc(r.senderName) +
      (isNext ? ' <span class="badge text-bg-primary ms-1" title="Head of your request queue">Next</span>' : "") + "</div>" +
      '<div class="list-row-sub truncate">' + (r.offeredSkill ? "Teaches you <strong>" + esc(r.offeredSkill) + "</strong> · wants <strong>" : "Wants to learn <strong>") + esc(r.requestedSkill) + "</strong>" + (r.offeredSkill ? "" : " · nothing offered in return") + "</div></div>" +
      '<div class="d-flex gap-1"><button class="btn btn-soft-success btn-icon btn-sm" data-act="accept" title="Accept" aria-label="Accept request from ' + esc(r.senderName) + '"><i class="bi bi-check-lg"></i></button>' +
      '<button class="btn btn-soft-danger btn-icon btn-sm" data-act="reject" title="Reject" aria-label="Reject request from ' + esc(r.senderName) + '"><i class="bi bi-x-lg"></i></button></div></div>';
  }

  async function loadRequests() {
    const box = document.getElementById("pendingList");
    box.innerHTML = UI.skeletonRows(2);
    try {
      const results = await Promise.all([API.getSentRequests(), API.getReceivedRequests(), API.getNextRequest()]);
      const sent = results[0] || [];
      const received = results[1] || [];
      const next = results[2] && results[2].requestId ? results[2] : null;

      const completed = sent.concat(received).filter(function (r) { return r.status === "COMPLETED"; }).length;
      setStat("completed", completed);

      pendingTargets = new Map();
      sent.forEach(function (r) { if (r.status === "PENDING") pendingTargets.set(Number(r.receiverId), r); });

      // Received requests arrive oldest-first, the same order as the backend queue.
      const pending = received.filter(function (r) { return r.status === "PENDING"; });
      document.getElementById("pendingHint").textContent = pending.length
        ? pending.length + " pending · oldest first (queue order)" : "Incoming requests, oldest first";

      if (!pending.length) {
        box.innerHTML = UI.emptyState("bi-inbox", "You're all caught up", "New swap requests will appear here.", "", true);
        return;
      }
      box.innerHTML = pending.slice(0, 4).map(function (r) { return pendingRow(r, next && next.requestId === r.requestId); }).join("") +
        (pending.length > 4 ? '<div class="p-3 text-center"><a href="/swap-requests.html" class="small fw-semibold">View all ' + pending.length + " pending requests</a></div>" : "");
    } catch (e) {
      UI.renderError(box, e, loadRequests, true);
    }
  }

  async function loadActivity() {
    const box = document.getElementById("activity");
    box.innerHTML = UI.skeletonRows(3);
    try {
      const items = (await API.getNotifications()).slice(0, 5);
      if (!items.length) {
        box.innerHTML = UI.emptyState("bi-bell", "No activity yet", "Updates about your swaps will show up here.", "", true);
        return;
      }
      box.innerHTML = items.map(function (n) {
        const meta = Components.notificationMeta(n.message);
        return '<a class="list-row text-reset" href="' + (meta.href || "/notifications.html") + '">' +
          '<span class="notif-icon" style="width:34px;height:34px;font-size:.95rem;color:' + meta.color + ";background:" + meta.bg + '"><i class="bi ' + meta.icon + '"></i></span>' +
          '<div class="list-row-main"><div class="small' + (n.isRead ? "" : " fw-semibold") + '">' + esc(n.message) + '</div><div class="list-row-sub">' + esc(UI.timeAgo(n.createdAt)) + "</div></div>" +
          (n.isRead ? "" : '<span class="unread-dot" title="Unread"></span>') + "</a>";
      }).join("");
    } catch (e) {
      UI.renderError(box, e, loadActivity, true);
    }
  }

  // Accept / reject directly from the dashboard.
  document.getElementById("pendingList").addEventListener("click", async function (e) {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const row = btn.closest("[data-request]");
    const id = row.getAttribute("data-request");
    const act = btn.getAttribute("data-act");
    if (act === "reject") {
      const ok = await UI.confirmDialog({ title: "Reject this request?", message: "The sender will be notified that you declined.", confirmText: "Reject", danger: true });
      if (!ok) return;
    }
    row.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
    UI.setLoading(btn, true);
    try {
      const res = act === "accept" ? await API.acceptRequest(id) : await API.rejectRequest(id);
      UI.toast(res.message || "Done.");
      loadRequests();
      loadActivity();
      App.refreshBadges();
    } catch (err) {
      UI.toast(err.message, "error");
      loadRequests();
    }
  });

  App.ready.then(async function (user) {
    me = user;
    renderWelcome();
    Components.bindUserCards(document.getElementById("topMatches"), function () {
      return { mySkills: mySkills, onSent: function () { loadRequests().then(loadTopMatches); } };
    });
    try {
      mySkills = await Components.getMySkills();
    } catch (e) {
      UI.toast("Could not load your skills: " + e.message, "error");
    }
    renderSkills();
    await loadRequests();
    loadTopMatches();
    loadMatchCount();
    loadActivity();
  });
})();
