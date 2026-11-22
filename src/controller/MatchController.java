
package controller;

import com.google.gson.Gson;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import model.User;
import model.Match;
import ds.MyArrayList;
import service.MatchService;

import java.io.IOException;
import java.io.OutputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MatchController implements HttpHandler {

    private Gson gson = new Gson();
    private MatchService matchService = new MatchService();
    private UserController userController;

    public MatchController(UserController userController) {
        this.userController = userController;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {

        String method = exchange.getRequestMethod();
        String path = exchange.getRequestURI().getPath();
        if (path.startsWith("/api/")) {
            path = path.substring(4);
        }

        String response;
        int statusCode = 200;

        try {

            // Check whether user is logged in
            Integer userId = userController.getLoggedInUserId(exchange);

            if (userId == null) {

                statusCode = 401;
                response = gson.toJson("Please login first!");

            }

            // Get all matches or top matches
            else if (method.equalsIgnoreCase("GET")) {

                MyArrayList<Match> matches;

                if (path.equals("/matches")) {

                    // Get all matches sorted by compatibility score
                    matches = matchService.calculateMatches(userId);

                }

                else if (path.equals("/matches/top")) {

                    // Get the limit from URL
                    String query = exchange.getRequestURI()
                            .getRawQuery();

                    String limitValue = getQueryParameter(
                            query,
                            "limit"
                    );

                    int limit = 5;

                    if (limitValue != null) {

                        try {
                            limit = Integer.parseInt(limitValue);
                        }

                        catch (NumberFormatException e) {
                            statusCode = 400;
                            response = gson.toJson(
                                    "Invalid limit value."
                            );

                            sendResponse(exchange, statusCode, response);
                            return;
                        }
                    }

                    if (limit <= 0) {

                        statusCode = 400;
                        response = gson.toJson(
                                "Limit must be greater than zero."
                        );

                        sendResponse(exchange, statusCode, response);
                        return;
                    }

                    // Get top matches using Max Heap
                    matches = matchService.getTopMatches(
                            userId,
                            limit
                    );

                }

                else {

                    statusCode = 404;
                    response = gson.toJson("Endpoint not found!");

                    sendResponse(exchange, statusCode, response);
                    return;
                }

                // Convert matches into JSON response
                List<Map<String, Object>> matchResults =
                        new ArrayList<>();

                for (int i = 0; i < matches.size(); i++) {

                    Match match = matches.get(i);
                    User user = match.getUser();

                    Map<String, Object> userData = new HashMap<>();

                    userData.put("userId", user.getUserId());
                    userData.put("name", user.getName());
                    userData.put("email", user.getEmail());

                    userData.put(
                            "profilePicture",
                            user.getProfilePicture() == null
                                    ? "" : user.getProfilePicture()
                    );

                    userData.put(
                            "bio",
                            user.getBio() == null
                                    ? "" : user.getBio()
                    );

                    userData.put(
                            "whatsapp",
                            user.getWhatsapp() == null
                                    ? "" : user.getWhatsapp()
                    );

                    userData.put(
                            "telegram",
                            user.getTelegram() == null
                                    ? "" : user.getTelegram()
                    );

                    // Add teaching skills
                    List<String> teachingSkills = new ArrayList<>();

                    for (int j = 0; j < user.teachSkillsize(); j++) {
                        teachingSkills.add(
                                user.getTeachSkills(j)
                        );
                    }

                    // Add learning skills
                    List<String> learningSkills = new ArrayList<>();

                    for (int j = 0; j < user.wantSkillsize(); j++) {
                        learningSkills.add(
                                user.getWantSkills(j)
                        );
                    }

                    userData.put("teachingSkills", teachingSkills);
                    userData.put("learningSkills", learningSkills);

                    // Add compatibility score
                    userData.put("compatibilityScore", match.getScore());

                    matchResults.add(userData);
                }

                response = gson.toJson(matchResults);

            }

            // Unsupported HTTP method
            else {

                statusCode = 405;
                response = gson.toJson("Method not allowed!");
            }

        } catch (Exception e) {

            e.printStackTrace();

            statusCode = 500;
            response = gson.toJson("Something went wrong!");
        }

        sendResponse(exchange, statusCode, response);
    }

    // Get a parameter from the URL
    private String getQueryParameter(String query, String parameter) {

        if (query == null) {
            return null;
        }

        for (String pair : query.split("&")) {

            String[] parts = pair.split("=", 2);

            String key = URLDecoder.decode(
                    parts[0],
                    StandardCharsets.UTF_8
            );

            if (key.equals(parameter)) {

                if (parts.length == 2) {

                    return URLDecoder.decode(
                            parts[1],
                            StandardCharsets.UTF_8
                    );
                }

                return "";
            }
        }

        return null;
    }

    // Send response
    private void sendResponse(HttpExchange exchange,
                              int statusCode,
                              String response) throws IOException {

        byte[] responseBytes = response.getBytes(
                StandardCharsets.UTF_8
        );

        exchange.getResponseHeaders().set(
                "Content-Type",
                "application/json; charset=UTF-8"
        );

        exchange.sendResponseHeaders(
                statusCode,
                responseBytes.length
        );

        try (OutputStream output = exchange.getResponseBody()) {
            output.write(responseBytes);
        }
    }
}
