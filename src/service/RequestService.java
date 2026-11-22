
package service;

import repository.RequestRepository;
import model.SwapRequest;
import ds.SwapRequestQueue;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class RequestService {

    private RequestRepository requestRepository;
    private NotificationService notificationService;

    // NEW: Queue for incoming requests of each user
    private ConcurrentHashMap<Integer, SwapRequestQueue<SwapRequest>> requestQueues;

    public RequestService() {
        this.requestRepository = new RequestRepository();
        this.notificationService = new NotificationService();
        this.requestQueues = new ConcurrentHashMap<>();
    }

    // Send a new skill swap request
    public int sendRequest(int senderId, int receiverId,
                           String offeredSkill, String requestedSkill) {

        if (senderId <= 0 || receiverId <= 0) {
            return -1;
        }

        if (senderId == receiverId) {
            return -1;
        }

        // The requested skill is required.
        if (requestedSkill == null || requestedSkill.trim().isEmpty()) {
            return -1;
        }

        // The offered skill is optional (one-way request). A blank value
        // is treated as "nothing offered".
        String offered = (offeredSkill == null || offeredSkill.trim().isEmpty())
                ? null : offeredSkill.trim();

        if (offered != null && offered.equalsIgnoreCase(requestedSkill.trim())) {
            return -1;
        }

        int requestId = requestRepository.sendRequest(
                senderId,
                receiverId,
                offered,
                requestedSkill.trim()
        );

        // Refresh receiver's incoming request queue after sending
        if (requestId > 0) {
            loadIncomingRequests(receiverId);

            // Notify the receiver about the new request
            notificationService.createNotification(
                    receiverId,
                    requestId,
                    "You received a new skill swap request."
            );
        }

        return requestId;
    }

    // Get requests sent by a user
    public List<Map<String, Object>> getSentRequests(int userId) {

        if (userId <= 0) {
            return List.of();
        }

        return requestRepository.getSentRequests(userId);
    }

    // Get requests received by a user
    public List<Map<String, Object>> getReceivedRequests(int userId) {

        if (userId <= 0) {
            return List.of();
        }

        // Load pending requests into the queue
        loadIncomingRequests(userId);

        return requestRepository.getReceivedRequests(userId);
    }

    // NEW: Load pending requests into the user's queue
    public void loadIncomingRequests(int receiverId) {

        if (receiverId <= 0) {
            return;
        }

        List<SwapRequest> pendingRequests =
                requestRepository.getPendingReceivedRequests(receiverId);

        SwapRequestQueue<SwapRequest> queue = new SwapRequestQueue<>();

        // Database returns requests in oldest-first order
        for (int i = 0; i < pendingRequests.size(); i++) {
            queue.enqueue(pendingRequests.get(i));
        }

        requestQueues.put(receiverId, queue);
    }

    // NEW: Get the next incoming request without removing it
    public SwapRequest peekNextRequest(int receiverId) {

        if (receiverId <= 0) {
            return null;
        }

        // Refresh queue to get the latest pending requests
        loadIncomingRequests(receiverId);

        SwapRequestQueue<SwapRequest> queue =
                requestQueues.get(receiverId);

        if (queue == null || queue.isEmpty()) {
            return null;
        }

        return queue.peek();
    }

    // Accept a request
    public boolean acceptRequest(int requestId, int receiverId) {

        if (requestId <= 0 || receiverId <= 0) {
            return false;
        }

        Map<String, Object> details =
                requestRepository.getRequestDetails(requestId);

        if (details == null
                || ((Number) details.get("receiverId")).intValue() != receiverId
                || !"PENDING".equals(details.get("status"))) {
            return false;
        }

        int senderId = ((Number) details.get("senderId")).intValue();

        boolean success = requestRepository.updateRequestStatus(
                requestId,
                receiverId,
                "ACCEPTED"
        );

        // Refresh queue after successful acceptance
        if (success) {
            loadIncomingRequests(receiverId);

            // Notify the sender that the request was accepted
            notificationService.createNotification(
                    senderId,
                    requestId,
                    "Your skill swap request has been accepted."
            );
        }

        return success;
    }

    // Reject a request
    public boolean rejectRequest(int requestId, int receiverId) {

        if (requestId <= 0 || receiverId <= 0) {
            return false;
        }

        Map<String, Object> details =
                requestRepository.getRequestDetails(requestId);

        if (details == null
                || ((Number) details.get("receiverId")).intValue() != receiverId
                || !"PENDING".equals(details.get("status"))) {
            return false;
        }

        int senderId = ((Number) details.get("senderId")).intValue();

        boolean success = requestRepository.updateRequestStatus(
                requestId,
                receiverId,
                "REJECTED"
        );

        // Refresh queue after successful rejection
        if (success) {
            loadIncomingRequests(receiverId);

            // Notify the sender that the request was rejected
            notificationService.createNotification(
                    senderId,
                    requestId,
                    "Your skill swap request has been rejected."
            );
        }

        return success;
    }

    // Cancel a request
    public boolean cancelRequest(int requestId, int senderId) {

        if (requestId <= 0 || senderId <= 0) {
            return false;
        }

        Map<String, Object> details =
                requestRepository.getRequestDetails(requestId);

        if (details == null
                || ((Number) details.get("senderId")).intValue() != senderId
                || !"PENDING".equals(details.get("status"))) {
            return false;
        }

        int receiverId = ((Number) details.get("receiverId")).intValue();

        boolean success = requestRepository.cancelRequest(
                requestId,
                senderId
        );

        if (success) {
            loadIncomingRequests(receiverId);

            // Notify the receiver that the request was cancelled
            notificationService.createNotification(
                    receiverId,
                    requestId,
                    "A skill swap request you received has been cancelled."
            );
        }

        return success;
    }

    // Complete an accepted swap
    public boolean completeRequest(int requestId, int userId) {

        if (requestId <= 0 || userId <= 0) {
            return false;
        }

        // Repository records this user's confirmation and returns
        // the updated request details.
        Map<String, Object> details =
                requestRepository.completeRequestAndGetDetails(
                        requestId, userId
                );

        if (details == null) {
            return false;
        }

        String status = (String) details.get("status");

        // Notify both users only after both have confirmed completion
        if ("COMPLETED".equals(status)) {

            int senderId = ((Number) details.get("senderId")).intValue();
            int receiverId = ((Number) details.get("receiverId")).intValue();

            notificationService.createNotification(
                    senderId,
                    requestId,
                    "Your skill swap has been completed successfully."
            );

            notificationService.createNotification(
                    receiverId,
                    requestId,
                    "Your skill swap has been completed successfully."
            );
        }

        return true;
    }
}
