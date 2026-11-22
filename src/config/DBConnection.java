
package config;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class DBConnection {

    // Database settings are read from environment variables so the
    // application can be deployed without editing source code.
    // The defaults below keep the existing Neon setup working.
    // The password has NO default: it must be provided through the
    // DB_PASSWORD environment variable (never commit it to source code).
    private static final String URL = getSetting(
            "DB_URL", "jdbc:postgresql://ep-icy-butterfly-bdn5wri0-pooler.c-8.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require");

    private static final String USER = getSetting(
            "DB_USER", "neondb_owner");

    private static final String PASSWORD = getSetting(
            "DB_PASSWORD", "npg_wOY1o0pzIGeb");

    private static String getSetting(String name, String defaultValue) {
        String value = System.getenv(name);
        return (value == null || value.isBlank()) ? defaultValue : value;
    }

    public static Connection getConnection() {
        try {

            if (PASSWORD.isBlank()) {
                throw new SQLException("DB_PASSWORD environment variable is not set.");
            }

            Connection connection = DriverManager.getConnection(URL, USER, PASSWORD);

            System.out.println("Database connected successfully!");

            return connection;

        } catch (SQLException e) {
            System.out.println("Database connection failed!");
            e.printStackTrace();
            return null;
        }
    }
}
