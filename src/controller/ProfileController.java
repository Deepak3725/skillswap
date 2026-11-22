
package controller;

import com.google.gson.Gson;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import model.User;
import service.ProfileService;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;

public class ProfileController implements HttpHandler {

    private Gson gson = new Gson();
    private ProfileService profileService = new ProfileService();
    private UserController userController;

    public ProfileController(UserController userController) {
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

            // Get logged-in user's profile
            else if (method.equalsIgnoreCase("GET")) {

                User user = profileService.getProfile(userId);

                if (user != null) {

                    response = gson.toJson(
                            createProfileResponse(user)
                    );

                } else {

                    statusCode = 404;
                    response = gson.toJson("Profile not found!");
                }

            }

            // Update logged-in user's profile
            else if (method.equalsIgnoreCase("PUT")) {

                InputStream input = exchange.getRequestBody();

                String requestBody = new String(
                        input.readAllBytes(),
                        StandardCharsets.UTF_8
                );

                Map<String, String> profileData = gson.fromJson(
                        requestBody,
                        Map.class
                );

                String name = profileData.get("name");
                String profilePicture = profileData.get("profilePicture");
                String bio = profileData.get("bio");
                String whatsapp = profileData.get("whatsapp");
                String telegram = profileData.get("telegram");

                String result = profileService.updateProfile(
                        userId,
                        name,
                        profilePicture,
                        bio,
                        whatsapp,
                        telegram
                );

                if (result.equals("Profile updated successfully.")) {

                    response = gson.toJson(result);

                } else {

                    statusCode = 400;
                    response = gson.toJson(result);
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

    // Create safe profile response without password
    private Map<String, Object> createProfileResponse(User user) {

        return Map.of(
                "userId", user.getUserId(),
                "name", user.getName(),
                "email", user.getEmail(),
                "profilePicture", user.getProfilePicture() == null
                        ? "" : user.getProfilePicture(),
                "bio", user.getBio() == null ? "" : user.getBio(),
                "whatsapp", user.getWhatsapp() == null
                        ? "" : user.getWhatsapp(),
                "telegram", user.getTelegram() == null
                        ? "" : user.getTelegram()
        );
    }
}