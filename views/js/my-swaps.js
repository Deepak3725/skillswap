/* ==========================================================================
   SkillSwap — My swaps
   APIs: GET /api/requests/sent + /api/requests/received (ACCEPTED / COMPLETED),
         POST /api/requests/{id}/complete,
         GET /api/search (partner profiles: photo, bio, contact details)
   Swaps are grouped into one card per partner.
   ========================================================================== */
(function () {
  "use strict";

  const esc = UI.escapeHtml;
  let me = null;
  let all = [];
  let profilesLoaded = false;
  let focusDone = false;

  function setStat(name, v) { document.querySelector('[data-stat="' + name + '"]').textContent = v; }

  function distinct(values) {
    const seen = new Map();
    values.forEach(function (v) { if (v && !seen.has(UI.norm(v))) seen.set(UI.norm(v), v); });
    return Array.from(seen.values());
  }

  // Group requests by partner, keeping the newest first.
  function byPartner(requests) {
    const groups = new Map();
    requests.forEach(function (r) {
      const p = UI.perspective(r, me.userId);
      const id = Number(p.partnerId);
      if (!groups.has(id)) groups.set(id, { partnerId: id, partnerName: p.partnerName, items: [] });
      groups.get(id).items.push({ r: r, p: p });
    });
    return Array.from(groups.values());
  }

  function partnerOf(id, name) {
    return Components.people.get(Number(id)) || { userId: id, name: name };
  }

  function contactBlock(partner) {
    if (partner.email || partner.whatsapp || partner.telegram) return Components.contactButtons(partner);
    return '<p class="hint mb-0"><i class="bi bi-info-circle me-1"></i>' +
      (profilesLoaded ? "No contact details shared." : "Loading contact details…") + "</p>";
  }

  function swapRow(item, kind) {
    const r = item.r, p = item.p;
    const actions = kind === "active"
      ? '<button type="button" class="btn btn-soft-success btn-sm" data-req-act="complete"><i class="bi bi-patch-check"></i>Mark as completed</button>'
      : "";
    return '<div class="partner-swap" data-request-id="' + esc(r.requestId) + '">' +
      '<div class="partner-swap-top"><span>' + UI.statusBadge(r.status) + '<span class="ms-2">' + (p.iAmSender ? "You requested" : "They requested") +
        ' · <span title="' + esc(UI.formatDate(r.createdAt, true)) + '">' + esc(UI.formatDate(r.createdAt)) + "</span></span></span>" + actions + "</div>" +
      '<div class="np-ex-row ex-teach"><span class="np-ex-label"><i class="bi bi-arrow-right"></i>' + (r.status === "ACCEPTED" ? "You teach" : "You taught") + "</span>" + UI.skillChip(p.iTeach, "teach", "Nothing (one-way request)") + "</div>" +
      '<div class="np-ex-row ex-learn"><span class="np-ex-label"><i class="bi bi-arrow-left"></i>' + (r.status === "ACCEPTED" ? "You learn" : "You learned") + "</span>" + UI.skillChip(p.iLearn, "learn", "Nothing (one-way request)") + "</div>" +
      "</div>";
  }

  function partnerCard(group, kind) {
    const partner = partnerOf(group.partnerId, group.partnerName);
    const count = group.items.length;
    const label = kind === "active" ? (count === 1 ? "1 active swap" : count + " active swaps") : (count === 1 ? "1 completed swap" : count + " completed swaps");
    return '<div class="col-lg-6"><article class="card partner-card" id="' + kind + "-partner-" + group.partnerId + '" data-partner="' + group.partnerId + '" data-kind="' + kind + '" tabindex="0" role="button" aria-label="Open details for ' + esc(group.partnerName) + '">' +
      '<div class="partner-head">' + UI.avatar(partner, "avatar-lg") +
        '<div class="min-w-0"><div class="partner-name">' + esc(group.partnerName) + "</div>" +
        '<div class="partner-sub"><span><i class="bi ' + (kind === "active" ? "bi-lightning-charge" : "bi-patch-check") + ' me-1"></i>' + label + "</span></div></div>" +
        '<i class="bi bi-chevron-right partner-open" aria-hidden="true"></i></div>' +
      contactBlock(partner) +
      '<div class="partner-swaps">' + group.items.map(function (it) { return swapRow(it, kind); }).join("") + "</div>" +
      '<div class="partner-footer">' +
        '<button type="button" class="btn btn-light btn-sm" data-details><i class="bi bi-person-vcard"></i>View details</button>' +
        '<a class="btn btn-light btn-sm" href="/learning-graph.html?targetId=' + group.partnerId + '"><i class="bi bi-diagram-3"></i>Learning network</a>' +
      "</div>" +
      "</article></div>";
  }

  function render() {
    const active = all.filter(function (r) { return r.status === "ACCEPTED"; }).reverse();
    const completed = all.filter(function (r) { return r.status === "COMPLETED"; }).reverse();
    const pendingCount = all.filter(function (r) { return r.status === "PENDING" && Number(r.receiverId) === Number(me.userId); }).length;

    const learned = distinct(completed.map(function (r) { return UI.perspective(r, me.userId).iLearn; }));
    const taught = distinct(completed.map(function (r) { return UI.perspective(r, me.userId).iTeach; }));
    setStat("completed", completed.length);
    setStat("active", active.length);
    setStat("learned", learned.length);
    setStat("taught", taught.length);
    document.getElementById("pendingLink").innerHTML = '<i class="bi bi-inbox"></i>Pending requests' + (pendingCount ? ' <span class="nav-badge">' + pendingCount + "</span>" : "");
    document.getElementById("activeCount").textContent = active.length ? "(" + active.length + ")" : "";
    document.getElementById("completedCount").textContent = completed.length ? "(" + completed.length + ")" : "";

    const activeGroups = byPartner(active);
    document.getElementById("activeList").innerHTML = activeGroups.length
      ? activeGroups.map(function (g) { return partnerCard(g, "active"); }).join("")
      : '<div class="col-12"><div class="card">' + UI.emptyState("bi-lightning", "No active swaps", "When someone accepts your request, or you accept theirs, the swap shows up here until you both complete it.",
          '<a class="btn btn-light btn-sm" href="/swap-requests.html">View requests</a>', true) + "</div></div>";

    const doneGroups = byPartner(completed);
    document.getElementById("completedList").innerHTML = doneGroups.length
      ? doneGroups.map(function (g) { return partnerCard(g, "completed"); }).join("")
      : '<div class="col-12"><div class="card">' + UI.emptyState("bi-patch-check", "No completed swaps yet", "Completed exchanges become your swap history and add people to your learning network.", "", true) + "</div></div>";
  }

  // #completed (dashboard card), #active, #partner-<id> (learning network)
  function applyFocus() {
    if (focusDone) return;
    const hash = window.location.hash;
    let target = null;
    if (hash === "#completed" || hash === "#active") target = document.querySelector(hash);
    const m = /^#partner-(\d+)$/.exec(hash);
    if (m) target = document.getElementById("active-partner-" + m[1]) || document.getElementById("completed-partner-" + m[1]);
    if (!target) return;
    focusDone = true;
    target.scrollIntoView({ behavior: "smooth", block: m ? "center" : "start" });
    if (m) {
      target.classList.add("is-target");
      setTimeout(function () { target.classList.remove("is-target"); }, 2200);
    }
  }

  function openDetails(partnerId, kind) {
    const swapsWith = all.filter(function (r) {
      return (r.status === "ACCEPTED" || r.status === "COMPLETED") && Number(UI.perspective(r, me.userId).partnerId) === Number(partnerId);
    }).reverse();
    if (!swapsWith.length) return;
    const name = UI.perspective(swapsWith[0], me.userId).partnerName;
    const user = partnerOf(partnerId, name);
    const rel = '<div class="partner-swaps">' + swapsWith.map(function (r) {
      return swapRow({ r: r, p: UI.perspective(r, me.userId) }, r.status === "ACCEPTED" ? "detail-active" : "completed");
    }).join("") + "</div>";
    const nActive = swapsWith.filter(function (r) { return r.status === "ACCEPTED"; }).length;
    const nDone = swapsWith.length - nActive;
    const tagline = [nActive ? nActive + " active" : "", nDone ? nDone + " completed" : ""].filter(Boolean).join(" · ") + (swapsWith.length === 1 ? " swap" : " swaps") + " with you";
    Components.getMySkills().catch(function () { return null; }).then(function (my) {
      Components.openProfileModal(Object.assign({ teachingSkills: [], learningSkills: [] }, user), { mySkills: my, tagline: esc(tagline), relationshipHtml: rel });
    });
  }

  function bindCards(container) {
    container.addEventListener("click", function (e) {
      // Inner controls (contact links, complete, links) keep their own behaviour.
      if (e.target.closest("a, [data-req-act]")) return;
      const card = e.target.closest("[data-partner]");
      if (card) openDetails(card.getAttribute("data-partner"), card.getAttribute("data-kind"));
    });
    container.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (!e.target.matches("[data-partner]")) return;
      e.preventDefault();
      openDetails(e.target.getAttribute("data-partner"), e.target.getAttribute("data-kind"));
    });
  }

  async function load(skeleton) {
    if (skeleton) {
      document.getElementById("activeList").innerHTML = '<div class="col-12"><div class="card">' + UI.skeletonRows(2) + "</div></div>";
      document.getElementById("completedList").innerHTML = '<div class="col-12"><div class="card">' + UI.skeletonRows(2) + "</div></div>";
    }
    try {
      const res = await Promise.all([API.getSentRequests(), API.getReceivedRequests()]);
      all = (res[0] || []).concat(res[1] || []).sort(function (a, b) {
        const da = UI.parseDate(a.createdAt), db = UI.parseDate(b.createdAt);
        return (da ? da.getTime() : 0) - (db ? db.getTime() : 0) || a.requestId - b.requestId;
      });
      render();
      const items = all.filter(function (r) { return r.status === "ACCEPTED" || r.status === "COMPLETED"; })
        .map(function (r) { return UI.perspective(r, me.userId); });
      // Partner profiles are loaded directly by ID (GET /api/users/{id}).
      await Components.resolvePeople(items);
      profilesLoaded = true;
      render();
      applyFocus();
      return all;
    } catch (e) {
      document.getElementById("activeList").innerHTML = '<div class="col-12"><div class="card" data-err></div></div>';
      UI.renderError(document.querySelector("#activeList [data-err]"), e, function () { load(true); });
      document.getElementById("completedList").innerHTML = "";
    }
  }

  bindCards(document.getElementById("activeList"));
  bindCards(document.getElementById("completedList"));
  Components.bindRequestActions(document.getElementById("activeList"), async function (act, id) {
    const fresh = await load(false);
    if (act === "complete" && fresh) Components.reportCompletion(fresh, id);
  });

  App.ready.then(function (user) { me = user; load(true); });
})();
