
package repository;

import config.DBConnection;
import model.Notification;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public class NotificationRepository {

    // Save a new notification
    public boolean createNotification(int userId, Integer requestId,
                                      String message) {

        String sql = "INSERT INTO notifications "
                + "(user_id, request_id, message) "
                + "VALUES (?, ?, ?)";

        try (Connection connection = DBConnection.getConnection()) {

            if (connection == null) {
                return false;
            }

            try (PreparedStatement stmt = connection.prepareStatement(sql)) {

                stmt.setInt(1, userId);

                if (requestId == null) {
                    stmt.setNull(2, java.sql.Types.INTEGER);
                } else {
                    stmt.setInt(2, requestId);
                }

                stmt.setString(3, message);

                return stmt.executeUpdate() > 0;
            }

        } catch (SQLException e) {
            e.printStackTrace();
        }

        return false;
    }

    // Get all notifications belonging to a user
    public List<Notification> getNotifications(int userId) {

        List<Notification> notifications = new ArrayList<>();

        String sql = "SELECT * FROM notifications "
                + "WHERE user_id = ? "
                + "ORDER BY created_at DESC";

        try (Connection connection = DBConnection.getConnection()) {

            if (connection == null) {
                return notifications;
            }

            try (PreparedStatement stmt = connection.prepareStatement(sql)) {

                stmt.setInt(1, userId);

                try (ResultSet rs = stmt.executeQuery()) {

                    while (rs.next()) {

                        int requestIdValue = rs.getInt("request_id");

                        Integer requestId = rs.wasNull()
                                ? null : requestIdValue;

                        Notification notification = new Notification(
                                rs.getInt("notification_id"),
                                rs.getInt("user_id"),
                                requestId,
                                rs.getString("message"),
                                rs.getBoolean("is_read"),
                                rs.getTimestamp("created_at")
                        );

                        notifications.add(notification);
                    }
                }
            }

        } catch (SQLException e) {
            e.printStackTrace();
        }

        return notifications;
    }

    // Mark a notification as read
    public boolean markAsRead(int notificationId, int userId) {

        String sql = "UPDATE notifications "
                + "SET is_read = TRUE "
                + "WHERE notification_id = ? AND user_id = ?";

        try (Connection connection = DBConnection.getConnection()) {

            if (connection == null) {
                return false;
            }

            try (PreparedStatement stmt = connection.prepareStatement(sql)) {

                stmt.setInt(1, notificationId);
                stmt.setInt(2, userId);

                return stmt.executeUpdate() > 0;
            }

        } catch (SQLException e) {
            e.printStackTrace();
        }

        return false;
    }

    // Mark all notifications as read for a user
    public boolean markAllAsRead(int userId) {

        String sql = "UPDATE notifications "
                + "SET is_read = TRUE "
                + "WHERE user_id = ? AND is_read = FALSE";

        try (Connection connection = DBConnection.getConnection()) {

            if (connection == null) {
                return false;
            }

            try (PreparedStatement stmt = connection.prepareStatement(sql)) {

                stmt.setInt(1, userId);

                stmt.executeUpdate();

                return true;
            }

        } catch (SQLException e) {
            e.printStackTrace();
        }

        return false;
    }
}
