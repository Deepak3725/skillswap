
package repository;

import config.DBConnection;
import model.User;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class UserRepository {

    // Register a new user in the database
    public int registerUser(User user) {

        String sql = "INSERT INTO users "
                + "(name, email, password, profile_picture, bio, whatsapp, telegram) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING user_id";

        try (Connection connection = DBConnection.getConnection()) {

            if (connection == null) {
                return -1;
            }

            try (PreparedStatement stmt = connection.prepareStatement(sql)) {

                stmt.setString(1, user.getName());
                stmt.setString(2, user.getEmail());
                stmt.setString(3, user.getPassword());
                stmt.setString(4, user.getProfilePicture());
                stmt.setString(5, user.getBio());
                stmt.setString(6, user.getWhatsapp());
                stmt.setString(7, user.getTelegram());

                ResultSet rs = stmt.executeQuery();

                if (rs.next()) {
                    return rs.getInt("user_id");
                }
            }

        } catch (SQLException e) {
            e.printStackTrace();
        }

        return -1;
    }

    // Find user by email for login
    public User findByEmail(String email) {

        String sql = "SELECT * FROM users WHERE email = ?";

        try (Connection connection = DBConnection.getConnection()) {

            if (connection == null) {
                return null;
            }

            try (PreparedStatement stmt = connection.prepareStatement(sql)) {

                stmt.setString(1, email);

                ResultSet rs = stmt.executeQuery();

                if (rs.next()) {

                    User user = new User(
                            rs.getInt("user_id"),
                            rs.getString("name"),
                            rs.getString("email"),
                            rs.getString("password"),
                            rs.getString("profile_picture"),
                            rs.getString("bio"),
                            rs.getString("whatsapp"),
                            rs.getString("telegram")
                    );

                    return user;
                }

            }

        } catch (SQLException e) {
            e.printStackTrace();
        }

        return null;
    }

    // Find user by ID
    public User findById(int userId) {

        String sql = "SELECT * FROM users WHERE user_id = ?";

        try (Connection connection = DBConnection.getConnection()) {

            if (connection == null) {
                return null;
            }

            try (PreparedStatement stmt = connection.prepareStatement(sql)) {

                stmt.setInt(1, userId);

                ResultSet rs = stmt.executeQuery();

                if (rs.next()) {

                    User user = new User(
                            rs.getInt("user_id"),
                            rs.getString("name"),
                            rs.getString("email"),
                            rs.getString("password"),
                            rs.getString("profile_picture"),
                            rs.getString("bio"),
                            rs.getString("whatsapp"),
                            rs.getString("telegram")
                    );

                    // Load the user's teaching and learning skills
                    loadUserSkills(user, connection);

                    return user;
                }

            }

        } catch (SQLException e) {
            e.printStackTrace();
        }

        return null;
    }

    // Get all registered users with their skills
    public java.util.List<User> getAllUsers() {

        java.util.List<User> users = new java.util.ArrayList<>();

        String sql = "SELECT * FROM users ORDER BY user_id";

        try (Connection connection = DBConnection.getConnection()) {

            if (connection == null) {
                return users;
            }

            try (PreparedStatement stmt = connection.prepareStatement(sql);
                 ResultSet rs = stmt.executeQuery()) {

                while (rs.next()) {

                    User user = new User(
                            rs.getInt("user_id"),
                            rs.getString("name"),
                            rs.getString("email"),
                            rs.getString("password"),
                            rs.getString("profile_picture"),
                            rs.getString("bio"),
                            rs.getString("whatsapp"),
                            rs.getString("telegram")
                    );

                    users.add(user);
                }
            }

            // Load the teaching and learning skills of all users with one
            // query (one query per user was slow on a remote database).
            loadAllUserSkills(users, connection);

        } catch (SQLException e) {
            e.printStackTrace();
        }

        return users;
    }

    // Same as loadUserSkills(), for a whole list of users at once
    private void loadAllUserSkills(java.util.List<User> users,
                                   Connection connection)
            throws SQLException {

        java.util.Map<Integer, User> byId = new java.util.HashMap<>();

        for (User user : users) {
            byId.put(user.getUserId(), user);
        }

        String sql = "SELECT us.user_id, s.skill_name, us.skill_type "
                + "FROM user_skills us "
                + "JOIN skills s ON us.skill_id = s.skill_id";

        try (PreparedStatement stmt = connection.prepareStatement(sql);
             ResultSet rs = stmt.executeQuery()) {

            while (rs.next()) {

                User user = byId.get(rs.getInt("user_id"));

                if (user == null) {
                    continue;
                }

                String skillName = rs.getString("skill_name");
                String skillType = rs.getString("skill_type");

                if (skillType.equals("TEACH")) {
                    user.addTeachSkills(skillName);
                }

                else if (skillType.equals("WANT")) {
                    user.addWantSkills(skillName);
                }
            }
        }
    }

    // Load user's teaching and learning skills from database
    private void loadUserSkills(User user, Connection connection)
            throws SQLException {

        String sql = "SELECT s.skill_name, us.skill_type "
                + "FROM user_skills us "
                + "JOIN skills s ON us.skill_id = s.skill_id "
                + "WHERE us.user_id = ?";

        try (PreparedStatement stmt = connection.prepareStatement(sql)) {

            stmt.setInt(1, user.getUserId());

            ResultSet rs = stmt.executeQuery();

            while (rs.next()) {

                String skillName = rs.getString("skill_name");
                String skillType = rs.getString("skill_type");

                if (skillType.equals("TEACH")) {
                    user.addTeachSkills(skillName);
                }

                else if (skillType.equals("WANT")) {
                    user.addWantSkills(skillName);
                }
            }
        }
    }

    // Update logged-in user's profile
    public boolean updateProfile(int userId, String name,
                                 String profilePicture, String bio,
                                 String whatsapp, String telegram) {

        String sql = "UPDATE users SET name = ?, profile_picture = ?, "
                + "bio = ?, whatsapp = ?, telegram = ? "
                + "WHERE user_id = ?";

        try (Connection connection = DBConnection.getConnection()) {

            if (connection == null) {
                return false;
            }

            try (PreparedStatement stmt = connection.prepareStatement(sql)) {

                stmt.setString(1, name);
                stmt.setString(2, profilePicture);
                stmt.setString(3, bio);
                stmt.setString(4, whatsapp);
                stmt.setString(5, telegram);
                stmt.setInt(6, userId);

                int rowsUpdated = stmt.executeUpdate();

                return rowsUpdated == 1;
            }

        } catch (SQLException e) {
            e.printStackTrace();
        }

        return false;
    }
}
