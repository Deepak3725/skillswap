
package service;

import repository.SkillRepository;

import java.util.List;

public class SkillService {

    private SkillRepository skillRepository;

    public SkillService() {
        this.skillRepository = new SkillRepository();
    }

    // Add a teaching or learning skill
    public String addSkill(int userId, String skillName,
                           String skillType) {

        if (userId <= 0) {
            return "Invalid user.";
        }

        if (skillName == null || skillName.trim().isEmpty()) {
            return "Skill name cannot be empty.";
        }

        skillType = skillType == null
                ? ""
                : skillType.trim().toUpperCase();

        if (!skillType.equals("TEACH")
                && !skillType.equals("WANT")) {

            return "Invalid skill type.";
        }

        boolean added = skillRepository.addUserSkill(
                userId,
                skillName.trim(),
                skillType
        );

        if (added) {
            return "Skill added successfully.";
        }

        return "Could not add skill.";
    }

    // Remove a teaching or learning skill
    public String removeSkill(int userId, String skillName,
                              String skillType) {

        if (userId <= 0) {
            return "Invalid user.";
        }

        if (skillName == null || skillName.trim().isEmpty()) {
            return "Skill name cannot be empty.";
        }

        skillType = skillType == null
                ? ""
                : skillType.trim().toUpperCase();

        if (!skillType.equals("TEACH")
                && !skillType.equals("WANT")) {

            return "Invalid skill type.";
        }

        boolean removed = skillRepository.removeUserSkill(
                userId,
                skillName.trim(),
                skillType
        );

        if (removed) {
            return "Skill removed successfully.";
        }

        return "Could not remove skill.";
    }

    // Get teaching skills
    public List<String> getTeachingSkills(int userId) {

        if (userId <= 0) {
            return List.of();
        }

        return skillRepository.getUserSkills(userId, "TEACH");
    }

    // Get learning skills
    public List<String> getLearningSkills(int userId) {

        if (userId <= 0) {
            return List.of();
        }

        return skillRepository.getUserSkills(userId, "WANT");
    }
}