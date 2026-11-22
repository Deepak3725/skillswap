
package service;

import model.User;
import repository.UserRepository;

public class ProfileService {

    private UserRepository userRepository;

    public ProfileService() {
        this.userRepository = new UserRepository();
    }

    // Get logged-in user's profile
    public User getProfile(int userId) {

        if (userId <= 0) {
            return null;
        }

        return userRepository.findById(userId);
    }

    // Update logged-in user's profile
    public String updateProfile(int userId, String name,
                                String profilePicture, String bio,
                                String whatsapp, String telegram) {

        if (userId <= 0) {
            return "Invalid user.";
        }

        if (name == null || name.trim().isEmpty()) {
            return "Name cannot be empty.";
        }

        boolean updated = userRepository.updateProfile(
                userId,
                name.trim(),
                profilePicture,
                bio,
                whatsapp,
                telegram
        );

        if (updated) {
            return "Profile updated successfully.";
        }

        return "Could not update profile.";
    }
}