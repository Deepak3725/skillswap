package model;

public class Match {
    private User user;
    private double score; // Private because we don't want it to be modified directly.

    public Match(User user, double score) {
        this.user = user;
        this.score = score;
    }

    public User getUser() {
        return user;
    }

    public double getScore() {
        return score;
    }
}