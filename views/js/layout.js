/* ==========================================================================
   SkillSwap — App shell (sidebar, top bar, session guard, badges)
   Every signed-in page includes this file. Pages wait for App.ready, which
   resolves with the logged-in user from GET /api/me.
   ========================================================================== */
(function () {
  "use strict";

  const esc = UI.escapeHtml;

  const NAV = [
    { section: "Workspace" },
    { key: "dashboard", href: "/dashboard.html", icon: "bi-grid-1x2", label: "Dashboard" },
    { key: "search", href: "/search.html", icon: "bi-compass", label: "Discover" },
    { key: "requests", href: "/swap-requests.html", icon: "bi-arrow-left-right", label: "Swap Requests", badge: "requests" },
    { key: "swaps", href: "/my-swaps.html", icon: "bi-patch-check", label: "My Swaps" },
    { key: "graph", href: "/learning-graph.html", icon: "bi-diagram-3", label: "Learning Graph" },
    { section: "Account" },
    { key: "notifications", href: "/notifications.html", icon: "bi-bell", label: "Notifications", badge: "notifications" },
    { key: "profile", href: "/profile.html", icon: "bi-person-circle", label: "Profile" }
  ];

  let currentUser = null;
  let redirecting = false;

  // Called by API on any 401 from a protected endpoint.
  window.SkillSwapAuth = {
    handleUnauthorized: function () {
      if (redirecting) return;
      redirecting = true;
      const next = window.location.pathname + window.location.search;
      window.location.replace("/index.html?next=" + encodeURIComponent(next) + "&expired=1");
    }
  };

  function buildShell() {
    const page = document.body.getAttribute("data-page");
    const content = document.getElementById("content");

    const loader = document.createElement("div");
    loader.className = "page-loader";
    loader.innerHTML = '<div class="text-center"><div class="spinner-border text-primary" role="status"></div><div class="mt-3 text-secondary small">Loading SkillSwap…</div></div>';

    const shell = document.createElement("div");
    shell.className = "app-shell";

    const navHtml = NAV.map(function (item) {
      if (item.section) return '<div class="sidebar-section">' + esc(item.section) + "</div>";
      const active = item.key === page;
      return '<a class="sidebar-link' + (active ? " active" : "") + '" href="' + item.href + '"' + (active ? ' aria-current="page"' : "") + ">" +
        '<i class="bi ' + item.icon + (active ? "-fill" : "") + '"></i><span>' + esc(item.label) + "</span>" +
        (item.badge ? '<span class="nav-badge" data-badge="' + item.badge + '" hidden></span>' : "") + "</a>";
    }).join("");

    shell.innerHTML =
      '<aside class="sidebar" id="sidebar" aria-label="Main navigation">' +
        '<div class="sidebar-brand"><a class="brand" href="/dashboard.html"><span class="brand-mark"><i class="bi bi-arrow-left-right"></i></span>SkillSwap</a>' +
        '<button type="button" class="sidebar-close" id="sidebarClose" aria-label="Close menu"><i class="bi bi-x-lg"></i></button></div>' +
        '<nav class="sidebar-nav">' + navHtml + "</nav>" +
        '<div class="sidebar-footer"><div class="sidebar-user" id="sidebarUser"></div></div>' +
      "</aside>" +
      '<div class="sidebar-backdrop" id="sidebarBackdrop"></div>' +
      '<div class="app-main">' +
        '<header class="topbar">' +
          '<button type="button" class="btn btn-light btn-icon topbar-menu" id="sidebarOpen" aria-label="Open menu"><i class="bi bi-list"></i></button>' +
          '<form class="topbar-search" id="topbarSearch" role="search">' +
            '<div class="input-icon"><i class="bi bi-search"></i>' +
            '<input class="form-control" type="search" name="skill" placeholder="Search a skill, e.g. Python" aria-label="Search skills" maxlength="100"></div>' +
          "</form>" +
          '<div class="topbar-actions">' +
            '<a class="btn btn-light btn-icon topbar-bell" href="/notifications.html" aria-label="Notifications"><i class="bi bi-bell"></i><span class="nav-badge" data-badge="notifications" hidden></span></a>' +
            '<div class="dropdown">' +
              '<button class="topbar-user" type="button" data-bs-toggle="dropdown" aria-expanded="false" id="topbarUser"></button>' +
              '<ul class="dropdown-menu dropdown-menu-end">' +
                '<li><a class="dropdown-item" href="/profile.html"><i class="bi bi-person"></i>My profile</a></li>' +
                '<li><a class="dropdown-item" href="/my-swaps.html"><i class="bi bi-patch-check"></i>My swaps</a></li>' +
                '<li><hr class="dropdown-divider"></li>' +
                '<li><button class="dropdown-item text-danger" type="button" data-logout><i class="bi bi-box-arrow-right"></i>Log out</button></li>' +
              "</ul></div>" +
          "</div>" +
        "</header>" +
      "</div>";

    document.body.insertBefore(loader, document.body.firstChild);
    document.body.insertBefore(shell, loader.nextSibling);
    shell.querySelector(".app-main").appendChild(content);

    // Mobile sidebar
    const sidebar = shell.querySelector("#sidebar");
    const backdrop = shell.querySelector("#sidebarBackdrop");
    const open = function () { sidebar.classList.add("open"); backdrop.classList.add("show"); };
    const close = function () { sidebar.classList.remove("open"); backdrop.classList.remove("show"); };
    shell.querySelector("#sidebarOpen").addEventListener("click", open);
    shell.querySelector("#sidebarClose").addEventListener("click", close);
    backdrop.addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

    // Top bar search -> live suggestions, Enter -> Discover page
    const form = shell.querySelector("#topbarSearch");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const value = this.skill.value.trim();
      if (!value) return;
      window.location.href = "/search.html?skill=" + encodeURIComponent(value);
    });
    initSuggestions(form);
  }

  // ---------- Global skill search suggestions ----------
  // People: GET /api/search?skill= (partial, case-insensitive skill match).
  // Scores: only for people who are in GET /api/matches; they are listed
  // first, in the order the server ranked them. Skill names to suggest come
  // from your own skills and your matches' skills.
  function initSuggestions(form) {
    const input = form.skill;
    const pop = document.createElement("div");
    pop.className = "search-pop";
    pop.id = "searchPop";
    pop.hidden = true;
    form.appendChild(pop);
    input.setAttribute("autocomplete", "off");
    input.setAttribute("aria-controls", "searchPop");
    input.setAttribute("aria-expanded", "false");

    let vocab = null;
    let ranks = new Map();
    let timer = null;
    let token = 0;
    let people = [];
    let active = -1;
    let lastQuery = "";

    function loadVocab() {
      if (!vocab) {
        vocab = Promise.allSettled([API.getMatches(), API.getSkills()]).then(function (r) {
          const list = new Map();
          const add = function (s) { if (s && !list.has(UI.norm(s))) list.set(UI.norm(s), s); };
          if (r[0].status === "fulfilled") {
            (r[0].value || []).forEach(function (u, i) {
              ranks.set(Number(u.userId), { rank: i, score: u.compatibilityScore });
              (u.teachingSkills || []).forEach(add);
              (u.learningSkills || []).forEach(add);
            });
            if (window.Components) Components.remember(r[0].value);
          }
          if (r[1].status === "fulfilled") {
            (r[1].value.teachingSkills || []).forEach(add);
            (r[1].value.learningSkills || []).forEach(add);
          }
          return Array.from(list.values()).sort(function (a, b) { return a.localeCompare(b); });
        });
      }
      return vocab;
    }

    function close() {
      pop.hidden = true;
      active = -1;
      input.setAttribute("aria-expanded", "false");
    }

    function show(html) {
      pop.innerHTML = html;
      pop.hidden = false;
      active = -1;
      input.setAttribute("aria-expanded", "true");
    }

    function personItem(u, i, q) {
      const r = ranks.get(Number(u.userId));
      // Search is partial: describe the skills that actually matched.
      const t = q.toLowerCase();
      const teaches = (u.teachingSkills || []).filter(function (s) { return s.toLowerCase().indexOf(t) !== -1; });
      const wants = (u.learningSkills || []).filter(function (s) { return s.toLowerCase().indexOf(t) !== -1; });
      const meta = [teaches.length ? "Teaches " + teaches.join(", ") : "", wants.length ? "Wants to learn " + wants.join(", ") : ""].filter(Boolean).join(" · ");
      return '<button type="button" class="sp-item" data-sp-person="' + i + '">' + UI.avatar(u, "avatar-sm") +
        '<span class="min-w-0"><span class="d-block fw-semibold truncate">' + esc(u.name) + '</span><span class="sp-meta d-block truncate">' + esc(meta) + "</span></span>" +
        (r ? '<span class="sp-score" title="Compatibility score">' + Math.round(r.score) + "%</span>" : '<span class="sp-noscore">No match score</span>') +
        "</button>";
    }

    async function render(q) {
      const my = ++token;
      lastQuery = q;
      const words = await loadVocab();
      const lower = q.toLowerCase();
      let found = [];
      try { found = await API.search(q); } catch (e) { found = []; }
      if (my !== token) return;
      // Matching skill names: the skills the server reported as matched,
      // plus your own and your matches' skills that contain the text.
      const skillMap = new Map();
      // Same skill typed differently ("python" / "Python"): prefer a capitalised spelling.
      const addSkill = function (s) { const k = UI.norm(s), cur = skillMap.get(k); if (!cur || (cur === cur.toLowerCase() && s !== s.toLowerCase())) skillMap.set(k, s); };
      found.forEach(function (u) { (u.matchedSkills || []).forEach(addSkill); });
      words.forEach(function (s) { if (s.toLowerCase().indexOf(lower) !== -1 && !skillMap.has(UI.norm(s))) skillMap.set(UI.norm(s), s); });
      const skills = Array.from(skillMap.values()).filter(function (s) { return s.toLowerCase() !== lower; })
        .sort(function (a, b) { return (b.toLowerCase().indexOf(lower) === 0) - (a.toLowerCase().indexOf(lower) === 0) || a.localeCompare(b); }).slice(0, 6);
      if (window.Components) Components.remember(found);
      const scored = found.filter(function (u) { return ranks.has(Number(u.userId)); })
        .sort(function (a, b) { return ranks.get(Number(a.userId)).rank - ranks.get(Number(b.userId)).rank; });
      const rest = found.filter(function (u) { return !ranks.has(Number(u.userId)); });
      people = scored.concat(rest).slice(0, 5);

      let html = "";
      if (people.length) {
        html += '<div class="sp-section"><div class="sp-title"><span>People with skills matching “' + esc(q) + '”</span><span class="sp-src">' + (scored.length ? "Best compatibility first" : "") + "</span></div>" +
          people.map(function (u, i) { return personItem(u, i, q); }).join("") + "</div>";
      }
      if (skills.length) {
        html += '<div class="sp-section"><div class="sp-title"><span>Matching skills</span></div>' + skills.map(function (s) {
          return '<button type="button" class="sp-item" data-sp-skill="' + esc(s) + '"><span class="sp-skill-icon"><i class="bi bi-hash"></i></span><span class="truncate">' + esc(s) + "</span></button>";
        }).join("") + "</div>";
      }
      if (!html) html = '<div class="sp-empty">No skills match “' + esc(q) + '” yet.</div>';
      html += '<a class="sp-footer text-decoration-none" href="/search.html?skill=' + encodeURIComponent(q) + '"><span>See all results for “' + esc(q) + '”</span><span class="kbd">Enter</span></a>';
      show(html);
    }

    input.addEventListener("focus", function () { loadVocab(); if (input.value.trim().length >= 2 && pop.innerHTML && lastQuery === input.value.trim()) { pop.hidden = false; } });
    input.addEventListener("input", function () {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) { token++; close(); return; }
      timer = setTimeout(function () { render(q); }, 250);
    });
    input.addEventListener("keydown", function (e) {
      const items = Array.from(pop.querySelectorAll(".sp-item"));
      if (e.key === "Escape") { close(); return; }
      if (pop.hidden || !items.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        active = (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items.forEach(function (it, i) { it.classList.toggle("is-active", i === active); });
        items[active].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && active >= 0) {
        e.preventDefault();
        items[active].click();
      }
    });
    pop.addEventListener("click", async function (e) {
      const skill = e.target.closest("[data-sp-skill]");
      if (skill) {
        input.value = skill.getAttribute("data-sp-skill");
        input.focus();
        render(input.value);
        return;
      }
      const person = e.target.closest("[data-sp-person]");
      if (person && window.Components) {
        const u = people[Number(person.getAttribute("data-sp-person"))];
        const r = ranks.get(Number(u.userId));
        close();
        const my = await Components.getMySkills().catch(function () { return null; });
        Components.openProfileModal(Object.assign({}, u, r ? { compatibilityScore: r.score } : {}), { mySkills: my, learnSkill: lastQuery });
      }
    });
    document.addEventListener("click", function (e) { if (!form.contains(e.target)) close(); });
  }

  function renderUser(user) {
    const sidebarUser = document.getElementById("sidebarUser");
    const topbarUser = document.getElementById("topbarUser");
    if (sidebarUser) {
      sidebarUser.innerHTML = UI.avatar(user, "avatar-sm") +
        '<div class="min-w-0"><div class="sidebar-user-name truncate">' + esc(user.name) + '</div><div class="sidebar-user-email truncate">' + esc(user.email) + "</div></div>" +
        '<button type="button" class="sidebar-logout" data-logout title="Log out" aria-label="Log out"><i class="bi bi-box-arrow-right"></i></button>';
    }
    if (topbarUser) {
      topbarUser.innerHTML = UI.avatar(user, "avatar-sm") + '<span class="topbar-user-name">' + esc(user.name) + '</span><i class="bi bi-chevron-down small text-muted"></i>';
    }
  }

  function setBadge(name, count) {
    document.querySelectorAll('[data-badge="' + name + '"]').forEach(function (el) {
      el.textContent = count > 99 ? "99+" : String(count);
      el.hidden = !(count > 0);
    });
  }

  // Badge counts come straight from the backend:
  //   notifications -> unread items of GET /api/notifications
  //   requests      -> PENDING items of GET /api/requests/received
  async function refreshBadges() {
    const results = await Promise.allSettled([API.getNotifications(), API.getReceivedRequests()]);
    if (results[0].status === "fulfilled" && Array.isArray(results[0].value)) {
      setBadge("notifications", results[0].value.filter(function (n) { return !n.isRead; }).length);
    }
    if (results[1].status === "fulfilled" && Array.isArray(results[1].value)) {
      setBadge("requests", results[1].value.filter(function (r) { return r.status === "PENDING"; }).length);
    }
    return results;
  }

  async function logout() {
    try {
      await API.logout();
    } catch (e) {
      // The session cookie is cleared by the server; if the call failed we still leave the app.
    }
    window.location.replace("/index.html?loggedOut=1");
  }

  document.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-logout]");
    if (btn) { e.preventDefault(); btn.disabled = true; logout(); }
  });

  buildShell();

  const ready = API.me().then(function (user) {
    currentUser = user;
    renderUser(user);
    document.body.removeAttribute("data-auth");
    refreshBadges();
    return user;
  }).catch(function (error) {
    if (error && error.status === 401) {
      window.SkillSwapAuth.handleUnauthorized();
    } else {
      const loader = document.querySelector(".page-loader");
      if (loader) {
        loader.innerHTML = '<div class="card p-4" style="max-width:420px">' +
          UI.errorState(error.message || "Could not load your session.") + "</div>";
        const retry = loader.querySelector("[data-retry]");
        if (retry) retry.addEventListener("click", function () { window.location.reload(); });
      }
    }
    return new Promise(function () {}); // Never resolve: page code must not run without a user.
  });

  window.App = {
    ready: ready,
    user: function () { return currentUser; },
    setUser: function (user) { currentUser = Object.assign({}, currentUser, user); renderUser(currentUser); },
    refreshBadges: refreshBadges,
    setBadge: setBadge,
    logout: logout
  };
})();
