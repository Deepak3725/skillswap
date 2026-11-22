package controller;

import com.google.gson.Gson;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import model.User;
import service.ProfileService;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// GET /api/users/{id} - public profile of one member, looked up by ID.
// Used for swap partners, whose details must stay available even if they
// remove the skills that were exchanged.
//
// Returns the same public fields that /api/search and /api/matches already
// return for any member. The password hash is never included.
public class UserDetailsController implements HttpHandler {

    private Gson gson = new Gson();
    private ProfileService profileService = new ProfileService();
    private UserController userController;

    public UserDetailsController(UserController userController) {
        this.userController = userController;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {

        int statusCode = 200;
        String response;

        try {

            Integer currentUserId = userController.getLoggedInUserId(exchange);
            String path = exchange.getRequestURI().getPath();

            if (currentUserId == null) {
                statusCode = 401;
                response = gson.toJson("Please login first!");
            }

            else if (!exchange.getRequestMethod().equalsIgnoreCase("GET")) {
                statusCode = 405;
                response = gson.toJson("Method not allowed!");
            }

            else if (!path.matches("/api/users/\\d{1,9}")) {
                statusCode = 400;
                response = gson.toJson("Invalid user ID.");
            }

            else {

                int userId = Integer.parseInt(
                        path.substring("/api/users/".length())
                );

                User user = userId > 0 ? profileService.getProfile(userId) : null;

                if (user == null) {
                    statusCode = 404;
                    response = gson.toJson("User not found.");
                } else {
                    response = gson.toJson(createUserResponse(user));
                }
            }

        } catch (Exception e) {

            e.printStackTrace();

            statusCode = 500;
            response = gson.toJson("Something went wrong!");
        }

        sendResponse(exchange, statusCode, response);
    }

    private Map<String, Object> createUserResponse(User user) {

        Map<String, Object> data = new LinkedHashMap<>();

        data.put("userId", user.getUserId());
        data.put("name", user.getName());
        data.put("email", user.getEmail());
        data.put("profilePicture",
                user.getProfilePicture() == null ? "" : user.getProfilePicture());
        data.put("bio", user.getBio() == null ? "" : user.getBio());
        data.put("whatsapp", user.getWhatsapp() == null ? "" : user.getWhatsapp());
        data.put("telegram", user.getTelegram() == null ? "" : user.getTelegram());

        List<String> teachingSkills = new ArrayList<>();
        for (int i = 0; i < user.teachSkillsize(); i++) {
            teachingSkills.add(user.getTeachSkills(i));
        }

        List<String> learningSkills = new ArrayList<>();
        for (int i = 0; i < user.wantSkillsize(); i++) {
            learningSkills.add(user.getWantSkills(i));
        }

        data.put("teachingSkills", teachingSkills);
        data.put("learningSkills", learningSkills);

        return data;
    }

    private void sendResponse(HttpExchange exchange, int statusCode,
                              String response) throws IOException {

        byte[] bytes = response.getBytes(StandardCharsets.UTF_8);

        exchange.getResponseHeaders().set(
                "Content-Type", "application/json; charset=UTF-8"
        );

        exchange.sendResponseHeaders(statusCode, bytes.length);

        try (OutputStream output = exchange.getResponseBody()) {
            output.write(bytes);
        }
    }
}
