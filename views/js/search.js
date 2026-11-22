/* ==========================================================================
   SkillSwap — Discover
   APIs:
     GET /api/search?skill=      people who teach OR want a skill (no score)
     GET /api/matches            every compatible member with a score,
                                 merge-sorted by the server (MatchSorter)
     GET /api/matches/top?limit= highest scores taken from the server's
                                 max-heap (MatchMaxHeap)
     GET /api/skills, GET /api/requests/sent (pending state on cards)

   Scores are only shown for people who appear in /api/matches. Search
   results that aren't matches are shown without a score. The page never
   calculates or sorts scores itself: ranked lists keep the order the
   server returned.
   ========================================================================== */
(function () {
  "use strict";

  const esc = UI.escapeHtml;
  let mySkills = { teachingSkills: [], learningSkills: [] };
  let pending = new Map();
  let lastResults = [];
  let lastSkill = "";
  let role = "all";
  let searchToken = 0;

  let matchesPromise = null;   // /api/matches (merge-sorted)
  let heapPromise = null;      // /api/matches/top covering every match (heap order)
  let matchRank = new Map();   // userId -> { rank, score } from /api/matches
  let heapOrder = [];          // userIds in heap-extraction order

  const results = document.getElementById("results");
  const matchesBox = document.getElementById("matches");
  const input = document.getElementById("searchInput");

  function updateUrl(params) {
    const url = new URL(window.location.href);
    url.search = "";
    Object.keys(params).forEach(function (k) { if (params[k]) url.searchParams.set(k, params[k]); });
    window.history.replaceState({}, "", url.pathname + url.search);
  }

  function context() {
    return {
      mySkills: mySkills,
      learnSkill: lastSkill,
      onSent: async function () {
        pending = await Components.getPendingTargets().catch(function () { return pending; });
        renderResults();
        matchesPromise && matchesPromise.then(renderMatches).catch(function () {});
      }
    };
  }

  // ---------- Backend rankings ----------
  function getMatches() {
    if (!matchesPromise) {
      matchesPromise = API.getMatches().then(function (list) {
        list = list || [];
        Components.remember(list);
        matchRank = new Map();
        list.forEach(function (u, i) { matchRank.set(Number(u.userId), { rank: i, score: u.compatibilityScore }); });
        document.getElementById("matchCount").textContent = list.length;
        return list;
      });
      matchesPromise.catch(function () { matchesPromise = null; });
    }
    return matchesPromise;
  }

  // Ask the heap for every match so we can pick the best ones for a skill.
  function getHeapOrder() {
    if (!heapPromise) {
      heapPromise = getMatches().then(function (list) {
        if (!list.length) return [];
        return API.getTopMatches(list.length).then(function (top) {
          heapOrder = (top || []).map(function (u) { return Number(u.userId); });
          return top || [];
        });
      });
      heapPromise.catch(function () { heapPromise = null; });
    }
    return heapPromise;
  }

  function scoreOf(userId) {
    const m = matchRank.get(Number(userId));
    return m ? m.score : undefined;
  }

  function rankCard(u, pos, score) {
    const teachesYou = (u.teachingSkills || []).filter(function (s) { return UI.hasSkill(mySkills.learningSkills, s); });
    return '<button type="button" class="rank-card" data-rank-user="' + esc(u.userId) + '">' +
      '<span class="rank-pos">#' + pos + "</span>" + UI.avatar(u, "avatar-md") +
      '<span class="min-w-0"><span class="d-block fw-semibold truncate">' + esc(u.name) + "</span>" +
      '<span class="rank-note d-block truncate">' + (teachesYou.length ? "Teaches " + esc(teachesYou.join(", ")) : "Two-way match") + "</span></span>" +
      '<span class="rank-score">' + Math.round(score) + "%</span></button>";
  }

  // ---------- Shortcuts ----------
  function renderShortcuts() {
    const box = document.getElementById("shortcuts");
    const group = function (title, icon, list, r, emptyMsg, anchor) {
      return '<div class="col-md-6"><div class="small-caps mb-2"><i class="bi ' + icon + ' me-1"></i>' + title + "</div>" +
        (list.length
          ? '<div class="chip-list">' + list.map(function (s) {
              return '<button type="button" class="chip chip-' + (r === "teachers" ? "learn" : "teach") + '" data-shortcut="' + esc(s) + '" data-shortcut-role="' + r + '"><span>' + esc(s) + "</span></button>";
            }).join("") + "</div>"
          : '<span class="hint">' + emptyMsg + ' <a href="/profile.html#' + anchor + '">Add skills</a></span>') + "</div>";
    };
    box.innerHTML =
      group("Find teachers for your goals", "bi-mortarboard", mySkills.learningSkills, "teachers", "No learning goals yet.", "learn") +
      group("Find learners for your skills", "bi-easel", mySkills.teachingSkills, "learners", "No teaching skills yet.", "teach");
  }

  function setRole(r) {
    role = r;
    document.querySelectorAll("#roleFilter button").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-role") === r); });
  }

  // ---------- Skill search ----------
  function renderSkillTop() {
    const box = document.getElementById("skillTop");
    if (!lastSkill || lastResults.length < 2) { box.innerHTML = ""; return; }
    const ids = new Set(lastResults.map(function (u) { return Number(u.userId); }));
    const top = heapOrder.filter(function (id) { return ids.has(id); }).slice(0, 3);
    if (!top.length) {
      box.innerHTML = '<div class="alert alert-light border d-flex gap-2 align-items-start mb-3 small"><i class="bi bi-info-circle text-primary"></i>' +
        "<div>None of the people with skills matching “" + esc(lastSkill) + "” are two-way matches for you yet, so there are no compatibility scores to rank them by.</div></div>";
      return;
    }
    box.innerHTML = '<div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">' +
      '<h2 class="section-title mb-0"><i class="bi bi-trophy text-warning"></i>Top recommendations for “' + esc(lastSkill) + "”</h2>" +
      '<span class="hint">Best compatibility first</span></div>' +
      '<div class="rank-strip mb-4">' + top.map(function (id, i) {
        return rankCard(Components.people.get(id) || lastResults.find(function (u) { return Number(u.userId) === id; }), i + 1, scoreOf(id));
      }).join("") + "</div>";
  }

  function card(u) {
    return '<div class="col-md-6 col-xl-4">' + Components.userCard(u, { mySkills: mySkills, score: scoreOf(u.userId), pending: pending.get(Number(u.userId)) }) + "</div>";
  }

  function renderResults() {
    if (!lastSkill) return;
    // Search is partial ("pyth" finds "Python"), so filter by the skills that contain the text.
    const term = lastSkill.toLowerCase();
    const has = function (list) { return (list || []).some(function (s) { return s.toLowerCase().indexOf(term) !== -1; }); };
    const teachers = lastResults.filter(function (u) { return has(u.teachingSkills); });
    const learners = lastResults.filter(function (u) { return has(u.learningSkills); });
    const list = role === "teachers" ? teachers : role === "learners" ? learners : lastResults;

    document.getElementById("resultsBar").hidden = false;
    document.getElementById("resultsTitle").innerHTML = 'All results for “' + esc(lastSkill) + '” <span class="count">' + lastResults.length + (lastResults.length === 1 ? " person" : " people") + "</span>";
    const btns = document.querySelectorAll("#roleFilter button");
    btns[0].textContent = "All (" + lastResults.length + ")";
    btns[1].textContent = "Can teach it (" + teachers.length + ")";
    btns[2].textContent = "Want to learn it (" + learners.length + ")";

    if (!lastResults.length) {
      results.innerHTML = '<div class="col-12"><div class="card">' + UI.emptyState("bi-search", "No one found for “" + lastSkill + "”",
        "No member has a skill containing that text yet. Try a shorter or more common word.") + "</div></div>";
      return;
    }
    if (!list.length) {
      results.innerHTML = '<div class="col-12"><div class="card">' + UI.emptyState("bi-funnel", "No one in this group",
        role === "teachers" ? "Nobody teaches “" + lastSkill + "” yet, but some people want to learn it." : "Nobody wants to learn “" + lastSkill + "” yet, but some people teach it.",
        '<button type="button" class="btn btn-light btn-sm" data-show-all>Show everyone</button>', true) + "</div></div>";
      return;
    }
    // Matches first, in the order /api/matches returned them; then everyone
    // else in the order /api/search returned them.
    const scored = list.filter(function (u) { return matchRank.has(Number(u.userId)); })
      .sort(function (a, b) { return matchRank.get(Number(a.userId)).rank - matchRank.get(Number(b.userId)).rank; });
    const rest = list.filter(function (u) { return !matchRank.has(Number(u.userId)); });

    let html = "";
    if (scored.length) {
      html += '<div class="col-12"><div class="result-group-title mt-0"><i class="bi bi-stars text-success"></i>Best compatibility · highest-ranked first</div></div>' + scored.map(card).join("");
    }
    if (rest.length) {
      html += '<div class="col-12"><div class="result-group-title' + (scored.length ? "" : " mt-0") + '"><i class="bi bi-people"></i>' +
        (scored.length ? "Other people with skills matching “" + esc(lastSkill) + "”" : "People with skills matching “" + esc(lastSkill) + "”") +
        ' <span class="text-lowercase fw-normal">· not two-way matches, so no score</span></div></div>' + rest.map(card).join("");
    }
    results.innerHTML = html;
  }

  async function runSearch(skill, r) {
    const value = String(skill || "").trim();
    if (!value) { input.focus(); UI.toast("Type a skill to search for.", "info"); return; }
    input.value = value;
    lastSkill = value;
    setRole(r || "all");
    updateUrl({ skill: value, role: r && r !== "all" ? r : "" });
    const token = ++searchToken;
    const btn = document.getElementById("searchBtn");
    UI.setLoading(btn, true, "Searching…");
    document.getElementById("resultsBar").hidden = true;
    document.getElementById("skillTop").innerHTML = "";
    results.innerHTML = UI.skeletonCards(3);
    try {
      const res = await Promise.all([API.search(value), getHeapOrder().catch(function () { return []; })]);
      if (token !== searchToken) return;
      lastResults = res[0] || [];
      Components.remember(lastResults);
      renderSkillTop();
      renderResults();
    } catch (e) {
      if (token !== searchToken) return;
      results.innerHTML = '<div class="col-12"><div class="card" data-err></div></div>';
      UI.renderError(results.querySelector("[data-err]"), e, function () { runSearch(value, r); });
    } finally {
      if (token === searchToken) UI.setLoading(btn, false);
    }
  }

  // ---------- Recommended matches ----------
  function renderMatches(list) {
    if (!list.length) {
      matchesBox.innerHTML = '<div class="col-12"><div class="card">' + UI.emptyState("bi-people", "No compatible matches yet",
        "A match is a two-way fit: they teach something you want, and want something you teach. Add more skills to widen your matches.",
        '<a class="btn btn-primary btn-sm" href="/profile.html#learn">Update my skills</a>') + "</div></div>";
      return;
    }
    matchesBox.innerHTML = list.map(function (u) {
      return '<div class="col-md-6 col-xl-4">' + Components.userCard(u, { mySkills: mySkills, score: u.compatibilityScore, pending: pending.get(Number(u.userId)) }) + "</div>";
    }).join("");
  }

  async function loadMatchesView() {
    const strip = document.getElementById("topStrip");
    matchesBox.innerHTML = UI.skeletonCards(3);
    strip.innerHTML = '<div class="hint">Loading…</div>';
    try {
      const res = await Promise.all([API.getTopMatches(3), getMatches()]);
      const top = res[0] || [];
      Components.remember(top);
      strip.innerHTML = top.length
        ? top.map(function (u, i) { return rankCard(u, i + 1, u.compatibilityScore); }).join("")
        : '<div class="hint">No recommendations yet. Add skills you teach and want to learn.</div>';
      renderMatches(res[1]);
    } catch (e) {
      strip.innerHTML = "";
      matchesBox.innerHTML = '<div class="col-12"><div class="card" data-err></div></div>';
      UI.renderError(matchesBox.querySelector("[data-err]"), e, loadMatchesView);
    }
  }

  let matchesViewLoaded = false;
  function showView(view) {
    document.querySelectorAll("[data-view]").forEach(function (b) {
      const on = b.getAttribute("data-view") === view;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    document.getElementById("searchView").hidden = view !== "search";
    document.getElementById("matchesView").hidden = view !== "matches";
    if (view === "matches") {
      updateUrl({ view: "matches" });
      if (!matchesViewLoaded) { matchesViewLoaded = true; loadMatchesView(); }
    } else if (lastSkill) {
      updateUrl({ skill: lastSkill, role: role !== "all" ? role : "" });
    } else {
      updateUrl({});
    }
  }

  // ---------- Events ----------
  document.querySelectorAll("[data-view]").forEach(function (b) {
    b.addEventListener("click", function () { showView(b.getAttribute("data-view")); });
  });
  document.getElementById("searchForm").addEventListener("submit", function (e) { e.preventDefault(); runSearch(input.value, "all"); });
  document.getElementById("shortcuts").addEventListener("click", function (e) {
    const b = e.target.closest("[data-shortcut]");
    if (b) runSearch(b.getAttribute("data-shortcut"), b.getAttribute("data-shortcut-role"));
  });
  document.getElementById("roleFilter").addEventListener("click", function (e) {
    const b = e.target.closest("[data-role]");
    if (!b) return;
    setRole(b.getAttribute("data-role"));
    updateUrl({ skill: lastSkill, role: role !== "all" ? role : "" });
    renderResults();
  });
  results.addEventListener("click", function (e) {
    if (e.target.closest("[data-show-all]")) { setRole("all"); renderResults(); }
  });
  // Ranked cards open the member's profile.
  document.getElementById("content").addEventListener("click", function (e) {
    const b = e.target.closest("[data-rank-user]");
    if (!b) return;
    const u = Components.people.get(Number(b.getAttribute("data-rank-user")));
    if (u) Components.openProfileModal(Object.assign({}, u, { compatibilityScore: scoreOf(u.userId) }), context());
  });
  Components.bindUserCards(results, context);
  Components.bindUserCards(matchesBox, context);

  App.ready.then(async function () {
    const loaded = await Promise.allSettled([Components.getMySkills(), Components.getPendingTargets()]);
    if (loaded[0].status === "fulfilled") mySkills = loaded[0].value;
    else UI.toast("Could not load your skills: " + loaded[0].reason.message, "error");
    if (loaded[1].status === "fulfilled") pending = loaded[1].value;
    renderShortcuts();

    getMatches().catch(function () {});

    const view = UI.qs("view");
    const skill = UI.qs("skill");
    if (view === "matches") {
      showView("matches");
    } else if (skill) {
      runSearch(skill, UI.qs("role") || "all");
    } else if (view === "learn" && mySkills.learningSkills.length) {
      runSearch(mySkills.learningSkills[0], "teachers");
    } else if (view === "teach" && mySkills.teachingSkills.length) {
      runSearch(mySkills.teachingSkills[0], "learners");
    } else {
      if (view === "learn" || view === "teach") {
        UI.toast(view === "learn" ? "Add a learning goal first so we know what to search for." : "Add a teaching skill first so we know what to search for.", "info");
      }
      results.innerHTML = '<div class="col-12"><div class="card">' + UI.emptyState("bi-compass", "Search for a skill to get started",
        "Type a skill above or pick one of your own skills to find teachers and learners.") + "</div></div>";
      input.focus();
    }
  });
})();
