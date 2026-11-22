
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;

public class StaticFileHandler implements HttpHandler {

    private final Path directory;
    private final String urlPrefix;
    private final String defaultFile;

    // Constructor for CSS, JS and images
    public StaticFileHandler(String directory, String urlPrefix) {
        this(directory, urlPrefix, null);
    }

    // Constructor for the HTML pages
    public StaticFileHandler(
            String directory,
            String urlPrefix,
            String defaultFile
    ) {
        this.directory = Path.of(directory)
                .toAbsolutePath()
                .normalize();

        this.urlPrefix = urlPrefix;
        this.defaultFile = defaultFile;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {

        String method = exchange.getRequestMethod();

        // Allow only GET and HEAD requests
        if (!method.equalsIgnoreCase("GET")
                && !method.equalsIgnoreCase("HEAD")) {

            exchange.getResponseHeaders().set(
                    "Allow", "GET, HEAD"
            );

            exchange.sendResponseHeaders(405, -1);
            exchange.close();
            return;
        }

        // Get requested URL path
        String requestPath = exchange.getRequestURI().getPath();

        // Remove the URL prefix
        String filePath = requestPath.substring(urlPrefix.length());

        // Use default file for the root URL
        if (filePath.isEmpty() && defaultFile != null) {
            filePath = defaultFile;
        }

        // Resolve requested file
        Path file = directory.resolve(filePath)
                .normalize();

        // Prevent access outside the intended directory
        if (!file.startsWith(directory)) {
            exchange.sendResponseHeaders(403, -1);
            exchange.close();
            return;
        }

        // Check whether file exists
        if (!Files.isRegularFile(file)) {
            exchange.sendResponseHeaders(404, -1);
            exchange.close();
            return;
        }

        // Determine content type
        String contentType = Files.probeContentType(file);

        if (contentType == null) {
            contentType = "application/octet-stream";
        }

        String fileName = file.getFileName()
                .toString()
                .toLowerCase();

        if (fileName.endsWith(".html")) {
            contentType = "text/html; charset=UTF-8";
        } else if (fileName.endsWith(".css")) {
            contentType = "text/css; charset=UTF-8";
        } else if (fileName.endsWith(".js")) {
            contentType = "application/javascript; charset=UTF-8";
        } else if (fileName.endsWith(".png")) {
            contentType = "image/png";
        } else if (fileName.endsWith(".jpg")
                || fileName.endsWith(".jpeg")) {
            contentType = "image/jpeg";
        } else if (fileName.endsWith(".webp")) {
            contentType = "image/webp";
        } else if (fileName.endsWith(".svg")) {
            contentType = "image/svg+xml";
        } else if (fileName.endsWith(".ico")) {
            contentType = "image/x-icon";
        }

        exchange.getResponseHeaders().set(
                "Content-Type", contentType
        );

        exchange.getResponseHeaders().set(
                "Cache-Control", "no-cache"
        );

        // Handle HEAD requests
        if (method.equalsIgnoreCase("HEAD")) {
            exchange.sendResponseHeaders(200, -1);
            exchange.close();
            return;
        }

        // Read and send file
        byte[] content = Files.readAllBytes(file);

        exchange.sendResponseHeaders(200, content.length);

        try (OutputStream output =
                     exchange.getResponseBody()) {

            output.write(content);
        }
    }
}
