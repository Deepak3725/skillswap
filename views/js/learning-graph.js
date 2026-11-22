/* ==========================================================================
   SkillSwap — My learning network
   APIs:
     GET /api/learning-graph/network?depth=   people connected to you through
                                              completed swaps (1, 2, 3 or all
                                              swaps away) with the skills
                                              exchanged in each swap
     GET /api/learning-graph/chain?targetId=  shortest connection (SwapSearch, BFS)
     GET /api/learning-graph/path?targetId=   a learning path (SwapDFS, DFS)
     GET /api/matches, /api/requests/sent|received  (people for "find a connection")

   Every number, name and skill on this page comes from those responses.
   The page only lays the people out in columns by the "hops" value the
   server returns; it does not search the graph itself.
   ========================================================================== */
(function () {
  "use strict";

  const esc = UI.escapeHtml;
  const NS = "http://www.w3.org/2000/svg";

  // Layout constants (SVG units)
  const COL = 250, ROW = 130, PADX = 92, PADY = 64, R_ME = 38, R = 30;

  let me = null;                 // logged-in user
  let nodes = new Map();         // userId -> { userId, name, profilePicture, hops }
  let swaps = [];                // completed swaps between people in the network
  let pairs = new Map();         // "a-b" -> { key, a, b, swaps: [] }
  let neighbours = new Map();    // userId -> Set(userId)
  let positions = new Map();     // userId -> { x, y, r }
  let selected = null;           // selected userId
  let route = null;              // { users: [...], kind }
  let routeResults = null;       // { targetId, chain, path, kind }
  let svg = null;
  let others = null;             // people outside the network (for the finder)
  let truncated = false;         // server returned only the closest people
  const DEPTHS = ["1", "2", "3", "all"];
  let depth = DEPTHS.indexOf(String(UI.qs("depth"))) !== -1 ? String(UI.qs("depth")) : "3";

  const canvas = document.getElementById("netCanvas");
  const panel = document.getElementById("netPanel");
  const lists = document.getElementById("netLists");
  const resetBtn = document.getElementById("resetBtn");

  // ---------- Data helpers ----------
  const pairKey = function (a, b) { return Math.min(a, b) + "-" + Math.max(a, b); };
  const isMe = function (id) { return me && Number(id) === Number(me.userId); };
  const nameOf = function (id) { return isMe(id) ? "You" : ((nodes.get(Number(id)) || {}).name || "Member #" + id); };
  // In a swap the sender teaches offeredSkill and the receiver teaches requestedSkill.
  const taughtBy = function (s, id) { return Number(s.senderId) === Number(id) ? s.offeredSkill : s.requestedSkill; };

  // "You taught Java · learned Python", marking one-way swaps honestly.
  function exchangeText(subject, taught, learned) {
    const parts = [];
    if (taught.length) parts.push(subject + " taught " + taught.join(", "));
    if (learned.length) parts.push((parts.length ? "learned " : subject + " learned ") + learned.join(", "));
    if (!taught.length || !learned.length) parts.push("one-way");
    return parts.join(" · ");
  }

  function distinct(values) {
    const seen = new Map();
    values.forEach(function (v) { if (v && !seen.has(UI.norm(v))) seen.set(UI.norm(v), v); });
    return Array.from(seen.values());
  }

  function index(network) {
    truncated = !!network.truncated;
    nodes = new Map();
    pairs = new Map();
    neighbours = new Map();
    (network.nodes || []).forEach(function (n) {
      nodes.set(Number(n.userId), { userId: Number(n.userId), name: n.name, profilePicture: n.profilePicture, hops: Number(n.hops) });
      neighbours.set(Number(n.userId), new Set());
    });
    swaps = (network.edges || []).filter(function (s) { return nodes.has(Number(s.senderId)) && nodes.has(Number(s.receiverId)); });
    swaps.forEach(function (s) {
      const a = Number(s.senderId), b = Number(s.receiverId);
      const key = pairKey(a, b);
      if (!pairs.has(key)) pairs.set(key, { key: key, a: Math.min(a, b), b: Math.max(a, b), swaps: [] });
      pairs.get(key).swaps.push(s);
      neighbours.get(a).add(b);
      neighbours.get(b).add(a);
    });
  }

  // What the logged-in user taught / learned with a direct partner.
  function exchangeWith(partnerId) {
    const p = pairs.get(pairKey(me.userId, partnerId));
    const list = p ? p.swaps : [];
    return {
      swaps: list,
      iTeach: distinct(list.map(function (s) { return taughtBy(s, me.userId); })),
      iLearn: distinct(list.map(function (s) { return taughtBy(s, partnerId); }))
    };
  }

  function relationLabel(id) {
    const n = nodes.get(Number(id));
    if (isMe(id)) return "You";
    if (!n) return "Not in your network yet";
    if (n.hops === 1) return "Direct swap partner";
    return n.hops + " swaps away from you";
  }

  // ---------- Layout: columns by distance (server "hops") ----------
  function layout() {
    const cols = [];
    nodes.forEach(function (n) { (cols[n.hops] = cols[n.hops] || []).push(n); });
    for (let k = 0; k < cols.length; k++) cols[k] = cols[k] || [];

    // Order each column by the average row of its neighbours in the previous
    // column, so lines cross as little as possible.
    const rowOf = new Map();
    cols.forEach(function (col, k) {
      if (k > 0) {
        col.forEach(function (n) {
          const prev = Array.from(neighbours.get(n.userId)).filter(function (id) { return nodes.get(id).hops === k - 1; });
          n._bary = prev.length ? prev.reduce(function (sum, id) { return sum + rowOf.get(id); }, 0) / prev.length : 0;
        });
        col.sort(function (x, y) { return x._bary - y._bary || String(x.name).localeCompare(String(y.name)); });
      }
      col.forEach(function (n, i) { rowOf.set(n.userId, i - (col.length - 1) / 2); });
    });

    const maxRows = Math.max.apply(null, cols.map(function (c) { return c.length; }));
    const height = Math.max(300, PADY * 2 + (maxRows - 1) * ROW + 40);
    const width = cols.length > 1 ? PADX * 2 + (cols.length - 1) * COL : 320;
    const cy = (height - 30) / 2;

    positions = new Map();
    cols.forEach(function (col, k) {
      col.forEach(function (n, i) {
        positions.set(n.userId, {
          x: cols.length > 1 ? PADX + k * COL : width / 2,
          y: cy + (i - (col.length - 1) / 2) * ROW,
          r: k === 0 ? R_ME : R
        });
      });
    });
    return { width: width, height: height, columns: cols.length };
  }

  // ---------- SVG helpers ----------
  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(e);
    return e;
  }

  function unit(dx, dy) { const l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l }; }

  // Quadratic curve from p1 to p2, bent sideways by `bend`.
  function curve(p1, p2, bend, sameColumn) {
    const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
    let cx, cy;
    if (sameColumn) {
      // Bulge well to the right so the curve and its label clear the
      // people sitting between the two nodes in the same column.
      cx = p1.x + 250;
      cy = my;
    } else {
      const n = unit(-(p2.y - p1.y), p2.x - p1.x);
      cx = mx + n.x * bend;
      cy = my + n.y * bend;
    }
    const u1 = unit(cx - p1.x, cy - p1.y), u2 = unit(cx - p2.x, cy - p2.y);
    const s = { x: p1.x + u1.x * (p1.r + 2), y: p1.y + u1.y * (p1.r + 2) };
    const e = { x: p2.x + u2.x * (p2.r + 5), y: p2.y + u2.y * (p2.r + 5) };
    return {
      d: "M" + s.x.toFixed(1) + " " + s.y.toFixed(1) + " Q" + cx.toFixed(1) + " " + cy.toFixed(1) + " " + e.x.toFixed(1) + " " + e.y.toFixed(1),
      at: function (t) {
        const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
        return { x: a * s.x + b * cx + c * e.x, y: a * s.y + b * cy + c * e.y };
      }
    };
  }

  function short(text, max) { text = String(text || ""); return text.length > max ? text.slice(0, max - 1) + "…" : text; }

  function label(parent, point, text, cls, full) {
    const g = el("g", { class: "elabel " + cls, transform: "translate(" + point.x.toFixed(1) + "," + point.y.toFixed(1) + ")" }, parent);
    const w = Math.round(text.length * 6.3 + 18);
    el("rect", { x: -w / 2, y: -10.5, width: w, height: 21, rx: 10.5 }, g);
    const t = el("text", { "text-anchor": "middle", y: 4 }, g);
    t.textContent = text;
    const title = el("title", {}, g);
    title.textContent = full || text;
    return g;
  }

  function skillsText(list) {
    if (!list.length) return "";
    return short(list[0], 16) + (list.length > 1 ? " +" + (list.length - 1) : "");
  }

  // ---------- Render the map ----------
  function renderMap() {
    canvas.innerHTML = "";
    if (nodes.size <= 1) {
      canvas.innerHTML = UI.emptyState("bi-diagram-3", "Your network starts with your first completed swap",
        "When you and a partner both mark a swap as completed, they appear here, along with the people they've swapped with.",
        '<a class="btn btn-primary btn-sm" href="/search.html?view=learn"><i class="bi bi-search"></i>Find someone to learn from</a>' +
        '<a class="btn btn-light btn-sm" href="/my-swaps.html"><i class="bi bi-patch-check"></i>My swaps</a>');
      document.getElementById("netLegend").hidden = true;
      return;
    }
    document.getElementById("netLegend").hidden = false;

    const size = layout();
    svg = el("svg", {
      class: "net-svg", viewBox: "0 0 " + size.width + " " + size.height, role: "img",
      "aria-label": "Map of your learning network with " + (nodes.size - 1) + " people"
    });
    svg.style.maxWidth = size.width + "px";
    svg.style.minWidth = Math.round(size.width * 0.66) + "px";

    const defs = el("defs", {}, svg);
    [["teach", "#2563eb"], ["learn", "#7c3aed"], ["other", "#9aa6b8"], ["route", "#f59e0b"], ["dim", "#d5dbe5"]].forEach(function (m) {
      const mk = el("marker", { id: "arw-" + m[0], viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
      el("path", { d: "M0 0 L10 5 L0 10 z", fill: m[1] }, mk);
    });

    // Column captions
    const captions = ["You", "Direct partners", "2 swaps away", "3 swaps away"];
    const colsSeen = new Set();
    nodes.forEach(function (n) { colsSeen.add(n.hops); });
    colsSeen.forEach(function (k) {
      if (k === 0) return;
      const t = el("text", { class: "net-col-caption", x: PADX + k * COL, y: 22, "text-anchor": "middle" }, svg);
      t.textContent = captions[k] || k + " swaps away";
    });

    // Edges
    const edgeLayer = el("g", { class: "edges" }, svg);
    const labelLayer = el("g", { class: "labels" }, svg);
    pairs.forEach(function (p) {
      const g = el("g", { class: "pair", "data-pair": p.key }, edgeLayer);
      const lg = el("g", { class: "pair-labels", "data-pair": p.key }, labelLayer);
      const direct = isMe(p.a) || isMe(p.b);
      if (direct) {
        const partner = isMe(p.a) ? p.b : p.a;
        const ex = exchangeWith(partner);
        const pm = positions.get(Number(me.userId)), pp = positions.get(partner);
        // One arrow per direction in which a skill was really taught. A
        // one-way swap (nothing offered) has a single, straight arrow.
        const both = ex.iTeach.length && ex.iLearn.length;
        const teach = curve(pm, pp, both ? 30 : 0, false);
        const learn = curve(pp, pm, both ? 30 : 0, false);
        if (ex.iTeach.length) {
          el("path", { class: "edge edge-teach", d: teach.d, "marker-end": "url(#arw-teach)", "data-kind": "teach" }, g);
          label(lg, teach.at(0.62), skillsText(ex.iTeach), "lbl-teach", "You teach " + nameOf(partner) + ": " + ex.iTeach.join(", "));
        }
        if (ex.iLearn.length) {
          el("path", { class: "edge edge-learn", d: learn.d, "marker-end": "url(#arw-learn)", "data-kind": "learn" }, g);
          label(lg, learn.at(both ? 0.38 : 0.5), skillsText(ex.iLearn), "lbl-learn", "You learn from " + nameOf(partner) + ": " + ex.iLearn.join(", "));
        }
      } else {
        const pa = positions.get(p.a), pb = positions.get(p.b);
        const same = Math.abs(pa.x - pb.x) < 1;
        const c = curve(pa, pb, 14, same);
        const aT = distinct(p.swaps.map(function (s) { return taughtBy(s, p.a); }));
        const bT = distinct(p.swaps.map(function (s) { return taughtBy(s, p.b); }));
        // Arrowheads point at whoever learned something: a taught b -> end.
        const attrs = { class: "edge edge-other", d: c.d, "data-kind": "other" };
        if (aT.length) { attrs["marker-end"] = "url(#arw-other)"; attrs["data-end"] = "1"; }
        if (bT.length) { attrs["marker-start"] = "url(#arw-other)"; attrs["data-start"] = "1"; }
        el("path", attrs, g);
        const text = aT.length && bT.length ? short(aT[0], 11) + " ⇄ " + short(bT[0], 11) : short(aT[0] || bT[0], 18);
        label(lg, c.at(0.5), text, "lbl-other",
          [aT.length ? nameOf(p.a) + " taught " + aT.join(", ") : "", bT.length ? nameOf(p.b) + " taught " + bT.join(", ") : ""].filter(Boolean).join(" · ") +
          (aT.length && bT.length ? "" : " (one-way)"));
      }
    });

    // Nodes
    const nodeLayer = el("g", { class: "nodes" }, svg);
    nodes.forEach(function (n) {
      const pos = positions.get(n.userId);
      const mine = isMe(n.userId);
      const g = el("g", {
        class: "gnode" + (mine ? " is-me" : n.hops === 1 ? " is-direct" : " is-indirect"),
        transform: "translate(" + pos.x + "," + pos.y + ")", tabindex: 0, role: "button",
        "data-uid": n.userId, "aria-label": (mine ? "You" : n.name) + ", " + relationLabel(n.userId)
      }, nodeLayer);
      el("circle", { class: "halo", r: pos.r + 7 }, g);
      el("circle", { class: "ring", r: pos.r + 2.5 }, g);
      const src = UI.safeImageSrc(n.profilePicture);
      if (src) {
        const clip = el("clipPath", { id: "clip-" + n.userId }, defs);
        el("circle", { r: pos.r }, clip);
        el("image", { href: src, x: -pos.r, y: -pos.r, width: pos.r * 2, height: pos.r * 2, preserveAspectRatio: "xMidYMid slice", "clip-path": "url(#clip-" + n.userId + ")" }, g);
      } else {
        el("circle", { r: pos.r, fill: UI.colorFor(n.userId) }, g);
        const t = el("text", { class: "initials", "text-anchor": "middle", y: mine ? 6 : 5 }, g);
        t.textContent = UI.initials(n.name);
      }
      const nm = el("text", { class: "gname", "text-anchor": "middle", y: pos.r + 21 }, g);
      nm.textContent = mine ? "You" : short(n.name, 20);
      const cap = el("text", { class: "gcap", "text-anchor": "middle", y: pos.r + 37 }, g);
      cap.textContent = mine ? short(n.name, 22) : n.hops === 1 ? "Direct partner" : n.hops + " swaps away";
      const badge = el("g", { class: "step-badge", transform: "translate(" + (pos.r * 0.72) + "," + (-pos.r * 0.72) + ")" }, g);
      el("circle", { r: 11 }, badge);
      el("text", { "text-anchor": "middle", y: 4 }, badge);
      const title = el("title", {}, g);
      title.textContent = (mine ? "You" : n.name) + " — " + relationLabel(n.userId);
    });

    canvas.appendChild(svg);
    applyState();
  }

  // ---------- Highlight state ----------
  function applyState() {
    if (!svg) return;
    const routeIds = route ? route.users.map(function (u) { return Number(u.userId); }) : [];
    const routePairs = new Map();   // pair key -> [from, to] in route order
    for (let i = 0; i + 1 < routeIds.length; i++) routePairs.set(pairKey(routeIds[i], routeIds[i + 1]), [routeIds[i], routeIds[i + 1]]);
    const near = selected != null ? neighbours.get(selected) || new Set() : new Set();

    svg.classList.toggle("has-sel", selected != null && !route);
    svg.classList.toggle("has-route", !!route);

    svg.querySelectorAll(".gnode").forEach(function (g) {
      const id = Number(g.getAttribute("data-uid"));
      const step = routeIds.indexOf(id);
      g.classList.toggle("is-sel", id === selected);
      g.classList.toggle("is-near", near.has(id) || id === selected);
      g.classList.toggle("on-route", step !== -1);
      g.querySelector(".step-badge text").textContent = step === -1 ? "" : String(step + 1);
    });
    svg.querySelectorAll(".pair, .pair-labels").forEach(function (g) {
      const key = g.getAttribute("data-pair");
      const ids = key.split("-").map(Number);
      const linked = selected != null && (ids[0] === selected || ids[1] === selected);
      const dir = routePairs.get(key);
      g.classList.toggle("is-near", linked);
      g.classList.toggle("on-route", !!dir);
      g.querySelectorAll("path.edge").forEach(function (p) {
        const kind = p.getAttribute("data-kind");
        let marker = kind;
        if (route) marker = dir ? "route" : "dim";
        else if (selected != null && !linked) marker = "dim";
        p.classList.toggle("route-edge", !!dir);
        if (kind !== "other" || p.getAttribute("data-end")) p.setAttribute("marker-end", "url(#arw-" + marker + ")");
        if (kind === "other" && p.getAttribute("data-start")) p.setAttribute("marker-start", "url(#arw-" + marker + ")");
      });
    });

    resetBtn.hidden = selected == null && !route;
    document.getElementById("netHint").textContent = route
      ? "Showing a connection route — numbers show the order"
      : selected != null ? "Highlighting " + (isMe(selected) ? "your" : nameOf(selected) + "'s") + " connections" : "Select a person to see what you exchanged";
  }

  // ---------- Panel ----------
  function chips(list, variant) {
    return list.length ? '<div class="chip-list">' + list.map(function (s) { return UI.chip(s, variant); }).join("") + "</div>"
      : UI.skillChip("", variant, "Nothing (one-way request)");
  }

  function personHead(n) {
    return '<div class="np-head">' + UI.avatar(n, "avatar-lg") +
      '<div class="min-w-0"><div class="np-name truncate">' + esc(isMe(n.userId) ? n.name + " (you)" : n.name) + "</div>" +
      '<span class="np-rel ' + (isMe(n.userId) ? "rel-me" : n.hops === 1 ? "rel-direct" : "rel-wide") + '">' + esc(relationLabel(n.userId)) + "</span></div></div>";
  }

  // The swaps a person took part in, described from their side.
  function connectionsOf(id) {
    return Array.from(neighbours.get(id) || []).map(function (other) {
      const p = pairs.get(pairKey(id, other));
      return {
        other: other,
        theyTaught: distinct(p.swaps.map(function (s) { return taughtBy(s, id); })),
        otherTaught: distinct(p.swaps.map(function (s) { return taughtBy(s, other); })),
        count: p.swaps.length
      };
    }).sort(function (a, b) { return (isMe(b.other) ? 1 : 0) - (isMe(a.other) ? 1 : 0) || nodes.get(a.other).hops - nodes.get(b.other).hops; });
  }

  function renderOverview() {
    const direct = Array.from(nodes.values()).filter(function (n) { return n.hops === 1; });
    const wider = Array.from(nodes.values()).filter(function (n) { return n.hops > 1; });
    let html = '<div class="card-body">' +
      '<div class="np-title"><i class="bi bi-diagram-3"></i>Your network at a glance</div>';
    if (nodes.size <= 1) {
      html += '<p class="text-secondary small">You don\'t have any completed swaps yet. Once a swap is completed by both partners, you\'ll see who you taught, what you learned, and how you\'re connected to the wider community.</p>';
    } else {
      html += '<p class="text-secondary small mb-3">You\'ve completed swaps with <strong>' + direct.length + "</strong> " + (direct.length === 1 ? "person" : "people") +
        (wider.length ? ", who connect you to <strong>" + wider.length + "</strong> more " + (wider.length === 1 ? "member" : "members") : "") +
        ". Select anyone on the map to see your exchanges and how you're connected.</p>" +
        '<ul class="np-legend"><li><i class="lg lg-teach"></i><span><strong>Blue arrows</strong> point to people you taught, labelled with the skill.</span></li>' +
        '<li><i class="lg lg-learn"></i><span><strong>Purple arrows</strong> point back to you with what you learned.</span></li>' +
        '<li><i class="lg lg-other"></i><span><strong>Dashed lines</strong> are swaps between other members.</span></li>' +
        '<li><i class="bi bi-arrow-right text-muted"></i><span>A single arrow means a <strong>one-way</strong> swap: nothing was offered in return.</span></li></ul>';
    }
    if (truncated) html += '<p class="hint mb-0 mt-2"><i class="bi bi-info-circle"></i> Your network is very large, so only the closest people are shown.</p>';
    html += "</div>" + finderHtml();
    panel.innerHTML = html + routeHtml();
    bindFinder();
  }

  // "Find a connection" — people in the network plus people you know from matches / requests.
  function finderHtml() {
    const inNet = Array.from(nodes.values()).filter(function (n) { return !isMe(n.userId); })
      .sort(function (a, b) { return a.hops - b.hops || String(a.name).localeCompare(String(b.name)); });
    const outside = (others || []).filter(function (p) { return !nodes.has(Number(p.userId)) && !isMe(p.userId); });
    if (!inNet.length && !outside.length) return "";
    const opt = function (p, extra) { return '<option value="' + esc(p.userId) + '">' + esc(p.name) + (extra ? " · " + esc(extra) : "") + "</option>"; };
    return '<div class="card-body border-top">' +
      '<div class="np-title"><i class="bi bi-signpost-split"></i>Find a connection</div>' +
      '<p class="hint mb-2">See how you\'re linked to someone through completed swaps.</p>' +
      '<select class="form-select mb-2" id="finderSelect" aria-label="Choose a member"><option value="">Choose a person…</option>' +
        (inNet.length ? '<optgroup label="In your network">' + inNet.map(function (n) { return opt(n, n.hops === 1 ? "direct partner" : n.hops + " swaps away"); }).join("") + "</optgroup>" : "") +
        (outside.length ? '<optgroup label="Other people you know">' + outside.map(function (p) { return opt(p, p.why); }).join("") + "</optgroup>" : "") +
      "</select>" +
      '<div class="d-flex gap-2 flex-wrap"><button type="button" class="btn btn-primary btn-sm flex-grow-1" data-find="chain"><i class="bi bi-lightning-charge"></i>Shortest connection</button>' +
      '<button type="button" class="btn btn-light btn-sm flex-grow-1" data-find="path"><i class="bi bi-signpost-2"></i>Explore a learning path</button></div></div>';
  }

  function bindFinder() {
    panel.querySelectorAll("[data-find]").forEach(function (b) {
      b.addEventListener("click", function () {
        const sel = document.getElementById("finderSelect");
        const id = Number(sel.value);
        if (!id) { sel.classList.add("is-invalid"); sel.focus(); return; }
        sel.classList.remove("is-invalid");
        if (nodes.has(id)) { selected = id; }
        findRoute(id, b.getAttribute("data-find"));
      });
    });
  }

  function renderPerson(id) {
    const n = nodes.get(id);
    if (!n) { renderOverview(); return; }
    let html = '<div class="card-body">' + personHead(n);

    if (isMe(id)) {
      const conns = connectionsOf(id);
      html += '<div class="np-title mt-3"><i class="bi bi-people"></i>Your swap partners</div><ul class="np-conns">' +
        conns.map(function (c) {
          return '<li data-goto="' + c.other + '">' + UI.avatar(nodes.get(c.other), "avatar-sm") + '<div class="min-w-0"><div class="fw-semibold truncate">' + esc(nameOf(c.other)) + "</div>" +
            '<div class="np-mini">' + esc(exchangeText("You", c.theyTaught, c.otherTaught)) + "</div></div></li>";
        }).join("") + "</ul></div>";
      panel.innerHTML = html + routeHtml();
      bindPanel();
      return;
    }

    if (n.hops === 1) {
      const ex = exchangeWith(id);
      html += '<div class="np-exchange">' +
        '<div class="np-ex-row ex-teach"><span class="np-ex-label"><i class="bi bi-arrow-right"></i>You teach ' + esc(n.name) + "</span>" + chips(ex.iTeach, "teach") + "</div>" +
        '<div class="np-ex-row ex-learn"><span class="np-ex-label"><i class="bi bi-arrow-left"></i>You learn from ' + esc(n.name) + "</span>" + chips(ex.iLearn, "learn") + "</div>" +
        '<div class="np-mini mt-2">' + ex.swaps.length + " completed " + (ex.swaps.length === 1 ? "swap" : "swaps") + " · " +
          esc(ex.swaps.map(function (s) { return isMe(s.senderId) ? "you sent the request" : "they sent the request"; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(", ")) + "</div>" +
        "</div>";
    } else {
      const via = Array.from(neighbours.get(id)).filter(function (o) { return nodes.get(o).hops === n.hops - 1; });
      html += '<p class="small text-secondary mt-3 mb-0">You haven\'t swapped with ' + esc(n.name) + " directly. You're connected through " +
        via.map(function (v) { return "<strong>" + esc(nameOf(v)) + "</strong>"; }).join(", ") + ".</p>";
    }

    const conns = connectionsOf(id).filter(function (c) { return !isMe(c.other); });
    if (conns.length) {
      html += '<div class="np-title mt-3"><i class="bi bi-share"></i>' + esc(n.name) + "'s other swaps</div><ul class=\"np-conns\">" +
        conns.map(function (c) {
          return '<li data-goto="' + c.other + '">' + UI.avatar(nodes.get(c.other), "avatar-sm") + '<div class="min-w-0"><div class="fw-semibold truncate">' + esc(nameOf(c.other)) + "</div>" +
            '<div class="np-mini">' + esc(exchangeText(n.name, c.theyTaught, c.otherTaught)) + "</div></div></li>";
        }).join("") + "</ul>";
    }

    html += '<div class="np-actions">' +
      '<button type="button" class="btn btn-primary" data-route="chain"><i class="bi bi-lightning-charge"></i>Shortest connection</button>' +
      '<button type="button" class="btn btn-light" data-route="path"><i class="bi bi-signpost-2"></i>Explore a learning path</button>' +
      '<button type="button" class="btn btn-link btn-sm px-0" data-route="both">Compare both routes</button>' +
      "</div>" +
      '<div class="np-links"><button type="button" class="btn btn-outline-primary btn-sm" data-profile><i class="bi bi-person-vcard"></i>View profile</button>' +
      (n.hops === 1 ? '<a class="btn btn-light btn-sm" href="/my-swaps.html#partner-' + id + '"><i class="bi bi-patch-check"></i>Open in My Swaps</a>' : "") +
      "</div></div>";

    panel.innerHTML = html + routeHtml();
    bindPanel();
  }

  function bindPanel() {
    panel.querySelectorAll("[data-goto]").forEach(function (li) {
      li.tabIndex = 0;
      li.setAttribute("role", "button");
      const go = function () { select(Number(li.getAttribute("data-goto"))); };
      li.addEventListener("click", go);
      li.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    });
    panel.querySelectorAll("[data-route]").forEach(function (b) {
      b.addEventListener("click", function () { findRoute(selected, b.getAttribute("data-route")); });
    });
    const prof = panel.querySelector("[data-profile]");
    if (prof) prof.addEventListener("click", function () { openProfile(selected, prof); });
    panel.querySelectorAll("[data-show-route]").forEach(function (b) {
      b.addEventListener("click", function () {
        const r = routeResults && routeResults[b.getAttribute("data-show-route")];
        if (r && r.found) { route = { users: r.users, kind: b.getAttribute("data-show-route") }; applyState(); renderPanel(); }
      });
    });
    bindFinder();
  }

  function renderPanel() {
    if (selected != null && nodes.has(selected)) renderPerson(selected);
    else renderOverview();
  }

  // ---------- Routes (server BFS / DFS) ----------
  // One step of a route, from the swap records the server returned with
  // it. The receiver taught the requested skill; the requester taught the
  // offered skill, if there was one.
  function describeStep(step, names) {
    if (!step || !step.swaps || !step.swaps.length) return '<span class="np-mini">Completed swap</span>';
    const nm = function (id) { return isMe(id) ? "You" : names[id] || nameOf(id); };
    return step.swaps.map(function (s) {
      return '<span class="np-mini">' + esc(nm(s.receiverId)) + " taught " + UI.chip(s.requestedSkill, "teach") +
        (s.offeredSkill ? " · " + esc(nm(s.senderId)) + " taught " + UI.chip(s.offeredSkill, "teach") : " · one-way") +
        ' <span class="text-muted">(' + esc(nm(s.senderId)) + " sent the request)</span></span>";
    }).join("");
  }

  function routeCard(kind, r) {
    const title = kind === "chain" ? "Shortest connection" : "A learning path";
    const icon = kind === "chain" ? "bi-lightning-charge" : "bi-signpost-2";
    const showing = route && route.kind === kind;
    if (!r.found) return "";
    const users = r.users;
    const names = {};
    users.forEach(function (u) { names[u.userId] = u.name; });
    let steps = "";
    users.forEach(function (u, i) {
      steps += '<li class="rs-person"><span class="rs-num">' + (i + 1) + "</span>" + UI.avatar(nodes.get(Number(u.userId)) || u, "avatar-sm") +
        '<span class="fw-semibold truncate">' + esc(isMe(u.userId) ? "You" : u.name) + "</span></li>";
      if (i + 1 < users.length) steps += '<li class="rs-hop"><i class="bi bi-arrow-down"></i><div>' + describeStep((r.steps || [])[i], names) + "</div></li>";
    });
    return '<div class="route-card' + (showing ? " is-showing" : "") + '">' +
      '<div class="route-head"><span><i class="bi ' + icon + '"></i>' + title + '</span><span class="route-len">' + r.chainLength + " " + (r.chainLength === 1 ? "swap" : "swaps") + "</span></div>" +
      '<ol class="route-steps">' + steps + "</ol>" +
      (routeResults.kind === "both" && !showing ? '<button type="button" class="btn btn-light btn-sm w-100 mt-2" data-show-route="' + kind + '"><i class="bi bi-eye"></i>Show on map</button>' : "") +
      "</div>";
  }

  function routeHtml() {
    if (!routeResults) return "";
    const rr = routeResults;
    const targetName = nodes.has(rr.targetId) ? nameOf(rr.targetId) : rr.targetName || "this member";
    let body = "";
    if (rr.loading) {
      body = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div><div class="hint mt-2">Finding a connection…</div></div>';
    } else if (rr.error) {
      body = '<div class="alert alert-danger mb-0 py-2 small">' + esc(rr.error) + "</div>";
    } else {
      const results = [["chain", rr.chain], ["path", rr.path]].filter(function (x) { return x[1]; });
      const anyFound = results.some(function (x) { return x[1].found; });
      if (!anyFound) {
        body = '<div class="route-none"><i class="bi bi-signpost"></i><div><strong>No connection to ' + esc(targetName) + " yet.</strong> " +
          "You aren't linked through any chain of completed swaps.</div></div>";
      } else {
        if (rr.kind === "both" && rr.chain && rr.path) {
          const same = rr.chain.found && rr.path.found && rr.chain.users.map(function (u) { return u.userId; }).join() === rr.path.users.map(function (u) { return u.userId; }).join();
          body += '<p class="small text-secondary mb-2">' + (same
            ? "Both ways of exploring found the same route."
            : "The shortest connection takes " + rr.chain.chainLength + " " + (rr.chain.chainLength === 1 ? "swap" : "swaps") + "; exploring one branch at a time found a " + rr.path.chainLength + "-swap path.") + "</p>";
        }
        body += results.map(function (x) { return routeCard(x[0], x[1]); }).join("");
      }
    }
    return '<div class="card-body border-top np-route"><div class="np-title"><i class="bi bi-bezier2"></i>Route to ' + esc(targetName) + "</div>" + body + "</div>";
  }

  async function findRoute(targetId, kind) {
    if (!targetId || isMe(targetId)) return;
    const known = (others || []).find(function (p) { return Number(p.userId) === Number(targetId); });
    routeResults = { targetId: Number(targetId), kind: kind, loading: true, targetName: known ? known.name : "" };
    route = null;
    applyState();
    renderPanel();
    try {
      const calls = kind === "both" ? [API.getLearningChain(targetId), API.getLearningPath(targetId)]
        : [kind === "chain" ? API.getLearningChain(targetId) : API.getLearningPath(targetId)];
      const res = await Promise.all(calls);
      routeResults.loading = false;
      if (kind === "both") { routeResults.chain = res[0]; routeResults.path = res[1]; }
      else routeResults[kind] = res[0];
      const first = kind === "path" ? routeResults.path : routeResults.chain;
      const shown = first && first.found ? first : (routeResults.path && routeResults.path.found ? routeResults.path : null);
      if (shown) {
        route = { users: shown.users, kind: shown === routeResults.chain ? "chain" : "path" };
        const last = shown.users[shown.users.length - 1];
        if (!routeResults.targetName && last) routeResults.targetName = last.name;
      }
    } catch (e) {
      routeResults.loading = false;
      routeResults.error = e.message;
    }
    applyState();
    renderPanel();
    if (window.matchMedia("(max-width: 1199.98px)").matches) panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---------- Selection ----------
  function select(id) {
    if (id === selected && !route) return;
    selected = id;
    route = null;
    if (!routeResults || routeResults.targetId !== id) routeResults = null;
    applyState();
    renderPanel();
    if (window.matchMedia("(max-width: 1199.98px)").matches) panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function reset() {
    selected = null;
    route = null;
    routeResults = null;
    applyState();
    renderPanel();
  }

  // Profiles are loaded by ID (GET /api/users/{id}).
  async function openProfile(id, btn) {
    let user = null;
    UI.setLoading(btn, true);
    try { user = await Components.getPerson(id); } catch (e) { user = null; }
    UI.setLoading(btn, false);
    if (!user) { UI.toast("This member's profile isn't available right now.", "info"); return; }
    const n = nodes.get(Number(id));
    let rel = "";
    if (n && n.hops === 1) {
      const ex = exchangeWith(id);
      rel = '<div class="np-exchange"><div class="np-ex-row ex-teach"><span class="np-ex-label"><i class="bi bi-arrow-right"></i>You taught</span>' + chips(ex.iTeach, "teach") + "</div>" +
        '<div class="np-ex-row ex-learn"><span class="np-ex-label"><i class="bi bi-arrow-left"></i>You learned</span>' + chips(ex.iLearn, "learn") + "</div></div>";
    }
    const my = await Components.getMySkills().catch(function () { return null; });
    Components.openProfileModal(user, { mySkills: my, tagline: esc(relationLabel(id)), relationshipHtml: rel });
  }

  // ---------- Lists under the map ----------
  function renderLists() {
    if (nodes.size <= 1) { lists.innerHTML = ""; return; }
    const direct = Array.from(nodes.values()).filter(function (n) { return n.hops === 1; })
      .sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    const widerPairs = Array.from(pairs.values()).filter(function (p) { return !isMe(p.a) && !isMe(p.b); })
      .sort(function (x, y) { return Math.max(nodes.get(x.a).hops, nodes.get(x.b).hops) - Math.max(nodes.get(y.a).hops, nodes.get(y.b).hops); });

    let html = '<h2 class="section-title"><i class="bi bi-people text-primary"></i>Your swap partners <span class="count">' + direct.length + "</span></h2>" +
      '<div class="row g-3 mb-4">' + direct.map(function (n) {
        const ex = exchangeWith(n.userId);
        return '<div class="col-md-6 col-xxl-4"><div class="card net-rel" data-goto-node="' + n.userId + '" tabindex="0" role="button" aria-label="Show ' + esc(n.name) + ' on the map">' +
          '<div class="net-rel-head"><span class="net-rel-pair"><span class="you-dot">You</span><i class="bi bi-arrow-left-right"></i></span>' + UI.avatar(n, "avatar-md") +
          '<div class="min-w-0"><div class="fw-semibold truncate">' + esc(n.name) + '</div><div class="np-mini">' + ex.swaps.length + " completed " + (ex.swaps.length === 1 ? "swap" : "swaps") + "</div></div></div>" +
          '<div class="np-ex-row ex-teach"><span class="np-ex-label"><i class="bi bi-arrow-right"></i>You teach</span>' + chips(ex.iTeach, "teach") + "</div>" +
          '<div class="np-ex-row ex-learn"><span class="np-ex-label"><i class="bi bi-arrow-left"></i>You learn</span>' + chips(ex.iLearn, "learn") + "</div>" +
          "</div></div>";
      }).join("") + "</div>";

    if (widerPairs.length) {
      html += '<h2 class="section-title"><i class="bi bi-share text-primary"></i>Wider network <span class="count">' + widerPairs.length + "</span></h2>" +
        '<p class="hint mt-n2 mb-3">Completed swaps between the people you\'re connected to.</p>' +
        '<div class="card"><ul class="net-wide">' + widerPairs.map(function (p) {
          const far = nodes.get(p.a).hops >= nodes.get(p.b).hops ? p.a : p.b;
          const aT = distinct(p.swaps.map(function (s) { return taughtBy(s, p.a); }));
          const bT = distinct(p.swaps.map(function (s) { return taughtBy(s, p.b); }));
          return '<li data-goto-node="' + far + '" tabindex="0" role="button">' +
            '<div class="net-wide-people">' + UI.avatar(nodes.get(p.a), "avatar-sm") + '<i class="bi bi-arrow-left-right"></i>' + UI.avatar(nodes.get(p.b), "avatar-sm") + "</div>" +
            '<div class="min-w-0 flex-grow-1"><div class="fw-semibold truncate">' + esc(nameOf(p.a)) + " &amp; " + esc(nameOf(p.b)) + "</div>" +
            '<div class="np-mini">' + esc(exchangeText(nameOf(p.a), aT, bT)) + "</div></div>" +
            '<span class="np-rel rel-wide d-none d-sm-inline-flex">' + (Math.max(nodes.get(p.a).hops, nodes.get(p.b).hops) === 1 ? "Between your partners" : Math.max(nodes.get(p.a).hops, nodes.get(p.b).hops) + " swaps away") + "</span></li>";
        }).join("") + "</ul></div>";
    }
    lists.innerHTML = html;
  }

  function renderSummary() {
    const box = document.getElementById("netSummary");
    const direct = Array.from(nodes.values()).filter(function (n) { return n.hops === 1; }).length;
    const wider = Array.from(nodes.values()).filter(function (n) { return n.hops > 1; }).length;
    const mine = swaps.filter(function (s) { return isMe(s.senderId) || isMe(s.receiverId); });
    const taught = distinct(mine.map(function (s) { return taughtBy(s, me.userId); })).length;
    const learned = distinct(mine.map(function (s) { return isMe(s.senderId) ? s.requestedSkill : s.offeredSkill; })).length;
    const item = function (icon, cls, value, text) {
      return '<div class="net-stat"><span class="net-stat-icon ' + cls + '"><i class="bi ' + icon + '"></i></span><div><div class="net-stat-value">' + value + '</div><div class="net-stat-label">' + text + "</div></div></div>";
    };
    box.innerHTML = item("bi-people", "blue", direct, direct === 1 ? "Swap partner" : "Swap partners") +
      item("bi-share", "violet", wider, "Wider connections") +
      item("bi-easel", "teach", taught, "Skills you taught") +
      item("bi-book", "learn", learned, "Skills you learned");
  }

  // ---------- Loading ----------
  async function loadOthers() {
    const res = await Promise.allSettled([API.getMatches(), API.getSentRequests(), API.getReceivedRequests()]);
    const map = new Map();
    if (res[0].status === "fulfilled") {
      Components.remember(res[0].value);
      (res[0].value || []).forEach(function (u) { map.set(Number(u.userId), { userId: u.userId, name: u.name, why: "match" }); });
    }
    [1, 2].forEach(function (i) {
      if (res[i].status !== "fulfilled") return;
      (res[i].value || []).forEach(function (r) {
        const p = UI.perspective(r, me.userId);
        if (!map.has(Number(p.partnerId))) map.set(Number(p.partnerId), { userId: p.partnerId, name: p.partnerName, why: "request" });
      });
    });
    others = Array.from(map.values()).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
  }

  async function load() {
    canvas.innerHTML = '<div class="net-loading"><div class="spinner-border text-primary" role="status"></div><div class="hint mt-2">Loading your network…</div></div>';
    panel.innerHTML = '<div class="card-body">' + UI.skeletonRows(3) + "</div>";
    try {
      const network = await API.getLearningNetwork(depth);
      index(network);
      await loadOthers();
      renderSummary();
      renderMap();
      renderLists();

      const target = Number(UI.qs("targetId"));
      if (target && !isMe(target)) {
        // Linked from another page: make sure that person is on the map.
        if (!nodes.has(target) && depth !== "all") {
          depth = "all";
          syncDepth();
          return load();
        }
        if (nodes.has(target)) selected = target;
        renderPanel();
        findRoute(target, "chain");
      } else {
        renderPanel();
      }
    } catch (e) {
      canvas.innerHTML = "";
      UI.renderError(canvas, e, load);
      panel.innerHTML = "";
    }
  }

  // ---------- Events ----------
  canvas.addEventListener("click", function (e) {
    const g = e.target.closest(".gnode");
    if (g) select(Number(g.getAttribute("data-uid")));
    else if (selected != null || route) reset();
  });
  canvas.addEventListener("keydown", function (e) {
    const g = e.target.closest(".gnode");
    if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); select(Number(g.getAttribute("data-uid"))); }
    if (e.key === "Escape") reset();
  });
  lists.addEventListener("click", function (e) {
    const c = e.target.closest("[data-goto-node]");
    if (c) { select(Number(c.getAttribute("data-goto-node"))); canvas.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
  });
  lists.addEventListener("keydown", function (e) {
    const c = e.target.closest("[data-goto-node]");
    if (c && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); select(Number(c.getAttribute("data-goto-node"))); }
  });
  resetBtn.addEventListener("click", reset);
  document.getElementById("refreshBtn").addEventListener("click", function () { selected = null; route = null; routeResults = null; load(); });

  // How far to explore: direct partners, 2, 3 or every reachable person.
  const depthBox = document.getElementById("depthFilter");
  function syncDepth() {
    depthBox.querySelectorAll("[data-depth]").forEach(function (b) {
      const on = b.getAttribute("data-depth") === depth;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
  depthBox.addEventListener("click", function (e) {
    const b = e.target.closest("[data-depth]");
    if (!b || b.getAttribute("data-depth") === depth) return;
    depth = b.getAttribute("data-depth");
    syncDepth();
    const url = new URL(window.location.href);
    url.searchParams.set("depth", depth);
    url.searchParams.delete("targetId");
    window.history.replaceState({}, "", url.pathname + url.search);
    selected = null; route = null; routeResults = null;
    load();
  });
  syncDepth();

  App.ready.then(function (user) { me = user; load(); });
})();
