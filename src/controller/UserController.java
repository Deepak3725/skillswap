
package controller;

import com.google.gson.Gson;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import model.User;
import service.UserService;
import repository.UserRepository;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class UserController implements HttpHandler {

    private Gson gson = new Gson();
    private UserService userService = new UserService();
    private UserRepository userRepository = new UserRepository();

    // Store active sessions
    private static final Map<String, Integer> sessions =
            new ConcurrentHashMap<>();

    private static final SecureRandom random = new SecureRandom();

    @Override
    public void handle(HttpExchange exchange) throws IOException {

        String path = exchange.getRequestURI().getPath();
        if (path.startsWith("/api/")) {
            path = path.substring(4);
        }
        String method = exchange.getRequestMethod();

        System.out.println("Requested path: " + path);
        System.out.println("Method: " + method);

        String response;
        int statusCode = 200;

        // Read JSON data from Postman
        String requestBody = "";

        if (method.equalsIgnoreCase("POST")) {

            InputStream input = exchange.getRequestBody();

            requestBody = new String(
                    input.readAllBytes(),
                    StandardCharsets.UTF_8
            );
        }

        try {

            // User registration
            if (path.equals("/register")
                    && method.equalsIgnoreCase("POST")) {

                User user = gson.fromJson(requestBody, User.class);

                response = gson.toJson(
                        userService.registerUser(user)
                );

            }

            // User login
            else if (path.equals("/login")
                    && method.equalsIgnoreCase("POST")) {

                User user = gson.fromJson(requestBody, User.class);

                User loggedInUser = userService.loginUser(
                        user.getEmail(),
                        user.getPassword()
                );

                if (loggedInUser != null) {

                    // Generate session token
                    byte[] tokenBytes = new byte[32];
                    random.nextBytes(tokenBytes);

                    String token = Base64.getUrlEncoder()
                            .withoutPadding()
                            .encodeToString(tokenBytes);

                    // Store token with user ID
                    sessions.put(token, loggedInUser.getUserId());

                    // Send session cookie
                    exchange.getResponseHeaders().add(
                            "Set-Cookie",
                            "SKILLSWAP_SESSION=" + token
                                    + "; Path=/; HttpOnly; SameSite=Lax"
                    );

                    response = gson.toJson(
                            createUserResponse(loggedInUser)
                    );

                } else {

                    statusCode = 401;
                    response = gson.toJson(
                            "Invalid email or password!"
                    );
                }

            }

            // Get current logged-in user
            else if (path.equals("/me")
                    && method.equalsIgnoreCase("GET")) {

                String token = getSessionToken(exchange);

                Integer userId = token == null ? null : sessions.get(token);

                if (userId != null) {

                    User user = userRepository.findById(userId);

                    if (user != null) {

                        response = gson.toJson(
                                createUserResponse(user)
                        );

                    } else {

                        statusCode = 401;
                        response = gson.toJson("User not found!");
                    }

                } else {

                    statusCode = 401;
                    response = gson.toJson("Please login first!");
                }

            }

            // User logout
            else if (path.equals("/logout")
                    && method.equalsIgnoreCase("POST")) {

                String token = getSessionToken(exchange);

                if (token != null) {
                    sessions.remove(token);
                }

                exchange.getResponseHeaders().add(
                        "Set-Cookie",
                        "SKILLSWAP_SESSION=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"
                );

                response = gson.toJson("Logout successful!");
            }

            // Invalid endpoint
            else {

                statusCode = 404;
                response = gson.toJson("Invalid endpoint!");
            }

        } catch (Exception e) {

            e.printStackTrace();

            statusCode = 400;
            response = gson.toJson("Invalid request!");
        }

        // Send response to Postman
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

    // Read session token from cookie
    private String getSessionToken(HttpExchange exchange) {

        String cookieHeader = exchange.getRequestHeaders()
                .getFirst("Cookie");

        if (cookieHeader == null) {
            return null;
        }

        for (String cookie : cookieHeader.split(";")) {

            String[] parts = cookie.trim().split("=", 2);

            if (parts.length == 2
                    && parts[0].equals("SKILLSWAP_SESSION")) {

                return parts[1];
            }
        }

        return null;
    }

    // Create safe user response without password
    private Map<String, Object> createUserResponse(User user) {

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
    // Get logged-in user's ID for other controllers
public Integer getLoggedInUserId(HttpExchange exchange) {

    String token = getSessionToken(exchange);

    if (token == null) {
        return null;
    }

    return sessions.get(token);
}
}
