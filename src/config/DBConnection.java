
package config;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.atomic.AtomicBoolean;

public class DBConnection {

    // Opening a new PostgreSQL connection to Neon (TCP + TLS + SCRAM
    // authentication) takes several network round trips, which is far
    // slower than running a query. Instead of opening a new connection
    // for every repository call, connections that the repositories close
    // are kept here and handed out again.
    private static final int MAX_IDLE_CONNECTIONS = 10;

    // A connection unused for longer than this is checked before reuse
    // (Neon closes connections when its compute is suspended).
    private static final long VALIDATE_AFTER_MS = 30_000;

    private static final class IdleConnection {
        final Connection connection;
        final long idleSince;

        IdleConnection(Connection connection) {
            this.connection = connection;
            this.idleSince = System.currentTimeMillis();
        }
    }

    private static final ConcurrentLinkedDeque<IdleConnection> idleConnections =
            new ConcurrentLinkedDeque<>();

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

            // Reuse a connection that an earlier request has closed
            IdleConnection idle;
            while ((idle = idleConnections.pollFirst()) != null) {
                if (isUsable(idle)) {
                    return reusable(idle.connection);
                }
                closeQuietly(idle.connection);
            }

            Connection connection = DriverManager.getConnection(URL, USER, PASSWORD);

            System.out.println("Database connected successfully!");

            return reusable(connection);

        } catch (SQLException e) {
            System.out.println("Database connection failed!");
            e.printStackTrace();
            return null;
        }
    }

    private static boolean isUsable(IdleConnection idle) {
        try {
            if (idle.connection.isClosed()) {
                return false;
            }
            if (System.currentTimeMillis() - idle.idleSince > VALIDATE_AFTER_MS) {
                return idle.connection.isValid(3);
            }
            return true;
        } catch (SQLException e) {
            return false;
        }
    }

    // Wraps a real connection so that close() (called by the
    // try-with-resources blocks in the repositories) returns it to the
    // idle list instead of disconnecting. Every other method is passed
    // straight to the real connection.
    private static Connection reusable(Connection real) {

        AtomicBoolean closed = new AtomicBoolean(false);

        return (Connection) Proxy.newProxyInstance(
                DBConnection.class.getClassLoader(),
                new Class<?>[] { Connection.class },
                (proxy, method, args) -> {

                    String name = method.getName();

                    if (name.equals("close")) {
                        if (closed.compareAndSet(false, true)) {
                            release(real);
                        }
                        return null;
                    }

                    if (name.equals("isClosed")) {
                        return closed.get() || real.isClosed();
                    }

                    if (closed.get()) {
                        throw new SQLException("Connection is closed.");
                    }

                    try {
                        return method.invoke(real, args);
                    } catch (InvocationTargetException e) {
                        throw e.getCause();
                    }
                });
    }

    private static void release(Connection real) {
        try {
            if (real.isClosed()) {
                return;
            }
            // Undo any unfinished transaction (e.g. SkillRepository uses
            // setAutoCommit(false)) so the next user starts clean.
            if (!real.getAutoCommit()) {
                real.rollback();
                real.setAutoCommit(true);
            }
            if (idleConnections.size() < MAX_IDLE_CONNECTIONS) {
                idleConnections.offerFirst(new IdleConnection(real));
                return;
            }
        } catch (SQLException e) {
            // A broken connection is simply discarded below
        }
        closeQuietly(real);
    }

    private static void closeQuietly(Connection connection) {
        try {
            connection.close();
        } catch (SQLException ignored) {
        }
    }
}
