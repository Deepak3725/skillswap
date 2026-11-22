
package repository;

import config.DBConnection;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public class SkillRepository {

    // Add a skill to a user's teaching or learning list
    public boolean addUserSkill(int userId, String skillName,
                                String skillType) {

        String findSkillSQL =
                "INSERT INTO skills (skill_name) VALUES (?) "
                + "ON CONFLICT (skill_name) DO UPDATE "
                + "SET skill_name = EXCLUDED.skill_name "
                + "RETURNING skill_id";

        String addUserSkillSQL =
                "INSERT INTO user_skills (user_id, skill_id, skill_type) "
                + "VALUES (?, ?, ?) "
                + "ON CONFLICT (user_id, skill_id, skill_type) DO NOTHING";

        try (Connection connection = DBConnection.getConnection()) {

            if (connection == null) {
                return false;
            }

            connection.setAutoCommit(false);

            try {

                int skillId;

                // Find or create the skill
                try (PreparedStatement stmt =
                             connection.prepareStatement(findSkillSQL)) {

                    stmt.setString(1, skillName);

                    ResultSet rs = stmt.executeQuery();

                    if (!rs.next()) {
                        connection.rollback();
                        return false;
                    }

                    skillId = rs.getInt("skill_id");
                }

                // Connect the skill to the user
                try (PreparedStatement stmt =
                             connection.prepareStatement(addUserSkillSQL)) {

                    stmt.setInt(1, userId);
                    stmt.setInt(2, skillId);
                    stmt.setString(3, skillType);

                    stmt.executeUpdate();
                }

                connection.commit();

                return true;

            } catch (SQLException e) {

                connection.rollback();
                e.printStackTrace();

                return false;
            }

        } catch (SQLException e) {

            e.printStackTrace();
            return false;
        }
    }

    // Remove a skill from a user's teaching or learning list
    public boolean removeUserSkill(int userId, String skillName,
                                   String skillType) {

        String sql = "DELETE FROM user_skills "
                + "WHERE user_id = ? "
                + "AND skill_type = ? "
                + "AND skill_id = ("
                + "SELECT skill_id FROM skills WHERE skill_name = ?"
                + ")";

        try (Connection connection = DBConnection.getConnection()) {

            if (connection == null) {
                return false;
            }

            try (PreparedStatement stmt = connection.prepareStatement(sql)) {

                stmt.setInt(1, userId);
                stmt.setString(2, skillType);
                stmt.setString(3, skillName);

                int rowsDeleted = stmt.executeUpdate();

                return rowsDeleted == 1;
            }

        } catch (SQLException e) {

            e.printStackTrace();
        }

        return false;
    }

    // Get all teaching or learning skills of a user
    public List<String> getUserSkills(int userId, String skillType) {

        List<String> skills = new ArrayList<>();

        String sql = "SELECT s.skill_name "
                + "FROM skills s "
                + "JOIN user_skills us ON s.skill_id = us.skill_id "
                + "WHERE us.user_id = ? AND us.skill_type = ? "
                + "ORDER BY s.skill_name";

        try (Connection connection = DBConnection.getConnection()) {

            if (connection == null) {
                return skills;
            }

            try (PreparedStatement stmt = connection.prepareStatement(sql)) {

                stmt.setInt(1, userId);
                stmt.setString(2, skillType);

                ResultSet rs = stmt.executeQuery();

                while (rs.next()) {
                    skills.add(rs.getString("skill_name"));
                }
            }

        } catch (SQLException e) {

            e.printStackTrace();
        }

        return skills;
    }
}