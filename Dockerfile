# ---------- Build stage: compile the Java sources ----------
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY lib/ lib/
COPY src/ src/
RUN mkdir -p out \
 && find src -name "*.java" > sources.list \
 && javac --add-modules jdk.httpserver -cp "lib/*" -d out @sources.list

# ---------- Runtime stage ----------
FROM eclipse-temurin:21-jre
WORKDIR /app

# Static files are served relative to the working directory
# (views/css, views/js, views/html, images) — see src/Main.java.
COPY --from=build /app/out out/
COPY lib/ lib/
COPY views/ views/
COPY images/ images/

# Timestamps are created by PostgreSQL in the JDBC session time zone, which
# follows the JVM time zone. Set TZ to your users' time zone.
ENV TZ=Asia/Thimphu \
    PORT=8080

EXPOSE 8080
CMD ["sh", "-c", "exec java --add-modules jdk.httpserver -Duser.timezone=${TZ} -cp 'out:lib/*' Main"]
