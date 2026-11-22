/* ==========================================================================
   SkillSwap — Login & Signup
   POST /api/login    { email, password }  -> user object + session cookie
   POST /api/register { name, email, password, profilePicture, bio, whatsapp, telegram }
                      -> JSON string ("Registration successful! User ID: n" on success)
   ========================================================================== */
(function () {
  "use strict";

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function fieldError(form, name, message) {
    const input = form.querySelector('[name="' + name + '"]');
    const slot = form.querySelector('[data-error-for="' + name + '"]');
    if (input) input.classList.toggle("is-invalid", !!message);
    if (slot) slot.textContent = message || "";
  }
  function clearErrors(form) {
    form.querySelectorAll(".is-invalid").forEach(function (el) { el.classList.remove("is-invalid"); });
    form.querySelectorAll("[data-error-for]").forEach(function (el) { el.textContent = ""; });
  }
  function clearOnInput(form) {
    form.addEventListener("input", function (e) {
      if (e.target.name) fieldError(form, e.target.name, "");
    });
  }

  // Only allow redirects to paths on this site.
  function safeNext() {
    const next = UI.qs("next");
    if (next && /^\/[A-Za-z0-9\-_.\/?=&%]*$/.test(next) && next.indexOf("//") === -1 && !/^\/(index|signup)\.html/.test(next)) return next;
    return "/dashboard.html";
  }

  // Show / hide password buttons
  document.querySelectorAll("[data-toggle-password]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const input = document.getElementById(btn.getAttribute("data-toggle-password"));
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.innerHTML = '<i class="bi ' + (show ? "bi-eye-slash" : "bi-eye") + '"></i>';
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });

  // ---------------- Login ----------------
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    const alertBox = document.getElementById("loginAlert");
    const button = document.getElementById("loginButton");
    clearOnInput(loginForm);

    if (UI.qs("registered") === "1") UI.showAlert(alertBox, "Account created. Please log in.", "success");
    if (UI.qs("loggedOut") === "1") UI.showAlert(alertBox, "You have been logged out.", "info");
    if (UI.qs("expired") === "1") UI.showAlert(alertBox, "Please log in to continue.", "info");
    if (UI.qs("email")) loginForm.email.value = UI.qs("email");

    // Already signed in? Go straight to the app.
    API.me().then(function () { window.location.replace(safeNext()); }).catch(function () { /* not logged in */ });

    loginForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      clearErrors(loginForm);
      UI.showAlert(alertBox, "");

      const email = loginForm.email.value.trim();
      const password = loginForm.password.value;
      let ok = true;
      if (!email) { fieldError(loginForm, "email", "Enter your email address."); ok = false; }
      else if (!EMAIL_RE.test(email)) { fieldError(loginForm, "email", "Enter a valid email address."); ok = false; }
      if (!password) { fieldError(loginForm, "password", "Enter your password."); ok = false; }
      if (!ok) return;

      UI.setLoading(button, true, "Logging in…");
      try {
        await API.login(email, password);
        window.location.replace(safeNext());
      } catch (err) {
        UI.setLoading(button, false);
        UI.showAlert(alertBox, err.status === 401 ? "Incorrect email or password." : err.message);
        if (err.status === 401) loginForm.password.select();
      }
    });
  }

  // ---------------- Signup ----------------
  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    const alertBox = document.getElementById("signupAlert");
    const button = document.getElementById("signupButton");
    const uploader = UI.AvatarUploader(document.getElementById("avatarUploader"), "");
    UI.bindCharCounters(signupForm);
    clearOnInput(signupForm);

    API.me().then(function () { window.location.replace("/dashboard.html"); }).catch(function () { /* not logged in */ });

    signupForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      clearErrors(signupForm);
      UI.showAlert(alertBox, "");

      const f = signupForm;
      const data = {
        name: f.name.value.trim(),
        email: f.email.value.trim(),
        password: f.password.value,
        profilePicture: uploader.getValue(),
        bio: f.bio.value.trim(),
        whatsapp: f.whatsapp.value.trim(),
        telegram: f.telegram.value.trim().replace(/^@/, "")
      };

      let ok = true;
      const fail = function (name, msg) { fieldError(f, name, msg); ok = false; };
      if (!data.name) fail("name", "Enter your name.");
      else if (data.name.length > 100) fail("name", "Name must be 100 characters or fewer.");
      if (!data.email) fail("email", "Enter your email address.");
      else if (!EMAIL_RE.test(data.email)) fail("email", "Enter a valid email address.");
      if (data.password.length < 8) fail("password", "Use at least 8 characters.");
      if (f.confirmPassword.value !== data.password) fail("confirmPassword", "Passwords do not match.");
      if (data.whatsapp && !/^\+?[\d\s\-()]{6,20}$/.test(data.whatsapp)) fail("whatsapp", "Use digits only, optionally starting with +.");
      if (data.telegram && !/^[A-Za-z0-9_]{3,50}$/.test(data.telegram)) fail("telegram", "Letters, numbers and underscores only.");
      if (!ok) {
        const first = f.querySelector(".is-invalid");
        if (first) first.focus();
        return;
      }

      UI.setLoading(button, true, "Creating account…");
      try {
        const message = await API.register(data);
        // The backend returns HTTP 200 with a message for both outcomes.
        if (typeof message !== "string" || message.indexOf("Registration successful") !== 0) {
          throw new Error(typeof message === "string" ? message : "Registration failed.");
        }
        // Sign the new user in with the same credentials.
        try {
          await API.login(data.email, data.password);
          window.location.replace("/dashboard.html?welcome=1");
        } catch (loginErr) {
          window.location.replace("/index.html?registered=1&email=" + encodeURIComponent(data.email));
        }
      } catch (err) {
        UI.setLoading(button, false);
        if (/already registered/i.test(err.message)) fieldError(f, "email", "This email is already registered.");
        UI.showAlert(alertBox, err.message);
      }
    });
  }
})();
