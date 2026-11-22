/* ==========================================================================
   SkillSwap — Reusable components
   User cards, the profile modal, the "request a swap" modal, and a small
   cache of people the backend has already returned (search / matches).
   ========================================================================== */
(function () {
  "use strict";

  const esc = UI.escapeHtml;

  // ---------- Cached backend data ----------
  let mySkillsPromise = null;
  function getMySkills(force) {
    if (force || !mySkillsPromise) {
      mySkillsPromise = API.getSkills().then(function (s) {
        return { teachingSkills: s.teachingSkills || [], learningSkills: s.learningSkills || [] };
      });
      mySkillsPromise.catch(function () { mySkillsPromise = null; });
    }
    return mySkillsPromise;
  }

  // userId -> set of PENDING request ids the current user has sent to them
  async function getPendingTargets() {
    const sent = await API.getSentRequests();
    const map = new Map();
    (sent || []).forEach(function (r) {
      if (r.status === "PENDING") map.set(Number(r.receiverId), r);
    });
    return map;
  }

  // ---------- People cache ----------
  // Public profiles by user ID. Filled from GET /api/users/{id}, and from
  // search / match results, which contain the same public fields.
  const people = new Map();

  function remember(users) {
    (users || []).forEach(function (u) { if (u && u.userId != null) people.set(Number(u.userId), u); });
  }

  // Load one member's public profile by ID (cached).
  const personRequests = new Map();
  function getPerson(userId, force) {
    const id = Number(userId);
    if (force || !personRequests.has(id)) {
      const p = API.getUser(id).then(function (u) { people.set(id, u); return u; });
      p.catch(function () { personRequests.delete(id); });
      personRequests.set(id, p);
    }
    return personRequests.get(id);
  }

  // Load profiles for [{ partnerId }] directly by ID, so partner details
  // stay available even if they change their skills.
  async function resolvePeople(items) {
    const ids = new Set();
    items.forEach(function (it) { if (it && it.partnerId != null) ids.add(Number(it.partnerId)); });
    await Promise.allSettled(Array.from(ids).map(function (id) { return getPerson(id); }));
    return people;
  }

  // ---------- User card ----------
  // opts: { mySkills, score, pending (request object), focusSkill }
  function userCard(user, opts) {
    const o = opts || {};
    const my = o.mySkills || { teachingSkills: [], learningSkills: [] };
    const teaches = user.teachingSkills || [];
    const wants = user.learningSkills || [];
    const canTeachMe = teaches.filter(function (s) { return UI.hasSkill(my.learningSkills, s); });
    const wantsMine = wants.filter(function (s) { return UI.hasSkill(my.teachingSkills, s); });

    let scoreHtml = "";
    if (typeof o.score === "number") {
      const pct = Math.round(o.score);
      scoreHtml = '<div class="score-ring" style="--p:' + pct + '" title="Compatibility score"><span>' + pct + "%</span></div>";
    }

    let summary = "";
    if (canTeachMe.length && wantsMine.length) summary = '<span class="text-success"><i class="bi bi-arrow-left-right"></i> Two-way match</span>';
    else if (canTeachMe.length) summary = '<span class="text-primary"><i class="bi bi-mortarboard"></i> Can teach you</span>';
    else if (wantsMine.length) summary = '<span style="color:var(--ss-violet)"><i class="bi bi-lightbulb"></i> Wants to learn from you</span>';

    const requestBtn = o.pending
      ? '<a class="btn btn-light btn-sm" href="/swap-requests.html?tab=sent" title="You already have a pending request with this person"><i class="bi bi-hourglass-split"></i>Request pending</a>'
      : '<button type="button" class="btn btn-primary btn-sm" data-action="request" data-user-id="' + esc(user.userId) + '"' +
        (teaches.length ? "" : ' disabled title="This person has not listed any skills to teach yet"') +
        '><i class="bi bi-send"></i>Request swap</button>';

    return '<div class="card user-card" data-user-card="' + esc(user.userId) + '">' +
      '<div class="user-card-head">' + UI.avatar(user, "avatar-lg") +
        '<div class="min-w-0"><div class="user-card-name">' + esc(user.name) + "</div>" +
        '<div class="small">' + (summary || '<span class="text-muted">SkillSwap member</span>') + "</div></div>" + scoreHtml + "</div>" +
      '<p class="user-card-bio">' + (user.bio ? esc(user.bio) : '<span class="fst-italic">No bio yet.</span>') + "</p>" +
      '<div><div class="user-card-section-label">Teaches</div>' + UI.chipList(teaches, "teach", my.learningSkills, "No teaching skills listed") + "</div>" +
      '<div><div class="user-card-section-label">Wants to learn</div>' + UI.chipList(wants, "learn", my.teachingSkills, "No learning goals listed") + "</div>" +
      '<div class="user-card-footer"><button type="button" class="btn btn-light btn-sm" data-action="view" data-user-id="' + esc(user.userId) + '"><i class="bi bi-person-lines-fill"></i>View profile</button>' + requestBtn + "</div>" +
      "</div>";
  }

  // Delegate card buttons inside a container. getContext() returns { mySkills, onSent }.
  function bindUserCards(container, getContext) {
    container.addEventListener("click", function (e) {
      const btn = e.target.closest("[data-action]");
      if (!btn || !container.contains(btn)) return;
      const user = people.get(Number(btn.getAttribute("data-user-id")));
      if (!user) return;
      const ctx = getContext ? getContext() : {};
      if (btn.getAttribute("data-action") === "view") openProfileModal(user, ctx);
      if (btn.getAttribute("data-action") === "request") openSwapModal(user, ctx);
    });
  }

  // ---------- Modal helper ----------
  function createModal(html, size) {
    const wrap = document.createElement("div");
    wrap.innerHTML = '<div class="modal fade" tabindex="-1" aria-hidden="true"><div class="modal-dialog modal-dialog-centered modal-dialog-scrollable ' + (size || "") + '"><div class="modal-content">' + html + "</div></div></div>";
    const el = wrap.firstChild;
    document.body.appendChild(el);
    const modal = new bootstrap.Modal(el);
    el.addEventListener("hidden.bs.modal", function () { modal.dispose(); el.remove(); });
    return { el: el, modal: modal };
  }

  // ---------- Contact buttons (large, clearly labelled) ----------
  function contactButtons(user, emptyText) {
    const items = UI.contactItems(user);
    if (!items.length) return '<p class="hint mb-0">' + esc(emptyText || "No contact details shared.") + "</p>";
    return '<div class="contact-buttons">' + items.map(function (it) {
      const kind = it.label.toLowerCase();
      const inner = '<span class="contact-btn-icon"><i class="bi ' + it.icon + '"></i></span>' +
        '<span class="min-w-0"><span class="contact-btn-label">' + esc(it.label) + '</span><span class="contact-btn-value">' + esc(it.value) + "</span></span>";
      return it.href
        ? '<a class="contact-btn contact-' + kind + '" href="' + esc(it.href) + '" target="_blank" rel="noopener">' + inner + "</a>"
        : '<span class="contact-btn contact-' + kind + '">' + inner + "</span>";
    }).join("") + "</div>";
  }

  // ---------- Profile / partner modal ----------
  // ctx: { mySkills, tagline, relationshipHtml, onSent }
  function openProfileModal(user, ctx) {
    const c = ctx || {};
    const my = c.mySkills || { teachingSkills: [], learningSkills: [] };
    const score = typeof user.compatibilityScore === "number"
      ? '<span class="person-score"><i class="bi bi-stars"></i>' + Math.round(user.compatibilityScore) + "% compatibility</span>" : "";

    const m = createModal(
      '<div class="person-hero">' +
        '<button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>' +
        UI.avatar(user, "avatar-xl") +
        '<div class="min-w-0"><h3 class="person-name">' + esc(user.name) + "</h3>" +
          '<div class="person-tagline">' + (c.tagline || "SkillSwap member") + "</div>" + score + "</div>" +
      "</div>" +
      '<div class="modal-body pt-4">' +
        (c.relationshipHtml ? '<div class="person-section"><div class="person-section-title"><i class="bi bi-arrow-left-right"></i>Your swaps together</div>' + c.relationshipHtml + "</div>" : "") +
        '<div class="person-section"><div class="person-section-title"><i class="bi bi-chat-dots"></i>Contact</div>' + contactButtons(user) + "</div>" +
        '<div class="person-section"><div class="person-section-title"><i class="bi bi-person"></i>About</div><p class="text-secondary mb-0">' + (user.bio ? esc(user.bio) : '<span class="fst-italic">No bio yet.</span>') + "</p></div>" +
        '<div class="row g-3"><div class="col-sm-6"><div class="user-card-section-label">Teaches</div>' + UI.chipList(user.teachingSkills, "teach", my.learningSkills, "No teaching skills listed") + "</div>" +
        '<div class="col-sm-6"><div class="user-card-section-label">Wants to learn</div>' + UI.chipList(user.learningSkills, "learn", my.teachingSkills, "No learning goals listed") + "</div></div>" +
      "</div>" +
      '<div class="modal-footer"><button type="button" class="btn btn-light" data-bs-dismiss="modal">Close</button>' +
        '<a class="btn btn-outline-primary" href="/learning-graph.html?targetId=' + esc(user.userId) + '"><i class="bi bi-diagram-3"></i>Learning network</a>' +
        ((user.teachingSkills || []).length ? '<button type="button" class="btn btn-primary" data-open-swap><i class="bi bi-send"></i>Request a swap</button>' : "") +
      "</div>", "modal-lg");

    const swapBtn = m.el.querySelector("[data-open-swap]");
    if (swapBtn) swapBtn.addEventListener("click", function () {
      m.el.addEventListener("hidden.bs.modal", function () { openSwapModal(user, c); }, { once: true });
      m.modal.hide();
    });
    m.modal.show();
    return m;
  }

  // ---------- Swap request modal ----------
  // POST /api/requests { receiverId, requestedSkill, offeredSkill? }
  // Backend rules (RequestService / RequestRepository.sendRequest):
  //   * requestedSkill is required and the receiver must TEACH it,
  //   * offeredSkill is optional (one-way request); if given, the sender
  //     must TEACH it and it must differ from requestedSkill.
  // ctx: { mySkills, learnSkill (preselect, may be partial), onSent }
  async function openSwapModal(user, ctx) {
    const c = ctx || {};
    let my;
    try {
      my = await getMySkills();
    } catch (e) {
      UI.toast(e.message, "error");
      return;
    }
    const theirTeach = user.teachingSkills || [];
    const myTeach = my.teachingSkills || [];
    const theyWant = myTeach.filter(function (s) { return UI.hasSkill(user.learningSkills, s); });

    const pick = function (name, value, label, checked, tag, tagClass, extraClass) {
      return '<label class="pick' + (extraClass ? " " + extraClass : "") + '"><input type="radio" name="' + name + '" value="' + esc(value) + '"' + (checked ? " checked" : "") + ">" +
        '<span class="pick-body"><span class="pick-name">' + esc(label) + "</span>" + (tag ? '<span class="pick-tag ' + (tagClass || "") + '">' + tag + "</span>" : "") + "</span></label>";
    };

    let body;
    if (!theirTeach.length) {
      body = UI.emptyState("bi-person-x", user.name + " hasn't listed skills to teach yet", "You can request a swap once they add a skill they can teach.", "", true);
    } else {
      const wanted = UI.norm(c.learnSkill || "");
      const preferLearn = (wanted && (theirTeach.find(function (s) { return UI.norm(s) === wanted; }) ||
          theirTeach.find(function (s) { return UI.norm(s).indexOf(wanted) !== -1; }))) ||
        theirTeach.find(function (s) { return UI.hasSkill(my.learningSkills, s); }) || theirTeach[0];
      const preferOffer = theyWant.find(function (s) { return UI.norm(s) !== UI.norm(preferLearn); }) || "";

      const learnPicks = theirTeach.map(function (s) {
        return pick("learn", s, s, s === preferLearn, UI.hasSkill(my.learningSkills, s) ? '<i class="bi bi-bookmark-star-fill"></i>On your list' : "", "tag-learn");
      }).join("");

      const offerPicks = pick("offer", "", "Nothing for now", !preferOffer, "", "", "pick-none") + myTeach.map(function (s) {
        return pick("offer", s, s, s === preferOffer, UI.hasSkill(user.learningSkills, s) ? '<i class="bi bi-heart-fill"></i>They want this' : "", "tag-teach");
      }).join("");

      const fitNote = theyWant.length
        ? '<div class="swap-fit fit-two"><i class="bi bi-arrow-left-right"></i><div><strong>Two-way match.</strong> ' + esc(user.name) + " wants to learn " + theyWant.map(esc).join(", ") + ", so offering it makes your request more appealing.</div></div>"
        : "";

      body =
        '<div class="swap-with">' + UI.avatar(user, "avatar-lg") +
          '<div class="min-w-0"><div class="small text-muted">Request a swap with</div><div class="fw-semibold fs-5 truncate">' + esc(user.name) + "</div></div></div>" +
        '<div data-swap-alert></div>' +
        '<fieldset class="swap-step"><legend><span class="swap-step-num">1</span>What do you want to learn? <span class="swap-req">Required</span></legend>' +
          '<p class="swap-step-hint">Skills ' + esc(user.name) + " can teach</p>" +
          '<div class="pick-grid">' + learnPicks + "</div></fieldset>" +
        '<fieldset class="swap-step"><legend><span class="swap-step-num">2</span>Would you like to teach them something in return? <span class="swap-opt">Optional</span></legend>' +
          '<p class="swap-step-hint"><strong>Offering a skill in return is optional.</strong> ' +
            (myTeach.length ? "Pick one of your skills, or leave it as “Nothing for now”." : "You haven't added any teaching skills yet, so this will be a one-way request. <a href=\"/profile.html#teach\">Add a teaching skill</a>") + "</p>" +
          (myTeach.length ? '<div class="pick-grid">' + offerPicks + "</div>" + fitNote : "") +
        "</fieldset>" +
        '<div class="swap-summary" data-swap-preview></div>';
    }

    const m = createModal(
      '<form novalidate><div class="modal-header"><h5 class="modal-title"><i class="bi bi-send text-primary me-2"></i>Request a skill swap</h5>' +
      '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>' +
      '<div class="modal-body">' + body + "</div>" +
      '<div class="modal-footer"><button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>' +
      (theirTeach.length ? '<button type="submit" class="btn btn-primary"><i class="bi bi-send"></i>Send request</button>' : "") + "</div></form>");

    if (theirTeach.length) {
      const form = m.el.querySelector("form");
      const preview = m.el.querySelector("[data-swap-preview]");
      const alertBox = m.el.querySelector("[data-swap-alert]");
      const val = function (name) { const el = form.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ""; };

      const renderPreview = function () {
        const learn = val("learn");
        const offer = val("offer");
        if (!learn) { preview.innerHTML = ""; return; }
        preview.innerHTML = '<i class="bi bi-chat-square-quote"></i><div>You\'ll ask to learn ' + UI.chip(learn, "learn") + " from " + esc(user.name) +
          (offer ? " and teach " + UI.chip(offer, "teach") + " in return." : " without offering a skill in return.") + "</div>";
      };
      form.addEventListener("change", function () { UI.showAlert(alertBox, ""); renderPreview(); });
      renderPreview();

      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        UI.showAlert(alertBox, "");
        const learn = val("learn");
        const offer = val("offer");
        if (!learn) { UI.showAlert(alertBox, "Choose the skill you want to learn."); return; }
        if (offer && UI.norm(offer) === UI.norm(learn)) {
          UI.showAlert(alertBox, "Choose two different skills. You can't swap a skill for itself.");
          return;
        }
        const submit = form.querySelector('[type="submit"]');
        UI.setLoading(submit, true, "Sending…");
        try {
          // No offered skill -> the field is left out (one-way request).
          const result = await API.sendRequest(user.userId, offer || null, learn);
          m.modal.hide();
          UI.toast("Swap request sent to " + user.name + ".");
          if (c.onSent) c.onSent(user, result);
          if (window.App) App.refreshBadges();
        } catch (err) {
          UI.setLoading(submit, false);
          UI.showAlert(alertBox, err.message);
        }
      });
    }
    m.modal.show();
  }

  // ---------- Notification presentation ----------
  // Messages are created by RequestService; we pick an icon and a link
  // based on the event they describe.
  function notificationMeta(message) {
    const m = String(message || "").toLowerCase();
    if (m.indexOf("completed") !== -1) return { icon: "bi-patch-check-fill", color: "var(--ss-success)", bg: "var(--ss-success-bg)", href: "/my-swaps.html" };
    if (m.indexOf("accepted") !== -1) return { icon: "bi-check-circle-fill", color: "var(--ss-primary)", bg: "var(--ss-primary-50)", href: "/swap-requests.html?tab=sent" };
    if (m.indexOf("rejected") !== -1) return { icon: "bi-x-circle-fill", color: "var(--ss-danger)", bg: "var(--ss-danger-bg)", href: "/swap-requests.html?tab=sent" };
    if (m.indexOf("cancelled") !== -1) return { icon: "bi-slash-circle", color: "#5b6576", bg: "#eef1f5", href: "/swap-requests.html?tab=received" };
    if (m.indexOf("received") !== -1) return { icon: "bi-envelope-paper-fill", color: "var(--ss-warning)", bg: "var(--ss-warning-bg)", href: "/swap-requests.html?tab=received" };
    return { icon: "bi-bell-fill", color: "var(--ss-primary)", bg: "var(--ss-primary-50)", href: "" };
  }

  // ---------- Swap request card ----------
  function requestCard(r, myUserId) {
    const p = UI.perspective(r, myUserId);
    const partner = people.get(Number(p.partnerId)) || { userId: p.partnerId, name: p.partnerName };
    const status = r.status;
    let actions = "";
    let extra = "";

    if (status === "PENDING" && !p.iAmSender) {
      actions = '<button class="btn btn-primary btn-sm" data-req-act="accept"><i class="bi bi-check-lg"></i>Accept</button>' +
        '<button class="btn btn-soft-danger btn-sm" data-req-act="reject"><i class="bi bi-x-lg"></i>Reject</button>';
    } else if (status === "PENDING" && p.iAmSender) {
      actions = '<button class="btn btn-light btn-sm" data-req-act="cancel"><i class="bi bi-x-circle"></i>Cancel request</button>';
      extra = '<div class="request-note"><i class="bi bi-hourglass-split me-1"></i>Waiting for ' + esc(p.partnerName) + " to respond.</div>";
    } else if (status === "ACCEPTED") {
      actions = '<button class="btn btn-soft-success btn-sm" data-req-act="complete"><i class="bi bi-patch-check"></i>Mark as completed</button>';
      extra = '<div class="contact-box">' + (partner.email || partner.whatsapp || partner.telegram ? UI.contactInline(partner) : '<span class="hint">Contact details unavailable — the partner may have removed the skill used to look them up.</span>') + "</div>" +
        '<div class="request-note"><i class="bi bi-info-circle me-1"></i>Arrange your sessions using the contact details above. The swap is completed once <strong>both</strong> of you mark it as completed.</div>';
    } else if (status === "COMPLETED") {
      actions = '<a class="btn btn-light btn-sm" href="/learning-graph.html?targetId=' + esc(p.partnerId) + '"><i class="bi bi-diagram-3"></i>Learning network</a>';
    }

    return '<div class="card request-card" data-request-id="' + esc(r.requestId) + '" data-status="' + esc(status) + '">' +
      UI.avatar(partner, "avatar-lg") +
      '<div class="min-w-0">' +
        '<div class="d-flex align-items-center gap-2 flex-wrap"><span class="fw-semibold fs-6">' + esc(p.partnerName) + "</span>" + UI.statusBadge(status) + "</div>" +
        '<div class="request-meta"><span><i class="bi ' + (p.iAmSender ? "bi-send" : "bi-inbox") + ' me-1"></i>' + (p.iAmSender ? "You sent this" : "Sent to you") + "</span>" +
          "<span title=\"" + esc(UI.formatDate(r.createdAt, true)) + '"><i class="bi bi-clock me-1"></i>' + esc(UI.timeAgo(r.createdAt)) + "</span><span>#" + esc(r.requestId) + "</span></div>" +
        '<div class="request-exchange"><span>You teach</span>' + UI.skillChip(p.iTeach, "teach", "Nothing (one-way)") + '<i class="bi bi-arrow-left-right"></i><span>You learn</span>' + UI.skillChip(p.iLearn, "learn", "Nothing (one-way)") + "</div>" +
      "</div>" +
      '<div class="request-actions">' + actions + "</div>" + extra +
      "</div>";
  }

  // Handle Accept / Reject / Cancel / Complete. onDone(action, id) reloads the page data.
  function bindRequestActions(container, onDone) {
    container.addEventListener("click", async function (e) {
      const btn = e.target.closest("[data-req-act]");
      if (!btn || !container.contains(btn)) return;
      const card = btn.closest("[data-request-id]");
      const id = card.getAttribute("data-request-id");
      const act = btn.getAttribute("data-req-act");

      const confirmations = {
        reject: { title: "Reject this request?", message: "The sender will be notified that you declined.", confirmText: "Reject request", danger: true },
        cancel: { title: "Cancel this request?", message: "The request will be withdrawn and the receiver will be notified.", confirmText: "Cancel request", danger: true },
        complete: { title: "Mark this swap as completed?", message: "Confirm that the skill exchange has taken place. The swap becomes Completed once both partners confirm.", confirmText: "Yes, mark completed" }
      };
      if (confirmations[act]) {
        const ok = await UI.confirmDialog(Object.assign({ cancelText: "Go back" }, confirmations[act]));
        if (!ok) return;
      }

      card.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
      UI.setLoading(btn, true);
      try {
        const calls = { accept: API.acceptRequest, reject: API.rejectRequest, cancel: API.cancelRequest, complete: API.completeRequest };
        const res = await calls[act](id);
        if (act !== "complete") UI.toast((res && res.message) || "Done.");
        if (window.App) App.refreshBadges();
        if (onDone) await onDone(act, id);
      } catch (err) {
        UI.toast(err.message, "error");
        card.querySelectorAll("button").forEach(function (b) { b.disabled = false; });
        UI.setLoading(btn, false);
      }
    });
  }

  // After "complete", tell the user whether the swap is now COMPLETED or waiting for the partner.
  function reportCompletion(requests, id) {
    const r = (requests || []).find(function (x) { return String(x.requestId) === String(id); });
    if (r && r.status === "COMPLETED") UI.toast("Swap completed! It now counts toward your learning graph.");
    else UI.toast("Your confirmation is saved. The swap will be marked Completed once your partner confirms too.", "info");
  }

  window.Components = {
    requestCard: requestCard,
    bindRequestActions: bindRequestActions,
    reportCompletion: reportCompletion,
    notificationMeta: notificationMeta,
    getMySkills: getMySkills,
    getPendingTargets: getPendingTargets,
    people: people,
    remember: remember,
    resolvePeople: resolvePeople,
    getPerson: getPerson,
    userCard: userCard,
    bindUserCards: bindUserCards,
    openProfileModal: openProfileModal,
    openSwapModal: openSwapModal,
    contactButtons: contactButtons,
    createModal: createModal
  };
})();
