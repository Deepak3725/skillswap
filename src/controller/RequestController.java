
package controller;

import com.google.gson.Gson;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import service.RequestService;
import model.SwapRequest;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;

public class RequestController implements HttpHandler {

    private Gson gson;
    private RequestService requestService;
    private UserController userController;

    public RequestController(UserController userController) {
        this.gson = new Gson();
        this.requestService = new RequestService();
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

            // POST /requests - Send a new request
            if (path.equals("/requests") && method.equals("POST")) {

                Map<String, Object> body = readRequestBody(exchange);

                int receiverId = ((Number) body.get("receiverId")).intValue();

                String offeredSkill = (String) body.get("offeredSkill");
                String requestedSkill = (String) body.get("requestedSkill");

                int requestId = requestService.sendRequest(
                        userId,
                        receiverId,
                        offeredSkill,
                        requestedSkill
                );

                if (requestId > 0) {
                    sendResponse(exchange, 201,
                            Map.of(
                                    "message", "Swap request sent successfully.",
                                    "requestId", requestId
                            ));
                } else {
                    sendResponse(exchange, 400,
                            Map.of("message",
                                    "Could not send request. Check the users and skills."));
                }

            }

            // GET /requests/sent - View sent requests
            else if (path.equals("/requests/sent") && method.equals("GET")) {

                sendResponse(exchange, 200,
                        requestService.getSentRequests(userId));
            }

            // GET /requests/received - View received requests
            else if (path.equals("/requests/received") && method.equals("GET")) {

                sendResponse(exchange, 200,
                        requestService.getReceivedRequests(userId));
            }

            // GET /requests/next - View the oldest incoming request
            else if (path.equals("/requests/next") && method.equals("GET")) {

                SwapRequest request =
                        requestService.peekNextRequest(userId);

                if (request != null) {
                    sendResponse(exchange, 200, request);
                } else {
                    sendResponse(exchange, 200,
                            Map.of("message", "No pending requests."));
                }
            }

            // POST /requests/{id}/accept
            else if (path.matches("/requests/\\d+/accept")
                    && method.equals("POST")) {

                int requestId = getRequestId(path);

                boolean success = requestService.acceptRequest(
                        requestId, userId
                );

                sendStatusResponse(exchange, success,
                        "Request accepted successfully.",
                        "Unable to accept request. Check its status and permissions.");
            }

            // POST /requests/{id}/reject
            else if (path.matches("/requests/\\d+/reject")
                    && method.equals("POST")) {

                int requestId = getRequestId(path);

                boolean success = requestService.rejectRequest(
                        requestId, userId
                );

                sendStatusResponse(exchange, success,
                        "Request rejected successfully.",
                        "Unable to reject request. Check its status and permissions.");
            }

            // POST /requests/{id}/cancel
            else if (path.matches("/requests/\\d+/cancel")
                    && method.equals("POST")) {

                int requestId = getRequestId(path);

                boolean success = requestService.cancelRequest(
                        requestId, userId
                );

                sendStatusResponse(exchange, success,
                        "Request cancelled successfully.",
                        "Unable to cancel request. Check its status and permissions.");
            }

            // POST /requests/{id}/complete
            else if (path.matches("/requests/\\d+/complete")
                    && method.equals("POST")) {

                int requestId = getRequestId(path);

                boolean success = requestService.completeRequest(
                        requestId, userId
                );

                sendStatusResponse(exchange, success,
                        "Swap marked as completed.",
                        "Unable to complete swap. Check its status and permissions.");
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

    // Read JSON request body
    private Map<String, Object> readRequestBody(HttpExchange exchange)
            throws IOException {

        InputStream input = exchange.getRequestBody();

        String body = new String(
                input.readAllBytes(),
                StandardCharsets.UTF_8
        );

        return gson.fromJson(body, Map.class);
    }

    // Extract request ID from URL
    private int getRequestId(String path) {

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
