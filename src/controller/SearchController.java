
package controller;

import com.google.gson.Gson;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import model.User;
import service.SearchService;

import java.io.IOException;
import java.io.OutputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class SearchController implements HttpHandler {

    private Gson gson = new Gson();
    private SearchService searchService = new SearchService();
    private UserController userController;

    public SearchController(UserController userController) {
        this.userController = userController;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {

        String method = exchange.getRequestMethod();

        String response;
        int statusCode = 200;

        try {

            // Check whether user is logged in
            Integer userId = userController.getLoggedInUserId(exchange);

            if (userId == null) {

                statusCode = 401;
                response = gson.toJson("Please login first!");

            }

            // Search users by skill
            else if (method.equalsIgnoreCase("GET")) {

                String query = exchange.getRequestURI()
                        .getRawQuery();

                String skillName = getQueryParameter(
                        query,
                        "skill"
                );

                if (skillName == null || skillName.trim().isEmpty()) {

                    statusCode = 400;
                    response = gson.toJson(
                            "Please provide a skill to search."
                    );

                } else {

                    List<User> users = searchService.searchUsersBySkill(
                            skillName,
                            userId
                    );

                    List<Map<String, Object>> searchResults =
                            new ArrayList<>();

                    for (User user : users) {

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

                        List<String> teachingSkills =
                                new ArrayList<>();

                        for (int i = 0; i < user.teachSkillsize(); i++) {
                            teachingSkills.add(
                                    user.getTeachSkills(i)
                            );
                        }

                        List<String> learningSkills =
                                new ArrayList<>();

                        for (int i = 0; i < user.wantSkillsize(); i++) {
                            learningSkills.add(
                                    user.getWantSkills(i)
                            );
                        }

                        userData.put("teachingSkills", teachingSkills);
                        userData.put("learningSkills", learningSkills);

                        // NEW: which of this user's skills matched the
                        // (partial, case-insensitive) search text
                        String term = skillName.trim().toLowerCase();
                        List<String> matchedSkills = new ArrayList<>();

                        for (String skill : teachingSkills) {
                            if (skill.toLowerCase().contains(term)
                                    && !matchedSkills.contains(skill)) {
                                matchedSkills.add(skill);
                            }
                        }

                        for (String skill : learningSkills) {
                            if (skill.toLowerCase().contains(term)
                                    && !matchedSkills.contains(skill)) {
                                matchedSkills.add(skill);
                            }
                        }

                        userData.put("matchedSkills", matchedSkills);

                        searchResults.add(userData);
                    }

                    response = gson.toJson(searchResults);
                }

            }

            // Unsupported HTTP method
            else {

                statusCode = 405;
                response = gson.toJson("Method not allowed!");
            }

        } catch (Exception e) {

            e.printStackTrace();

            statusCode = 400;
            response = gson.toJson("Invalid request!");
        }

        // Send response
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
}