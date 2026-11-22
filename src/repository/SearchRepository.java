
package repository;

import config.DBConnection;
import model.User;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class SearchRepository {

    // Search users by a skill they teach or want to learn (partial match)
    public List<User> searchUsersBySkill(String skillName, int currentUserId) {

        List<User> users = new ArrayList<>();

        String sql = "SELECT u.user_id, u.name, u.email, "
                + "u.profile_picture, u.bio, u.whatsapp, u.telegram, "
                + "s.skill_name, us.skill_type "
                + "FROM users u "
                + "LEFT JOIN user_skills us ON u.user_id = us.user_id "
                + "LEFT JOIN skills s ON us.skill_id = s.skill_id "
                + "WHERE u.user_id <> ? "
                + "AND EXISTS ("
                + "SELECT 1 FROM user_skills search_us "
                + "JOIN skills search_s "
                + "ON search_us.skill_id = search_s.skill_id "
                + "WHERE search_us.user_id = u.user_id "
                + "AND LOWER(search_s.skill_name) LIKE LOWER(?) ESCAPE '\\'"
                + ") "
                + "ORDER BY u.name, s.skill_name";

        Map<Integer, User> userMap = new LinkedHashMap<>();

        try (Connection connection = DBConnection.getConnection()) {

            if (connection == null) {
                return users;
            }

            try (PreparedStatement stmt = connection.prepareStatement(sql)) {

                stmt.setInt(1, currentUserId);
                // Partial, case-insensitive match: "yth" finds "Python".
                // LIKE wildcards typed by the user are matched literally.
                String term = skillName.trim()
                        .replace("\\", "\\\\")
                        .replace("%", "\\%")
                        .replace("_", "\\_");

                stmt.setString(2, "%" + term + "%");

                ResultSet rs = stmt.executeQuery();

                while (rs.next()) {

                    int userId = rs.getInt("user_id");

                    // Check whether the user is already in the result
                    User user = userMap.get(userId);

                    if (user == null) {

                        user = new User(
                                userId,
                                rs.getString("name"),
                                rs.getString("email"),
                                null,
                                rs.getString("profile_picture"),
                                rs.getString("bio"),
                                rs.getString("whatsapp"),
                                rs.getString("telegram")
                        );

                        userMap.put(userId, user);
                    }

                    // Add the user's skills
                    String returnedSkill = rs.getString("skill_name");
                    String skillType = rs.getString("skill_type");

                    if (returnedSkill != null && skillType != null) {

                        if (skillType.equals("TEACH")) {
                            user.addTeachSkills(returnedSkill);
                        }

                        else if (skillType.equals("WANT")) {
                            user.addWantSkills(returnedSkill);
                        }
                    }
                }
            }

        } catch (SQLException e) {

            e.printStackTrace();
        }

        users.addAll(userMap.values());

        return users;
    }

    // Get all other users with their teaching and learning skills
    public List<User> getAllOtherUsers(int currentUserId) {

        List<User> users = new ArrayList<>();

        String sql = "SELECT u.user_id, u.name, u.email, "
                + "u.profile_picture, u.bio, u.whatsapp, u.telegram, "
                + "s.skill_name, us.skill_type "
                + "FROM users u "
                + "LEFT JOIN user_skills us ON u.user_id = us.user_id "
                + "LEFT JOIN skills s ON us.skill_id = s.skill_id "
                + "WHERE u.user_id <> ? "
                + "ORDER BY u.name, s.skill_name";

        Map<Integer, User> userMap = new LinkedHashMap<>();

        try (Connection connection = DBConnection.getConnection()) {

            if (connection == null) {
                return users;
            }

            try (PreparedStatement stmt = connection.prepareStatement(sql)) {

                stmt.setInt(1, currentUserId);

                ResultSet rs = stmt.executeQuery();

                while (rs.next()) {

                    int userId = rs.getInt("user_id");

                    // Check whether the user is already in the result
                    User user = userMap.get(userId);

                    if (user == null) {

                        user = new User(
                                userId,
                                rs.getString("name"),
                                rs.getString("email"),
                                null,
                                rs.getString("profile_picture"),
                                rs.getString("bio"),
                                rs.getString("whatsapp"),
                                rs.getString("telegram")
                        );

                        userMap.put(userId, user);
                    }

                    // Add the user's skills
                    String returnedSkill = rs.getString("skill_name");
                    String skillType = rs.getString("skill_type");

                    if (returnedSkill != null && skillType != null) {

                        if (skillType.equals("TEACH")) {
                            user.addTeachSkills(returnedSkill);
                        }

                        else if (skillType.equals("WANT")) {
                            user.addWantSkills(returnedSkill);
                        }
                    }
                }
            }

        } catch (SQLException e) {

            e.printStackTrace();
        }

        users.addAll(userMap.values());

        return users;
    }
}
