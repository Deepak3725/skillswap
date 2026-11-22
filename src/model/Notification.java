
package model;

import java.sql.Timestamp;

public class Notification {

    private int notificationId;
    private int userId;
    private Integer requestId;
    private String message;
    private boolean isRead;
    private Timestamp createdAt;

    public Notification(int notificationId, int userId,
                        Integer requestId, String message,
                        boolean isRead, Timestamp createdAt) {

        this.notificationId = notificationId;
        this.userId = userId;
        this.requestId = requestId;
        this.message = message;
        this.isRead = isRead;
        this.createdAt = createdAt;
    }

    public int getNotificationId() {
        return notificationId;
    }

    public int getUserId() {
        return userId;
    }

    public Integer getRequestId() {
        return requestId;
    }

    public String getMessage() {
        return message;
    }

    public boolean isRead() {
        return isRead;
    }

    public Timestamp getCreatedAt() {
        return createdAt;
    }
}
