
package controller;

import com.google.gson.Gson;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import service.NotificationService;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;


public class NotificationController implements HttpHandler {

    private Gson gson;
    private NotificationService notificationService;
    private UserController userController;

    public NotificationController(UserController userController) {
        this.gson = new Gson();
        this.notificationService = new NotificationService();
        this.userController = userController;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {

        String method = exchange.getRequestMethod();
        String path = exchange.getRequestURI().getPath();
        if (path.startsWith("/api/")) {
            path = path.substring(4);
        }

        Integer userId = userController.getLoggedInUserId(exchange);

        if (userId == null) {
            sendResponse(exchange, 401,
                    Map.of("message", "Please login first."));
            return;
        }

        try {

            // GET /notifications - View all notifications
            if (path.equals("/notifications") && method.equals("GET")) {

                sendResponse(exchange, 200,
                        notificationService.getNotifications(userId));
            }

            // POST /notifications/{id}/read - Mark one notification as read
            else if (path.matches("/notifications/\\d+/read")
                    && method.equals("POST")) {

                int notificationId = getNotificationId(path);

                boolean success = notificationService.markAsRead(
                        notificationId, userId
                );

                sendStatusResponse(exchange, success,
                        "Notification marked as read.",
                        "Unable to mark notification as read.");
            }

            // POST /notifications/read-all - Mark all as read
            else if (path.equals("/notifications/read-all")
                    && method.equals("POST")) {

                boolean success =
                        notificationService.markAllAsRead(userId);

                sendStatusResponse(exchange, success,
                        "All notifications marked as read.",
                        "Unable to mark notifications as read.");
            }

            else {
                sendResponse(exchange, 404,
                        Map.of("message", "Invalid endpoint."));
            }

        } catch (Exception e) {

            e.printStackTrace();

            sendResponse(exchange, 400,
                    Map.of("message", "Invalid request."));
        }
    }

    // Extract notification ID from URL
    private int getNotificationId(String path) {

        String[] parts = path.split("/");

        return Integer.parseInt(parts[2]);
    }

    // Send success or failure response
    private void sendStatusResponse(HttpExchange exchange,
                                    boolean success,
                                    String successMessage,
                                    String failureMessage) throws IOException {

        if (success) {
            sendResponse(exchange, 200,
                    Map.of("message", successMessage));
        } else {
            sendResponse(exchange, 400,
                    Map.of("message", failureMessage));
        }
    }

    // Send JSON response
    private void sendResponse(HttpExchange exchange,
                              int statusCode,
                              Object response) throws IOException {

        String json = gson.toJson(response);

        exchange.getResponseHeaders().set(
                "Content-Type", "application/json"
        );

        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);

        exchange.sendResponseHeaders(statusCode, bytes.length);

        try (OutputStream output = exchange.getResponseBody()) {
            output.write(bytes);
        }
    }
}
