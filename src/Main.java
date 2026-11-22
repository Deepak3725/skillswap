
import com.sun.net.httpserver.HttpServer;

import controller.UserController;
import controller.MatchController;
import controller.ProfileController;
import controller.SkillController;
import controller.SearchController;
import controller.RequestController;
import controller.SkillGraphController;
import controller.NotificationController;
import controller.UserDetailsController;

import java.io.IOException;
import java.net.InetSocketAddress;

public class Main {

    public static void main(String[] args) throws IOException {

        // Read the port from the PORT environment variable
        // (required by most hosting platforms). Defaults to 8080.
        int port = 8080;
        String portValue = System.getenv("PORT");

        if (portValue != null && !portValue.isBlank()) {
            port = Integer.parseInt(portValue.trim());
        }

        // Create HTTP server on the configured port
        HttpServer server = HttpServer.create(
                new InetSocketAddress(port), 0
        );

        // User endpoints
        UserController userController = new UserController();

        server.createContext("/api/register", userController);
        server.createContext("/api/login", userController);
        server.createContext("/api/me", userController);
        server.createContext("/api/logout", userController);

        // Profile endpoint
        server.createContext("/api/profile",
                new ProfileController(userController));

        // Skills endpoint
        SkillController skillController =
                new SkillController(userController);

        server.createContext("/api/skills", skillController);

        // Search endpoint
        SearchController searchController =
                new SearchController(userController);

        server.createContext("/api/search", searchController);

        // Match endpoints
        MatchController matchController =
                new MatchController(userController);

        server.createContext("/api/matches", matchController);

        // Request endpoint
        RequestController requestController =
                new RequestController(userController);

        server.createContext("/api/requests", requestController);

        // Learning graph endpoint
        SkillGraphController skillGraphController =
                new SkillGraphController(userController);

        server.createContext("/api/learning-graph", skillGraphController);

        // Member details by ID (swap partners)
        server.createContext("/api/users/",
                new UserDetailsController(userController));

        // Notification endpoint
        NotificationController notificationController =
                new NotificationController(userController);

        server.createContext("/api/notifications", notificationController);


        // FRONTEND STATIC FILES

        server.createContext("/css/",
                new StaticFileHandler("views/css", "/css/"));

        server.createContext("/js/",
                new StaticFileHandler("views/js", "/js/"));

        server.createContext("/images/",
                new StaticFileHandler("images", "/images/"));

        // Serve login page at localhost:8080
        server.createContext("/",
                new StaticFileHandler("views/html", "/", "index.html"));


        // Handle several requests at the same time. Without an executor
        // the HttpServer runs every request on one thread, so a page that
        // calls several APIs waits for each database call in turn.
        server.setExecutor(java.util.concurrent.Executors.newFixedThreadPool(10));

        // Start server
        server.start();

        System.out.println(
                "SkillSwap server running at http://localhost:" + port
        );
    }
}
