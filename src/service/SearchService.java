
package service;

import model.User;
import repository.SearchRepository;

import java.util.List;

public class SearchService {

    private SearchRepository searchRepository;

    public SearchService() {
        this.searchRepository = new SearchRepository();
    }

    // Search users by teaching or learning skill
    public List<User> searchUsersBySkill(String skillName,
                                         int currentUserId) {

        if (currentUserId <= 0) {
            return List.of();
        }

        if (skillName == null || skillName.trim().isEmpty()) {
            return List.of();
        }

        return searchRepository.searchUsersBySkill(
                skillName.trim(),
                currentUserId
        );
    }
}