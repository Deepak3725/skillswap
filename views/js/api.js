/* ==========================================================================
   SkillSwap — API client
   One place that talks to the Java backend. Every endpoint below matches the
   routes registered in src/Main.java and the controllers in src/controller.
   ========================================================================== */
(function () {
  "use strict";

  class ApiError extends Error {
    constructor(message, status, data) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.data = data;
    }
  }

  // Controllers reply with either a JSON string ("Please login first!"),
  // a JSON object ({ message: "..." }), or plain text (learning graph errors).
  function extractMessage(data, status) {
    if (typeof data === "string" && data.trim()) return data.trim();
    if (data && typeof data.message === "string") return data.message;
    if (status === 0) return "Cannot reach the SkillSwap server.";
    return "Request failed (HTTP " + status + ").";
  }

  async function request(method, path, body, options) {
    const opts = options || {};
    const init = { method: method, credentials: "same-origin", headers: { Accept: "application/json" } };

    if (body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    let response;
    try {
      response = await fetch(path, init);
    } catch (networkError) {
      throw new ApiError("Cannot reach the SkillSwap server. Check that it is running and try again.", 0, null);
    }

    const text = await response.text();
    let data = text;
    if (text) {
      try { data = JSON.parse(text); } catch (e) { data = text; }
    } else {
      data = null;
    }

    if (!response.ok) {
      const error = new ApiError(extractMessage(data, response.status), response.status, data);

      // An expired/missing session on an app page sends the user to login.
      if (response.status === 401 && !opts.allowUnauthorized && window.SkillSwapAuth) {
        window.SkillSwapAuth.handleUnauthorized();
      }
      throw error;
    }
    return data;
  }

  const enc = encodeURIComponent;

  const API = {
    ApiError: ApiError,
    request: request,

    // ---- Authentication (UserController) ----
    me: function () { return request("GET", "/api/me", undefined, { allowUnauthorized: true }); },
    login: function (email, password) {
      return request("POST", "/api/login", { email: email, password: password }, { allowUnauthorized: true });
    },
    // Body: { name, email, password, profilePicture, bio, whatsapp, telegram }
    // Response: JSON string, "Registration successful! User ID: n" on success.
    register: function (payload) { return request("POST", "/api/register", payload, { allowUnauthorized: true }); },
    logout: function () { return request("POST", "/api/logout", undefined, { allowUnauthorized: true }); },

    // ---- Profile (ProfileController) ----
    getProfile: function () { return request("GET", "/api/profile"); },
    // PUT replaces every column, so always send the full profile.
    updateProfile: function (profile) {
      return request("PUT", "/api/profile", {
        name: profile.name,
        profilePicture: profile.profilePicture || "",
        bio: profile.bio || "",
        whatsapp: profile.whatsapp || "",
        telegram: profile.telegram || ""
      });
    },

    // ---- Skills (SkillController). skillType: "TEACH" | "WANT" ----
    getSkills: function () { return request("GET", "/api/skills"); },
    addSkill: function (skillName, skillType) {
      return request("POST", "/api/skills", { skillName: skillName, skillType: skillType });
    },
    removeSkill: function (skillName, skillType) {
      return request("DELETE", "/api/skills", { skillName: skillName, skillType: skillType });
    },

    // ---- Search & matching (SearchController, MatchController) ----
    search: function (skill) { return request("GET", "/api/search?skill=" + enc(skill)); },
    getMatches: function () { return request("GET", "/api/matches"); },
    getTopMatches: function (limit) { return request("GET", "/api/matches/top?limit=" + enc(limit || 5)); },

    // ---- Swap requests (RequestController) ----
    sendRequest: function (receiverId, offeredSkill, requestedSkill) {
      // offeredSkill is optional: leave it out for a one-way request.
      const body = { receiverId: Number(receiverId), requestedSkill: requestedSkill };
      if (offeredSkill) body.offeredSkill = offeredSkill;
      return request("POST", "/api/requests", body);
    },
    getSentRequests: function () { return request("GET", "/api/requests/sent"); },
    getReceivedRequests: function () { return request("GET", "/api/requests/received"); },
    getNextRequest: function () { return request("GET", "/api/requests/next"); },
    acceptRequest: function (id) { return request("POST", "/api/requests/" + enc(id) + "/accept"); },
    rejectRequest: function (id) { return request("POST", "/api/requests/" + enc(id) + "/reject"); },
    cancelRequest: function (id) { return request("POST", "/api/requests/" + enc(id) + "/cancel"); },
    completeRequest: function (id) { return request("POST", "/api/requests/" + enc(id) + "/complete"); },

    // ---- Notifications (NotificationController) ----
    getNotifications: function () { return request("GET", "/api/notifications"); },
    markNotificationRead: function (id) { return request("POST", "/api/notifications/" + enc(id) + "/read"); },
    markAllNotificationsRead: function () { return request("POST", "/api/notifications/read-all"); },

    // ---- Learning graph (SkillGraphController) ----
    // chain = BFS shortest chain (SwapSearch), path = DFS path (SwapDFS)
    getLearningChain: function (targetId) { return request("GET", "/api/learning-graph/chain?targetId=" + enc(targetId)); },
    getLearningPath: function (targetId) { return request("GET", "/api/learning-graph/path?targetId=" + enc(targetId)); },
    // Added endpoint: people connected to you through completed swaps (with skills exchanged)
    // depth: 1, 2, 3 ... or "all"
    getLearningNetwork: function (depth) { return request("GET", "/api/learning-graph/network?depth=" + enc(depth || "all")); },
    // Public profile of one member (GET /api/users/{id})
    getUser: function (userId) { return request("GET", "/api/users/" + enc(userId)); }
  };

  window.API = API;
})();
