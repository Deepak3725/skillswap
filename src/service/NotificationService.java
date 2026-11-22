
package service;

import model.Notification;
import repository.NotificationRepository;

import java.util.List;

public class NotificationService {

    private NotificationRepository notificationRepository;

    public NotificationService() {
        this.notificationRepository = new NotificationRepository();
    }

    // Create a notification
    public boolean createNotification(int userId, Integer requestId,
                                      String message) {

        if (userId <= 0 || message == null || message.trim().isEmpty()) {
            return false;
        }

        return notificationRepository.createNotification(
                userId, requestId, message
        );
    }

    // Get all notifications for a user
    public List<Notification> getNotifications(int userId) {

        return notificationRepository.getNotifications(userId);
    }

    // Mark one notification as read
    public boolean markAsRead(int notificationId, int userId) {

        if (notificationId <= 0 || userId <= 0) {
            return false;
        }

        return notificationRepository.markAsRead(
                notificationId, userId
        );
    }

    // Mark all notifications as read
    public boolean markAllAsRead(int userId) {

        if (userId <= 0) {
            return false;
        }

        return notificationRepository.markAllAsRead(userId);
    }
}
