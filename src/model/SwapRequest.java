
package model;

public class SwapRequest {
    private User from;     // the person asking
    private User to;       // the person being asked
    private String skill;  // the skill requested, e.g. "Python"

    // NEW: Database request fields
    private int requestId;
    private String offeredSkill;
    private String requestedSkill;
    private String status;

    public SwapRequest(User from, User to, String skill) {
        this.from = from;
        this.to = to;
        this.skill = skill;
    }

    // NEW: Constructor for database requests
    public SwapRequest(int requestId, User from, User to,
                       String offeredSkill, String requestedSkill,
                       String status) {
        this.from = from;
        this.to = to;
        this.offeredSkill = offeredSkill;
        this.requestedSkill = requestedSkill;
        this.skill = requestedSkill;
        this.requestId = requestId;
        this.status = status;
    }

    public User getFrom() {
        return from;
    }

    public User getTo() {
        return to;
    }

    public String getSkill() {
        return skill;
    }

    // NEW: Getters for database request fields
    public int getRequestId() {
        return requestId;
    }

    public String getOfferedSkill() {
        return offeredSkill;
    }

    public String getRequestedSkill() {
        return requestedSkill;
    }

    public String getStatus() {
        return status;
    }

    public String toString() {
        return from.getName() + " -> " + to.getName() + " : " + skill;
    }
}
