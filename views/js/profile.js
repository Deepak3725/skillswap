/* ==========================================================================
   SkillSwap — Profile
   APIs: GET/PUT /api/profile, GET/POST/DELETE /api/skills
   The profile picture is stored by the backend in users.profile_picture
   (TEXT) as a compressed data URL, so it persists across sessions.
   ========================================================================== */
(function () {
  "use strict";

  const esc = UI.escapeHtml;
  let profile = null;
  let skills = { TEACH: [], WANT: [] };
  let uploader = null;
  let modal = null;

  function renderProfile() {
    document.getElementById("heroAvatar").innerHTML = UI.avatar(profile, "avatar-xl");
    document.getElementById("heroName").textContent = profile.name;
    document.getElementById("heroEmail").textContent = profile.email;
    const bio = document.getElementById("aboutBio");
    bio.innerHTML = profile.bio ? esc(profile.bio).replace(/\n/g, "<br>") : '<span class="fst-italic">You haven\'t written a bio yet. <a href="#" data-edit>Add one</a>.</span>';

    const rows = [
      { icon: "bi-envelope", label: "Email", value: profile.email },
      { icon: "bi-whatsapp", label: "WhatsApp", value: profile.whatsapp },
      { icon: "bi-telegram", label: "Telegram", value: profile.telegram ? "@" + String(profile.telegram).replace(/^@/, "") : "" }
    ];
    document.getElementById("contactList").innerHTML = rows.map(function (r) {
      return '<li><span class="contact-icon"><i class="bi ' + r.icon + '"></i></span><div class="min-w-0"><div class="contact-label">' + r.label + "</div>" +
        '<div class="contact-value">' + (r.value ? esc(r.value) : '<span class="text-muted fw-normal">Not added</span>') + "</div></div></li>";
    }).join("");
  }

  function renderSkills(type) {
    const list = skills[type];
    document.querySelector('[data-count="' + type + '"]').textContent = list.length;
    const box = document.querySelector('[data-skill-list="' + type + '"]');
    if (!list.length) {
      box.innerHTML = '<p class="hint mb-0">' + (type === "TEACH" ? "No teaching skills yet. Add one so others can request swaps with you." : "No learning goals yet. Add what you'd like to learn.") + "</p>";
      return;
    }
    box.innerHTML = '<div class="chip-list">' + list.map(function (s) {
      return '<span class="chip chip-' + (type === "TEACH" ? "teach" : "learn") + '"><span>' + esc(s) + '</span>' +
        '<button type="button" class="chip-remove" data-remove="' + esc(s) + '" data-type="' + type + '" aria-label="Remove ' + esc(s) + '"><i class="bi bi-x"></i></button></span>';
    }).join("") + "</div>";
  }

  async function loadSkills() {
    ["TEACH", "WANT"].forEach(function (t) { document.querySelector('[data-skill-list="' + t + '"]').innerHTML = '<div class="skeleton" style="height:30px;width:60%"></div>'; });
    try {
      const s = await API.getSkills();
      skills.TEACH = s.teachingSkills || [];
      skills.WANT = s.learningSkills || [];
      renderSkills("TEACH");
      renderSkills("WANT");
    } catch (e) {
      ["TEACH", "WANT"].forEach(function (t) { UI.renderError(document.querySelector('[data-skill-list="' + t + '"]'), e, loadSkills, true); });
    }
  }

  // Add skill
  document.querySelectorAll("[data-skill-form]").forEach(function (form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      const type = form.getAttribute("data-skill-form");
      const input = form.skill;
      const name = input.value.trim().replace(/\s+/g, " ");
      if (!name) { input.focus(); UI.toast("Type a skill name first.", "info"); return; }
      if (UI.hasSkill(skills[type], name)) { UI.toast("“" + name + "” is already in this list.", "info"); return; }
      const btn = form.querySelector("button");
      UI.setLoading(btn, true);
      input.disabled = true;
      try {
        await API.addSkill(name, type);
        input.value = "";
        UI.toast("Added “" + name + "”.");
        await loadSkills();
      } catch (err) {
        UI.toast(err.message, "error");
      } finally {
        UI.setLoading(btn, false);
        input.disabled = false;
        input.focus();
      }
    });
  });

  // Remove skill
  document.getElementById("skills").addEventListener("click", async function (e) {
    const btn = e.target.closest("[data-remove]");
    if (!btn) return;
    const name = btn.getAttribute("data-remove");
    const type = btn.getAttribute("data-type");
    const ok = await UI.confirmDialog({
      title: "Remove “" + name + "”?",
      message: type === "TEACH" ? "People will no longer find you as a teacher for this skill." : "This skill will no longer be used to find teachers or matches for you.",
      confirmText: "Remove", danger: true
    });
    if (!ok) return;
    btn.disabled = true;
    try {
      await API.removeSkill(name, type);
      UI.toast("Removed “" + name + "”.");
      await loadSkills();
    } catch (err) {
      btn.disabled = false;
      UI.toast(err.message, "error");
    }
  });

  // ---------- Edit profile ----------
  const form = document.getElementById("editForm");
  function setFieldError(name, msg) {
    const input = form.querySelector('[name="' + name + '"]');
    const slot = form.querySelector('[data-error-for="' + name + '"]');
    if (input) input.classList.toggle("is-invalid", !!msg);
    if (slot) slot.textContent = msg || "";
  }

  function openEditor() {
    UI.showAlert(document.getElementById("editAlert"), "");
    ["name", "whatsapp", "telegram"].forEach(function (n) { setFieldError(n, ""); });
    form.name.value = profile.name || "";
    document.getElementById("editEmail").value = profile.email || "";
    form.bio.value = profile.bio || "";
    form.whatsapp.value = profile.whatsapp || "";
    form.telegram.value = String(profile.telegram || "").replace(/^@/, "");
    uploader.setValue(profile.profilePicture || "");
    form.bio.dispatchEvent(new Event("input"));
    modal.show();
  }

  document.getElementById("editProfileBtn").addEventListener("click", openEditor);
  document.addEventListener("click", function (e) { if (e.target.closest("[data-edit]")) { e.preventDefault(); openEditor(); } });
  form.addEventListener("input", function (e) { if (e.target.name) setFieldError(e.target.name, ""); });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const data = {
      name: form.name.value.trim(),
      bio: form.bio.value.trim(),
      whatsapp: form.whatsapp.value.trim(),
      telegram: form.telegram.value.trim().replace(/^@/, ""),
      profilePicture: uploader.getValue()
    };
    let ok = true;
    if (!data.name) { setFieldError("name", "Name can't be empty."); ok = false; }
    if (data.whatsapp && !/^\+?[\d\s\-()]{6,20}$/.test(data.whatsapp)) { setFieldError("whatsapp", "Use digits only, optionally starting with +."); ok = false; }
    if (data.telegram && !/^[A-Za-z0-9_]{3,50}$/.test(data.telegram)) { setFieldError("telegram", "Letters, numbers and underscores only (min 3)."); ok = false; }
    if (!ok) return;

    const btn = document.getElementById("saveProfileBtn");
    UI.setLoading(btn, true, "Saving…");
    try {
      await API.updateProfile(data);
      // Re-read from the backend so the page shows exactly what was stored.
      profile = await API.getProfile();
      renderProfile();
      App.setUser(profile);
      modal.hide();
      UI.toast("Profile saved.");
    } catch (err) {
      UI.showAlert(document.getElementById("editAlert"), err.message);
    } finally {
      UI.setLoading(btn, false);
    }
  });

  App.ready.then(async function () {
    modal = new bootstrap.Modal(document.getElementById("editModal"));
    uploader = UI.AvatarUploader(document.getElementById("editAvatar"), "");
    UI.bindCharCounters(form);
    loadSkills();
    try {
      profile = await API.getProfile();
      renderProfile();
      // #teach / #learn (dashboard stat cards) and #skills focus a skill panel.
      const hash = window.location.hash;
      if (hash === "#skills" || hash === "#teach" || hash === "#learn") {
        const type = hash === "#learn" ? "WANT" : "TEACH";
        const panel = document.getElementById(type === "WANT" ? "learn" : "teach");
        const input = document.querySelector('[data-skill-form="' + type + '"] input');
        panel.scrollIntoView({ block: "center", behavior: "smooth" });
        panel.classList.add("panel-focus");
        setTimeout(function () { panel.classList.remove("panel-focus"); }, 1800);
        if (input) input.focus({ preventScroll: true });
      }
    } catch (err) {
      UI.renderError(document.querySelector(".profile-hero-info"), err, function () { window.location.reload(); }, true);
    }
  });
})();
