
package controller;

import algo.SwapSearch;
import algo.SwapDFS;

import com.google.gson.Gson;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import model.User;
import service.SkillGraphService;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

import ds.MyArrayList;

public class SkillGraphController implements HttpHandler {

    private Gson gson;
    private SkillGraphService skillGraphService;
    private UserController userController;

    public SkillGraphController(UserController userController) {

        this.gson = new Gson();
        this.skillGraphService = new SkillGraphService();
        this.userController = userController;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {

        // Check whether the user is logged in
        Integer currentUserId =
                userController.getLoggedInUserId(exchange);

        if (currentUserId == null) {
            sendResponse(exchange, 401,
                    "Unauthorized. Please login first.");
            return;
        }

        // NEW: GET /api/learning-graph/network — the user's learning
        // network (people connected through completed swaps). Needs no
        // targetId, so it is handled before the targetId check below.
        if (exchange.getRequestURI().getPath()
                .equals("/api/learning-graph/network")) {

            if (!exchange.getRequestMethod().equals("GET")) {
                sendResponse(exchange, 405, "Method not allowed.");
                return;
            }

            // ?depth=1|2|3|... limits how many swaps away people may be;
            // ?depth=all (or no depth) returns every reachable person.
            String networkQuery = exchange.getRequestURI().getQuery();
            int depth = 0;

            if (networkQuery != null) {
                for (String pair : networkQuery.split("&")) {
                    if (pair.startsWith("depth=")) {
                        String value = pair.substring("depth=".length());
                        if (!value.equalsIgnoreCase("all")) {
                            try {
                                depth = Integer.parseInt(value);
                            } catch (NumberFormatException e) {
                                depth = -1;
                            }
                            if (depth <= 0) {
                                sendResponse(exchange, 400,
                                        "Invalid depth. Use a positive number or all.");
                                return;
                            }
                        }
                    }
                }
            }

            sendResponse(exchange, 200, gson.toJson(
                    skillGraphService.getLearningNetwork(currentUserId, depth)
            ));
            return;
        }

        // Read the target user ID from the query parameter
        String query = exchange.getRequestURI().getQuery();

        if (query == null || !query.startsWith("targetId=")) {
            sendResponse(exchange, 400,
                    "Please provide targetId.");
            return;
        }

        int targetUserId;

        try {
            targetUserId = Integer.parseInt(
                    query.substring("targetId=".length())
            );
        } catch (NumberFormatException e) {
            sendResponse(exchange, 400,
                    "Invalid targetId.");
            return;
        }

        if (targetUserId <= 0) {
            sendResponse(exchange, 400,
                    "Invalid targetId.");
            return;
        }

        String path = exchange.getRequestURI().getPath();
        if (path.startsWith("/api/")) {
            path = path.substring(4);
        }

        MyArrayList<User> result;

        // Find shortest learning chain using BFS
        if (path.equals("/learning-graph/chain")) {

            if (!exchange.getRequestMethod().equals("GET")) {
                sendResponse(exchange, 405,
                        "Method not allowed.");
                return;
            }

            result = skillGraphService.findShortestLearningChain(
                    currentUserId, targetUserId
            );
        }

        // Find a learning path using DFS
        else if (path.equals("/learning-graph/path")) {

            if (!exchange.getRequestMethod().equals("GET")) {
                sendResponse(exchange, 405,
                        "Method not allowed.");
                return;
            }

            result = skillGraphService.findLearningPath(
                    currentUserId, targetUserId
            );
        }

        else {
            sendResponse(exchange, 404, "Endpoint not found.");
            return;
        }

        // Convert the path into a response-friendly list
        java.util.List<java.util.Map<String, Object>> users =
                new java.util.ArrayList<>();

        for (int i = 0; i < result.size(); i++) {

            User user = result.get(i);

            java.util.Map<String, Object> userData =
                    new java.util.LinkedHashMap<>();

            userData.put("userId", user.getUserId());
            userData.put("name", user.getName());

            users.add(userData);
        }

        java.util.Map<String, Object> response =
                new java.util.LinkedHashMap<>();

        response.put("found", result.size() > 0);
        response.put("chainLength",
                result.size() > 0 ? result.size() - 1 : 0);
        response.put("users", users);

        // NEW: the completed swaps behind each step of the route, with the
        // original request direction and the skills actually exchanged.
        response.put("steps", skillGraphService.describeRoute(result));

        sendResponse(exchange, 200, gson.toJson(response));
    }

    // Send HTTP response
    private void sendResponse(HttpExchange exchange,
                              int statusCode, String response)
            throws IOException {

        byte[] bytes = response.getBytes(StandardCharsets.UTF_8);

        exchange.getResponseHeaders().set(
                "Content-Type", "application/json"
        );

        exchange.sendResponseHeaders(statusCode, bytes.length);

        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }
}
