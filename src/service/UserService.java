
package service;

import model.User;
import repository.UserRepository;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.SecureRandom;
import java.util.Base64;

public class UserService {

    private UserRepository userRepository;

    public UserService() {
        this.userRepository = new UserRepository();
    }

    // Register a new user
    public String registerUser(User user) {

        if (user == null || user.getEmail() == null
                || user.getPassword() == null
                || user.getName() == null
                || user.getEmail().isBlank()
                || user.getPassword().isBlank()
                || user.getName().isBlank()) {

            return "Name, email and password are required!";
        }

        // Check whether email already exists
        User existingUser = userRepository.findByEmail(user.getEmail());

        if (existingUser != null) {
            return "Email already registered!";
        }

        try {

            // Hash password before saving user
            String hashedPassword = hashPassword(user.getPassword());

            User newUser = new User(
                    0,
                    user.getName(),
                    user.getEmail(),
                    hashedPassword,
                    user.getProfilePicture(),
                    user.getBio(),
                    user.getWhatsapp(),
                    user.getTelegram()
            );

            // Save user in database
            int userId = userRepository.registerUser(newUser);

            if (userId != -1) {
                return "Registration successful! User ID: " + userId;
            }

        } catch (Exception e) {
            e.printStackTrace();
        }

        return "Registration failed!";
    }

    // Login user
    public User loginUser(String email, String password) {

        User user = userRepository.findByEmail(email);

        if (user == null || password == null) {
            return null;
        }

        try {

            if (verifyPassword(password, user.getPassword())) {
                return user;
            }

        } catch (Exception e) {
            e.printStackTrace();
        }

        return null;
    }

    // Hash password using PBKDF2
    private String hashPassword(String password) throws Exception {

        int iterations = 120000;
        byte[] salt = new byte[16];

        SecureRandom random = new SecureRandom();
        random.nextBytes(salt);

        PBEKeySpec spec = new PBEKeySpec(
                password.toCharArray(),
                salt,
                iterations,
                256
        );

        SecretKeyFactory factory = SecretKeyFactory.getInstance(
                "PBKDF2WithHmacSHA256"
        );

        byte[] hash = factory.generateSecret(spec).getEncoded();

        spec.clearPassword();

        return iterations + ":"
                + Base64.getEncoder().encodeToString(salt) + ":"
                + Base64.getEncoder().encodeToString(hash);
    }

    // Verify password during login
    private boolean verifyPassword(String password, String storedPassword)
            throws Exception {

        String[] parts = storedPassword.split(":");

        int iterations = Integer.parseInt(parts[0]);

        byte[] salt = Base64.getDecoder().decode(parts[1]);
        byte[] originalHash = Base64.getDecoder().decode(parts[2]);

        PBEKeySpec spec = new PBEKeySpec(
                password.toCharArray(),
                salt,
                iterations,
                256
        );

        SecretKeyFactory factory = SecretKeyFactory.getInstance(
                "PBKDF2WithHmacSHA256"
        );

        byte[] newHash = factory.generateSecret(spec).getEncoded();

        spec.clearPassword();

        if (newHash.length != originalHash.length) {
            return false;
        }

        int difference = 0;

        for (int i = 0; i < newHash.length; i++) {
            difference |= newHash[i] ^ originalHash[i];
        }

        return difference == 0;
    }
}
