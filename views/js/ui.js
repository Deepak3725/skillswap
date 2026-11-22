/* ==========================================================================
   SkillSwap — UI helpers shared by every page
   ========================================================================== */
(function () {
  "use strict";

  // ---------- Text & HTML ----------
  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function initials(name) {
    const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    const first = parts[0][0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
  }

  const AVATAR_COLORS = ["#2563eb", "#7c3aed", "#0891b2", "#059669", "#d97706", "#db2777", "#4f46e5", "#0d9488"];
  function colorFor(seed) {
    const s = String(seed || "");
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }

  // Profile pictures are stored by the backend as a string: a data URL
  // (uploaded through this frontend), an absolute URL, or a server path.
  function safeImageSrc(src) {
    if (!src || typeof src !== "string") return "";
    const v = src.trim();
    if (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(v)) return v;
    if (/^https?:\/\//i.test(v)) return v;
    if (/^\/?images\/[\w\-./]+$/i.test(v)) return v.charAt(0) === "/" ? v : "/" + v;
    return "";
  }

  function avatar(user, sizeClass) {
    const u = user || {};
    const cls = "avatar" + (sizeClass ? " " + sizeClass : "");
    const src = safeImageSrc(u.profilePicture);
    const name = escapeHtml(u.name || "User");
    if (src) return '<img class="' + cls + '" src="' + escapeHtml(src) + '" alt="' + name + '">';
    return '<span class="' + cls + '" style="background:' + colorFor(u.userId || u.name) + '" aria-hidden="true">' + escapeHtml(initials(u.name)) + "</span>";
  }

  // ---------- Skills ----------
  function norm(s) { return String(s || "").trim().toLowerCase(); }
  function hasSkill(list, skill) {
    const n = norm(skill);
    return (list || []).some(function (x) { return norm(x) === n; });
  }

  // A skill chip, or a muted note when there is no skill (one-way request).
  function skillChip(name, variant, noneText) {
    if (!name) return '<span class="chip chip-none"><span>' + escapeHtml(noneText || "Nothing offered") + "</span></span>";
    return chip(name, variant);
  }

  function chip(name, variant, extra) {
    const cls = "chip" + (variant ? " chip-" + variant : "");
    return '<span class="' + cls + '"' + (extra || "") + '><span>' + escapeHtml(name) + "</span></span>";
  }

  // highlightAgainst: skills that should be marked as a "match"
  function chipList(skills, variant, highlightAgainst, emptyText) {
    if (!skills || !skills.length) {
      return '<span class="hint">' + escapeHtml(emptyText || "None listed") + "</span>";
    }
    return '<div class="chip-list">' + skills.map(function (s) {
      const isMatch = highlightAgainst && hasSkill(highlightAgainst, s);
      return chip(s, isMatch ? "match" : variant, isMatch ? ' title="Matches your skills"' : "");
    }).join("") + "</div>";
  }

  // ---------- States ----------
  function stateBlock(kind, icon, title, text, actionHtml, compact) {
    return '<div class="state ' + (kind || "") + (compact ? " compact" : "") + '">' +
      '<div class="state-icon"><i class="bi ' + icon + '"></i></div>' +
      "<h3>" + escapeHtml(title) + "</h3>" +
      (text ? "<p>" + escapeHtml(text) + "</p>" : "") +
      (actionHtml || "") + "</div>";
  }
  function emptyState(icon, title, text, actionHtml, compact) { return stateBlock("", icon, title, text, actionHtml, compact); }
  function errorState(message, compact) {
    return stateBlock("error", "bi-exclamation-octagon", "Something went wrong", message,
      '<button type="button" class="btn btn-light btn-sm" data-retry><i class="bi bi-arrow-clockwise"></i>Try again</button>', compact);
  }

  // Render an error with a working "Try again" button.
  function renderError(container, error, retry, compact) {
    container.innerHTML = errorState(error && error.message ? error.message : String(error), compact);
    const btn = container.querySelector("[data-retry]");
    if (btn && retry) btn.addEventListener("click", retry);
  }

  function skeletonRows(count, withAvatar) {
    let html = "";
    for (let i = 0; i < (count || 3); i++) {
      html += '<div class="list-row">' +
        (withAvatar === false ? "" : '<div class="skeleton skeleton-circle" style="width:40px;height:40px"></div>') +
        '<div class="flex-grow-1"><div class="skeleton skeleton-line" style="width:45%"></div>' +
        '<div class="skeleton skeleton-line mb-0" style="width:70%"></div></div></div>';
    }
    return html;
  }

  function skeletonCards(count, colClass) {
    let html = "";
    for (let i = 0; i < (count || 3); i++) {
      html += '<div class="' + (colClass || "col-md-6 col-xl-4") + '"><div class="card user-card">' +
        '<div class="d-flex gap-3 align-items-center"><div class="skeleton skeleton-circle" style="width:48px;height:48px"></div>' +
        '<div class="flex-grow-1"><div class="skeleton skeleton-line" style="width:60%"></div><div class="skeleton skeleton-line mb-0" style="width:35%"></div></div></div>' +
        '<div class="skeleton skeleton-line" style="width:90%"></div><div class="skeleton skeleton-line" style="width:70%"></div>' +
        '<div class="skeleton" style="height:34px"></div></div></div>';
    }
    return html;
  }

  // ---------- Buttons ----------
  function setLoading(button, loading, loadingText) {
    if (!button) return;
    if (loading) {
      if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
      button.disabled = true;
      button.innerHTML = '<span class="spinner-border" role="status" aria-hidden="true"></span>' +
        (loadingText ? "<span>" + escapeHtml(loadingText) + "</span>" : "");
    } else {
      button.disabled = false;
      if (button.dataset.originalHtml) {
        button.innerHTML = button.dataset.originalHtml;
        delete button.dataset.originalHtml;
      }
    }
  }

  // ---------- Toasts ----------
  function toast(message, type) {
    let stack = document.getElementById("toastStack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "toastStack";
      stack.className = "toast-stack";
      stack.setAttribute("aria-live", "polite");
      document.body.appendChild(stack);
    }
    const kind = type || "success";
    const icon = kind === "error" ? "bi-x-circle-fill" : kind === "info" ? "bi-info-circle-fill" : "bi-check-circle-fill";
    const el = document.createElement("div");
    el.className = "ss-toast " + kind;
    el.setAttribute("role", kind === "error" ? "alert" : "status");
    el.innerHTML = '<i class="bi ' + icon + '"></i><div>' + escapeHtml(message) + '</div>' +
      '<button type="button" class="toast-close" aria-label="Dismiss"><i class="bi bi-x"></i></button>';
    stack.appendChild(el);
    const remove = function () { if (el.parentNode) el.parentNode.removeChild(el); };
    el.querySelector(".toast-close").addEventListener("click", remove);
    setTimeout(remove, kind === "error" ? 6500 : 4200);
  }

  function showAlert(container, message, type) {
    if (!container) return;
    if (!message) { container.innerHTML = ""; return; }
    const kind = type || "danger";
    const icon = kind === "success" ? "bi-check-circle-fill" : kind === "info" ? "bi-info-circle-fill" : "bi-exclamation-triangle-fill";
    container.innerHTML = '<div class="alert alert-' + kind + ' mb-3" role="alert"><i class="bi ' + icon + '"></i><div>' + escapeHtml(message) + "</div></div>";
  }

  // ---------- Dates ----------
  // The backend serialises java.sql.Timestamp with Gson's default format,
  // e.g. "Nov 22, 2026, 2:50:11 AM" (wall-clock time of the server JVM).
  const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  function parseDate(value) {
    if (value == null || value === "") return null;
    if (typeof value === "number") return new Date(value);
    const s = String(value).replace(/[  ]/g, " ").trim();
    const m = s.match(/^([A-Za-z]{3})[a-z]*\.? (\d{1,2}), (\d{4}),? (\d{1,2}):(\d{2})(?::(\d{2}))? ?([AP]M)$/i);
    if (m && MONTHS[m[1].toLowerCase()] !== undefined) {
      let hour = parseInt(m[4], 10) % 12;
      if (m[7].toUpperCase() === "PM") hour += 12;
      return new Date(parseInt(m[3], 10), MONTHS[m[1].toLowerCase()], parseInt(m[2], 10), hour, parseInt(m[5], 10), parseInt(m[6] || "0", 10));
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatDate(value, withTime) {
    const d = parseDate(value);
    if (!d) return "";
    const opts = { year: "numeric", month: "short", day: "numeric" };
    if (withTime) { opts.hour = "numeric"; opts.minute = "2-digit"; }
    return d.toLocaleString(undefined, opts);
  }

  function timeAgo(value) {
    const d = parseDate(value);
    if (!d) return "";
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < -60) return formatDate(value, true);
    if (diff < 60) return "Just now";
    if (diff < 3600) return Math.floor(diff / 60) + " min ago";
    if (diff < 86400) { const h = Math.floor(diff / 3600); return h + (h === 1 ? " hour ago" : " hours ago"); }
    if (diff < 86400 * 7) { const dd = Math.floor(diff / 86400); return dd === 1 ? "Yesterday" : dd + " days ago"; }
    return formatDate(value);
  }

  // ---------- Request status ----------
  const STATUS_LABELS = { PENDING: "Pending", ACCEPTED: "Accepted", REJECTED: "Rejected", CANCELLED: "Cancelled", COMPLETED: "Completed" };
  function statusBadge(status) {
    const s = String(status || "").toUpperCase();
    return '<span class="status status-' + escapeHtml(s.toLowerCase()) + '">' + escapeHtml(STATUS_LABELS[s] || s || "Unknown") + "</span>";
  }

  // Describe a swap request from the logged-in user's point of view.
  // Sender teaches offeredSkill and learns requestedSkill.
  function perspective(request, myUserId) {
    const iAmSender = Number(request.senderId) === Number(myUserId);
    return {
      iAmSender: iAmSender,
      partnerId: iAmSender ? request.receiverId : request.senderId,
      partnerName: iAmSender ? request.receiverName : request.senderName,
      iTeach: iAmSender ? request.offeredSkill : request.requestedSkill,
      iLearn: iAmSender ? request.requestedSkill : request.offeredSkill,
      // The partner always teaches the skill the current user learns.
      partnerTeaches: iAmSender ? request.requestedSkill : request.offeredSkill
    };
  }

  // ---------- Contact info ----------
  function contactItems(user) {
    const u = user || {};
    const items = [];
    if (u.whatsapp) {
      const digits = String(u.whatsapp).replace(/[^\d]/g, "");
      items.push({ icon: "bi-whatsapp", label: "WhatsApp", value: u.whatsapp, href: digits ? "https://wa.me/" + digits : "" });
    }
    if (u.telegram) {
      const handle = String(u.telegram).replace(/^@/, "").trim();
      items.push({ icon: "bi-telegram", label: "Telegram", value: "@" + handle, href: /^[A-Za-z0-9_]{3,}$/.test(handle) ? "https://t.me/" + handle : "" });
    }
    if (u.email) items.push({ icon: "bi-envelope", label: "Email", value: u.email, href: "mailto:" + u.email });
    return items;
  }

  function contactInline(user) {
    const items = contactItems(user);
    if (!items.length) return '<span class="hint">No contact details shared.</span>';
    return items.map(function (it) {
      const val = it.href
        ? '<a href="' + escapeHtml(it.href) + '" target="_blank" rel="noopener">' + escapeHtml(it.value) + "</a>"
        : escapeHtml(it.value);
      return '<span class="contact-item"><i class="bi ' + it.icon + '"></i><span class="text-muted">' + it.label + ':</span> ' + val + "</span>";
    }).join("");
  }

  // ---------- Confirm dialog (Bootstrap modal) ----------
  function confirmDialog(opts) {
    const o = opts || {};
    return new Promise(function (resolve) {
      const wrap = document.createElement("div");
      wrap.innerHTML =
        '<div class="modal fade" tabindex="-1" aria-hidden="true"><div class="modal-dialog modal-dialog-centered"><div class="modal-content">' +
        '<div class="modal-header"><h5 class="modal-title">' + escapeHtml(o.title || "Are you sure?") + '</h5>' +
        '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>' +
        '<div class="modal-body"><p class="mb-0 text-secondary">' + escapeHtml(o.message || "") + "</p></div>" +
        '<div class="modal-footer"><button type="button" class="btn btn-light" data-bs-dismiss="modal">' + escapeHtml(o.cancelText || "Cancel") + "</button>" +
        '<button type="button" class="btn ' + (o.danger ? "btn-danger" : "btn-primary") + '" data-confirm>' + escapeHtml(o.confirmText || "Confirm") + "</button></div>" +
        "</div></div></div>";
      const modalEl = wrap.firstChild;
      document.body.appendChild(modalEl);
      const modal = new bootstrap.Modal(modalEl);
      let result = false;
      modalEl.querySelector("[data-confirm]").addEventListener("click", function () { result = true; modal.hide(); });
      modalEl.addEventListener("hidden.bs.modal", function () { modal.dispose(); modalEl.remove(); resolve(result); });
      modal.show();
    });
  }

  // ---------- Image processing for profile pictures ----------
  // The backend stores profile_picture as TEXT. We resize and compress the
  // chosen image to a small square JPEG data URL before sending it.
  const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

  function validateImage(file) {
    if (!file) return "No file selected.";
    if (IMAGE_TYPES.indexOf(file.type) === -1) return "Please choose a JPG, PNG, WEBP or GIF image.";
    if (file.size > MAX_IMAGE_BYTES) return "Image must be 5 MB or smaller.";
    return null;
  }

  function processImage(file, size) {
    const target = size || 320;
    return new Promise(function (resolve, reject) {
      const error = validateImage(file);
      if (error) { reject(new Error(error)); return; }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        try {
          const side = Math.min(img.naturalWidth, img.naturalHeight);
          if (!side) throw new Error("This image could not be read.");
          const sx = (img.naturalWidth - side) / 2;
          const sy = (img.naturalHeight - side) / 2;
          const out = Math.min(target, side);
          const canvas = document.createElement("canvas");
          canvas.width = out; canvas.height = out;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, out, out);
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
          resolve(canvas.toDataURL("image/jpeg", 0.86));
        } catch (e) { reject(e); } finally { URL.revokeObjectURL(url); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("This file is not a valid image.")); };
      img.src = url;
    });
  }

  // Circular avatar picker with camera badge, change and remove actions.
  // root must contain: [data-avatar-preview], input[type=file], [data-avatar-change], [data-avatar-remove], [data-avatar-error]
  function AvatarUploader(root, initialValue) {
    const preview = root.querySelector("[data-avatar-preview]");
    const input = root.querySelector('input[type="file"]');
    const changeBtn = root.querySelector("[data-avatar-change]");
    const removeBtn = root.querySelector("[data-avatar-remove]");
    const errorEl = root.querySelector("[data-avatar-error]");
    let value = initialValue || "";

    function render() {
      const src = safeImageSrc(value);
      preview.classList.toggle("has-image", !!src);
      preview.innerHTML = (src ? '<img src="' + escapeHtml(src) + '" alt="Profile picture preview">' : '<i class="bi bi-person placeholder-icon"></i>') +
        '<span class="avatar-uploader-camera"><i class="bi bi-camera-fill"></i></span>';
      if (removeBtn) removeBtn.hidden = !src;
      if (changeBtn) changeBtn.innerHTML = '<i class="bi bi-upload"></i>' + (src ? "Change photo" : "Upload photo");
    }
    function setError(msg) {
      if (!errorEl) return;
      errorEl.textContent = msg || "";
      errorEl.hidden = !msg;
    }
    async function handleFile(file) {
      setError("");
      try {
        value = await processImage(file);
        render();
      } catch (e) {
        setError(e.message);
      } finally {
        input.value = "";
      }
    }
    const open = function () { input.click(); };
    preview.addEventListener("click", open);
    preview.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    if (changeBtn) changeBtn.addEventListener("click", open);
    if (removeBtn) removeBtn.addEventListener("click", function () { value = ""; setError(""); render(); });
    input.addEventListener("change", function () { if (input.files && input.files[0]) handleFile(input.files[0]); });
    root.addEventListener("dragover", function (e) { e.preventDefault(); root.classList.add("is-dragover"); });
    root.addEventListener("dragleave", function () { root.classList.remove("is-dragover"); });
    root.addEventListener("drop", function (e) {
      e.preventDefault(); root.classList.remove("is-dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
    render();

    return {
      getValue: function () { return value; },
      setValue: function (v) { value = v || ""; setError(""); render(); }
    };
  }

  // Wire a live character counter: <textarea maxlength> + [data-count-for=id]
  function bindCharCounters(scope) {
    (scope || document).querySelectorAll("[data-count-for]").forEach(function (counter) {
      const field = document.getElementById(counter.getAttribute("data-count-for"));
      if (!field) return;
      const max = field.getAttribute("maxlength");
      const update = function () { counter.textContent = field.value.length + (max ? " / " + max : ""); };
      field.addEventListener("input", update);
      update();
    });
  }

  function qs(name) { return new URLSearchParams(window.location.search).get(name); }

  window.UI = {
    escapeHtml: escapeHtml, initials: initials, avatar: avatar, safeImageSrc: safeImageSrc, colorFor: colorFor,
    norm: norm, hasSkill: hasSkill, chip: chip, skillChip: skillChip, chipList: chipList,
    emptyState: emptyState, errorState: errorState, renderError: renderError,
    skeletonRows: skeletonRows, skeletonCards: skeletonCards,
    setLoading: setLoading, toast: toast, showAlert: showAlert,
    parseDate: parseDate, formatDate: formatDate, timeAgo: timeAgo,
    statusBadge: statusBadge, perspective: perspective,
    contactItems: contactItems, contactInline: contactInline,
    confirmDialog: confirmDialog, validateImage: validateImage, processImage: processImage,
    AvatarUploader: AvatarUploader, bindCharCounters: bindCharCounters, qs: qs
  };
})();
