
package repository;

import config.DBConnection;
import model.User;
import model.SwapRequest;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class RequestRepository {

    // Send a new skill swap request.
    // offeredSkill may be null: a one-way request where the sender only
    // asks to learn (offered_skill_id is stored as NULL).
    public int sendRequest(int senderId, int receiverId,
                           String offeredSkill, String requestedSkill) {

        if (offeredSkill == null) {
            return sendOneWayRequest(senderId, receiverId, requestedSkill);
        }

        String sql = "INSERT INTO swap_requests "
                + "(sender_id, receiver_id, offered_skill_id, requested_skill_id) "
                + "SELECT ?, ?, offered.skill_id, requested.skill_id "
                + "FROM skills offered, skills requested "
                + "WHERE LOWER(offered.skill_name) = LOWER(?) "
                + "AND LOWER(requested.skill_name) = LOWER(?) "
                + "AND EXISTS ("
                + "SELECT 1 FROM user_skills "
                + "WHERE user_id = ? AND skill_id = offered.skill_id "
                + "AND skill_type = 'TEACH') "
                + "AND EXISTS ("
                + "SELECT 1 FROM user_skills "
                + "WHERE user_id = ? AND skill_id = requested.skill_id "
                + "AND skill_type = 'TEACH') "
                + "AND ? <> ? "
                + "RETURNING request_id";

        try (Connection connection = DBConnection.getConnection()) {

            if (connection == null) {
                return -1;
            }

            try (PreparedStatement ps = connection.prepareStatement(sql)) {

                ps.setInt(1, senderId);
                ps.setInt(2, receiverId);
                ps.setString(3, offeredSkill.trim());
                ps.setString(4, requestedSkill.trim());
                ps.setInt(5, senderId);
                ps.setInt(6, receiverId);
                ps.setInt(7, senderId);
                ps.setInt(8, receiverId);

                try (ResultSet rs = ps.executeQuery()) {

                    if (rs.next()) {
                        return rs.getInt("request_id");
                    }
                }
            }

        } catch (SQLException e) {
            e.printStackTrace();
        }

        return -1;
    }

    // Insert a request with no offered skill. The receiver must still
    // TEACH the requested skill.
    private int sendOneWayRequest(int senderId, int receiverId,
                                  String requestedSkill) {

        String sql = "INSERT INTO swap_requests "
                + "(sender_id, receiver_id, offered_skill_id, requested_skill_id) "
                + "SELECT ?, ?, ?, requested.skill_id "
                + "FROM skills requested "
                + "WHERE LOWER(requested.skill_name) = LOWER(?) "
                + "AND EXISTS ("
                + "SELECT 1 FROM user_skills "
                + "WHERE user_id = ? AND skill_id = requested.skill_id "
                + "AND skill_type = 'TEACH') "
                + "AND ? <> ? "
                + "RETURNING request_id";

        try (Connection connection = DBConnection.getConnection()) {

            if (connection == null) {
                return -1;
            }

            try (PreparedStatement ps = connection.prepareStatement(sql)) {

                ps.setInt(1, senderId);
                ps.setInt(2, receiverId);
                ps.setNull(3, java.sql.Types.INTEGER);
                ps.setString(4, requestedSkill.trim());
                ps.setInt(5, receiverId);
                ps.setInt(6, senderId);
                ps.setInt(7, receiverId);

                try (ResultSet rs = ps.executeQuery()) {

                    if (rs.next()) {
                        return rs.getInt("request_id");
                    }
                }
            }

        } catch (SQLException e) {
            e.printStackTrace();
        }

        return -1;
    }

    // Get all requests sent by a user
    public List<Map<String, Object>> getSentRequests(int userId) {

        String sql = "SELECT sr.request_id, sr.sender_id, sr.receiver_id, "
                + "sender.name AS sender_name, "
                + "receiver.name AS receiver_name, "
                + "offered.skill_name AS offered_skill, "
                + "requested.skill_name AS requested_skill, "
                + "sr.status, sr.created_at "
                + "FROM swap_requests sr "
                + "JOIN users sender ON sr.sender_id = sender.user_id "
                + "JOIN users receiver ON sr.receiver_id = receiver.user_id "
                + "LEFT JOIN skills offered ON sr.offered_skill_id = offered.skill_id "
                + "JOIN skills requested ON sr.requested_skill_id = requested.skill_id "
                + "WHERE sr.sender_id = ? "
                + "ORDER BY sr.created_at ASC";

        return getRequests(sql, userId);
    }

    // Get all requests received by a user
    public List<Map<String, Object>> getReceivedRequests(int userId) {

        String sql = "SELECT sr.request_id, sr.sender_id, sr.receiver_id, "
                + "sender.name AS sender_name, "
                + "receiver.name AS receiver_name, "
                + "offered.skill_name AS offered_skill, "
                + "requested.skill_name AS requested_skill, "
                + "sr.status, sr.created_at "
                + "FROM swap_requests sr "
                + "JOIN users sender ON sr.sender_id = sender.user_id "
                + "JOIN users receiver ON sr.receiver_id = receiver.user_id "
                + "LEFT JOIN skills offered ON sr.offered_skill_id = offered.skill_id "
                + "JOIN skills requested ON sr.requested_skill_id = requested.skill_id "
                + "WHERE sr.receiver_id = ? "
                + "ORDER BY sr.created_at ASC";

        return getRequests(sql, userId);
    }

    // Common method to retrieve requests
    private List<Map<String, Object>> getRequests(String sql, int userId) {

        List<Map<String, Object>> requests = new ArrayList<>();

        try (Connection connection = DBConnection.getConnection()) {

            if (connection == null) {
                return requests;
            }

            try (PreparedStatement ps = connection.prepareStatement(sql)) {

                ps.setInt(1, userId);

                try (ResultSet rs = ps.executeQuery()) {

                    while (rs.next()) {

                        Map<String, Object> request = new LinkedHashMap<>();

                        request.put("requestId", rs.getInt("request_id"));
                        request.put("senderId", rs.getInt("sender_id"));
                        request.put("receiverId", rs.getInt("receiver_id"));
                        request.put("senderName", rs.getString("sender_name"));
                        request.put("receiverName", rs.getString("receiver_name"));
                        request.put("offeredSkill", rs.getString("offered_skill"));
                        request.put("requestedSkill", rs.getString("requested_skill"));
                        request.put("status", rs.getString("status"));
                        request.put("createdAt", rs.getTimestamp("created_at"));

                        requests.add(request);
                    }
                }
            }

        } catch (SQLException e) {
            e.printStackTrace();
        }

        return requests;
    }

    // NEW: Get pending requests received by a user for the request queue
    public List<SwapRequest> getPendingReceivedRequests(int receiverId) {

        List<SwapRequest> requests = new ArrayList<>();

        String sql = "SELECT sr.request_id, "
                + "sr.sender_id, sr.receiver_id, "
                + "sender.name AS sender_name, "
                + "receiver.name AS receiver_name, "
                + "offered.skill_name AS offered_skill, "
                + "requested.skill_name AS requested_skill, "
                + "sr.status "
                + "FROM swap_requests sr "
                + "JOIN users sender ON sr.sender_id = sender.user_id "
                + "JOIN users receiver ON sr.receiver_id = receiver.user_id "
                + "LEFT JOIN skills offered ON sr.offered_skill_id = offered.skill_id "
                + "JOIN skills requested ON sr.requested_skill_id = requested.skill_id "
                + "WHERE sr.receiver_id = ? "
                + "AND sr.status = 'PENDING' "
                + "ORDER BY sr.created_at ASC";

        try (Connection connection = DBConnection.getConnection()) {

            if (connection == null) {
                return requests;
            }

            try (PreparedStatement ps = connection.prepareStatement(sql)) {

                ps.setInt(1, receiverId);

                try (ResultSet rs = ps.executeQuery()) {

                    while (rs.next()) {

                        User sender = new User(
                                rs.getInt("sender_id"),
                                rs.getString("sender_name"),
                                null, null, null, null, null, null
                        );

                        User receiver = new User(
                                rs.getInt("receiver_id"),
                                rs.getString("receiver_name"),
                                null, null, null, null, null, null
                        );

                        SwapRequest request = new SwapRequest(
                                rs.getInt("request_id"),
                                sender,
                                receiver,
                                rs.getString("offered_skill"),
                                rs.getString("requested_skill"),
                                rs.getString("status")
                        );

                        requests.add(request);
                    }
                }
            }

        } catch (SQLException e) {
            e.printStackTrace();
        }

        return requests;
    }

    // Accept or reject a request (only the receiver can do this)
    public boolean updateRequestStatus(int requestId, int receiverId,
                                       String status) {

        if (!"ACCEPTED".equals(status) && !"REJECTED".equals(status)) {
            return false;
        }

        String sql = "UPDATE swap_requests "
                + "SET status = ? "
                + "WHERE request_id = ? "
                + "AND receiver_id = ? "
                + "AND status = 'PENDING'";

        try (Connection connection = DBConnection.getConnection()) {

            if (connection == null) {
                return false;
            }

            try (PreparedStatement ps = connection.prepareStatement(sql)) {

                ps.setString(1, status);
                ps.setInt(2, requestId);
                ps.setInt(3, receiverId);

                return ps.executeUpdate() > 0;
            }

        } catch (SQLException e) {
            e.printStackTrace();
        }

        return false;
    }

    // Cancel a pending request (only the sender can do this)
    public boolean cancelRequest(int requestId, int senderId) {

        String sql = "UPDATE swap_requests "
                + "SET status = 'CANCELLED' "
                + "WHERE request_id = ? "
                + "AND sender_id = ? "
                + "AND status = 'PENDING'";

        try (Connection connection = DBConnection.getConnection()) {

            if (connection == null) {
                return false;
            }

            try (PreparedStatement ps = connection.prepareStatement(sql)) {

                ps.setInt(1, requestId);
                ps.setInt(2, senderId);

                return ps.executeUpdate() > 0;
            }

        } catch (SQLException e) {
            e.printStackTrace();
        }

        return false;
    }

    // Get request details for notification purposes
    public Map<String, Object> getRequestDetails(int requestId) {

        String sql = "SELECT sender_id, receiver_id, status "
                + "FROM swap_requests WHERE request_id = ?";

        try (Connection connection = DBConnection.getConnection()) {

            if (connection == null) {
                return null;
            }

            try (PreparedStatement ps = connection.prepareStatement(sql)) {

                ps.setInt(1, requestId);

                try (ResultSet rs = ps.executeQuery()) {

                    if (rs.next()) {

                        Map<String, Object> details = new LinkedHashMap<>();

                        details.put("senderId", rs.getInt("sender_id"));
                        details.put("receiverId", rs.getInt("receiver_id"));
                        details.put("status", rs.getString("status"));

                        return details;
                    }
                }
            }

        } catch (SQLException e) {
            e.printStackTrace();
        }

        return null;
    }


    // Mark an accepted request as completed after both users confirm
    public boolean completeRequest(int requestId, int userId) {

        return completeRequestAndGetDetails(requestId, userId) != null;
    }

    // Complete a request and return its updated details
    public Map<String, Object> completeRequestAndGetDetails(
            int requestId, int userId) {

        String sql = "UPDATE swap_requests "
                + "SET sender_completed = CASE "
                + "WHEN sender_id = ? THEN TRUE "
                + "ELSE sender_completed END, "
                + "receiver_completed = CASE "
                + "WHEN receiver_id = ? THEN TRUE "
                + "ELSE receiver_completed END, "
                + "status = CASE "
                + "WHEN (sender_id = ? OR sender_completed = TRUE) "
                + "AND (receiver_id = ? OR receiver_completed = TRUE) "
                + "THEN 'COMPLETED' "
                + "ELSE 'ACCEPTED' END "
                + "WHERE request_id = ? "
                + "AND (sender_id = ? OR receiver_id = ?) "
                + "AND status = 'ACCEPTED' "
                + "RETURNING sender_id, receiver_id, status";

        try (Connection connection = DBConnection.getConnection()) {

            if (connection == null) {
                return null;
            }

            try (PreparedStatement ps = connection.prepareStatement(sql)) {

                ps.setInt(1, userId);
                ps.setInt(2, userId);
                ps.setInt(3, userId);
                ps.setInt(4, userId);
                ps.setInt(5, requestId);
                ps.setInt(6, userId);
                ps.setInt(7, userId);

                try (ResultSet rs = ps.executeQuery()) {

                    if (rs.next()) {

                        Map<String, Object> details = new LinkedHashMap<>();

                        details.put("senderId", rs.getInt("sender_id"));
                        details.put("receiverId", rs.getInt("receiver_id"));
                        details.put("status", rs.getString("status"));

                        return details;
                    }
                }
            }

        } catch (SQLException e) {
            e.printStackTrace();
        }

        return null;
    }


    // NEW (Learning Graph page): completed swaps with the skills exchanged.
    // Same filter as getCompletedSwapRelationships(), plus the skill names.
    public List<Map<String, Object>> getCompletedSwapDetails() {

        List<Map<String, Object>> swaps = new ArrayList<>();

        String sql = "SELECT sr.request_id, sr.sender_id, sr.receiver_id, "
                + "offered.skill_name AS offered_skill, "
                + "requested.skill_name AS requested_skill "
                + "FROM swap_requests sr "
                + "LEFT JOIN skills offered ON sr.offered_skill_id = offered.skill_id "
                + "JOIN skills requested ON sr.requested_skill_id = requested.skill_id "
                + "WHERE sr.status = 'COMPLETED' "
                + "AND sr.sender_completed = TRUE "
                + "AND sr.receiver_completed = TRUE "
                + "ORDER BY sr.request_id ASC";

        try (Connection connection = DBConnection.getConnection()) {

            if (connection == null) {
                return swaps;
            }

            try (PreparedStatement ps = connection.prepareStatement(sql);
                 ResultSet rs = ps.executeQuery()) {

                while (rs.next()) {

                    Map<String, Object> swap = new LinkedHashMap<>();

                    swap.put("requestId", rs.getInt("request_id"));
                    swap.put("senderId", rs.getInt("sender_id"));
                    swap.put("receiverId", rs.getInt("receiver_id"));
                    swap.put("offeredSkill", rs.getString("offered_skill"));
                    swap.put("requestedSkill", rs.getString("requested_skill"));

                    swaps.add(swap);
                }
            }

        } catch (SQLException e) {
            e.printStackTrace();
        }

        return swaps;
    }

    // NEW: Get all completed swap relationships for SkillGraph
    public List<Map<String, Integer>> getCompletedSwapRelationships() {

        List<Map<String, Integer>> relationships = new ArrayList<>();

        String sql = "SELECT sender_id, receiver_id "
                + "FROM swap_requests "
                + "WHERE status = 'COMPLETED' "
                + "AND sender_completed = TRUE "
                + "AND receiver_completed = TRUE "
                + "ORDER BY request_id ASC";

        try (Connection connection = DBConnection.getConnection()) {

            if (connection == null) {
                return relationships;
            }

            try (PreparedStatement ps = connection.prepareStatement(sql);
                 ResultSet rs = ps.executeQuery()) {

                while (rs.next()) {

                    Map<String, Integer> relationship = new LinkedHashMap<>();

                    relationship.put("senderId", rs.getInt("sender_id"));
                    relationship.put("receiverId", rs.getInt("receiver_id"));

                    relationships.add(relationship);
                }
            }

        } catch (SQLException e) {
            e.printStackTrace();
        }

        return relationships;
    }
}
