# Deploying SkillSwap

SkillSwap is a single Java process (built-in `com.sun.net.httpserver`) that serves both the
REST API (`/api/...`) and the frontend (`/`, `/css/`, `/js/`, `/images/`), backed by PostgreSQL.

## 1. Requirements

| Component | Version |
|-----------|---------|
| Java (JDK to build, JRE to run) | 17 or newer — Java 21 LTS recommended (the Docker image uses Temurin 21) |
| PostgreSQL | 13 or newer (developed on PostgreSQL 18; tested schema on 16+) |
| Libraries (already in `lib/`) | `gson-2.15.0.jar`, `postgresql-42.7.14.jar` |

## 2. Environment variables

| Variable | Required | Default (local dev only) | Purpose |
|----------|----------|--------------------------|---------|
| `PORT` | No | `8080` | HTTP port. Most hosts (Render, Railway, Fly, Heroku-style) set this automatically. |
| `DB_URL` | **Yes in production** | `jdbc:postgresql://localhost:5433/skillswap` | JDBC URL of the database |
| `DB_USER` | **Yes in production** | `postgres` | Database user |
| `DB_PASSWORD` | **Yes in production** | local dev password | Database password |
| `TZ` | Recommended | Host time zone | Time zone for timestamps (see §8) |

`DB_URL` must be in **JDBC** form. If your host gives you a URL like
`postgres://USER:PASSWORD@HOST:5432/DBNAME`, convert it to:

```
DB_URL=jdbc:postgresql://HOST:5432/DBNAME?sslmode=require
DB_USER=USER
DB_PASSWORD=PASSWORD
```

(`sslmode=require` is needed by most managed PostgreSQL providers.)

Never commit real credentials. Use `.env` (ignored by Docker) or your host's secret settings;
`.env.example` lists the variables.

## 3. Prepare the production database

Create an empty database, then apply the schema once:

```bash
psql "host=HOST port=5432 dbname=DBNAME user=USER sslmode=require" -f database/schema.sql
```

`database/schema.sql` is the exact structure of the development database (exported with
`pg_dump --schema-only`). It uses `CREATE TABLE IF NOT EXISTS` and inserts no data.

**Existing databases:** if a database was created from an older `schema.sql` (where
`offered_skill_id` was `NOT NULL`), apply `database/migrations/001_offered_skill_nullable.sql`
once. It only removes that NOT NULL constraint so one-way swap requests can be stored.

## 4. Build

Windows:

```bat
build.bat
```

Linux / macOS:

```bash
./build.sh
```

Or manually (Windows syntax):

```bat
javac --add-modules jdk.httpserver -cp "lib/*" -d out src\StaticFileHandler.java src\ds\*.java src\algo\*.java src\model\*.java src\config\*.java src\repository\*.java src\service\*.java src\controller\*.java src\Main.java
```

## 5. Run

The process must be started **from the project root**, because static files are served from
the relative folders `views/` and `images/`.

Windows:

```bat
set DB_URL=jdbc:postgresql://localhost:5433/skillswap
set DB_USER=postgres
set DB_PASSWORD=...
run.bat
```

Linux / macOS:

```bash
export DB_URL=... DB_USER=... DB_PASSWORD=...
./run.sh
```

Open `http://localhost:8080` (or the port you set).

## 6. Deploy with Docker (recommended)

The `Dockerfile` compiles the sources and produces a small runtime image.

```bash
docker build -t skillswap .
docker run -p 8080:8080 \
  -e DB_URL="jdbc:postgresql://HOST:5432/DBNAME?sslmode=require" \
  -e DB_USER=USER -e DB_PASSWORD=PASSWORD \
  -e TZ=Asia/Thimphu \
  skillswap
```

### Everything in one command (app + new database)

```bash
cp .env.example .env      # then edit DB_PASSWORD
docker compose up --build
```

This starts PostgreSQL 16, applies `database/schema.sql` automatically on first start, and runs
the app on `http://localhost:8080` (change with `APP_PORT`).

## 7a. Deploy on Render with Neon PostgreSQL (recommended)

1. Push this project to a GitHub/GitLab repository. `.gitignore` keeps `out/`, `.env` and
   IDE files out; `lib/*.jar` **is** committed because the build needs it.
2. In Render: **New → Blueprint** and select the repository (uses `render.yaml`), or
   **New → Web Service → Docker** with the repository root as the Docker context.
3. Enter the environment variables (Render → service → Environment):

   | Key | Value |
   |-----|-------|
   | `DB_URL` | `jdbc:postgresql://<neon-host>/neondb?sslmode=require&channel_binding=require` |
   | `DB_USER` | your Neon role (e.g. `neondb_owner`) |
   | `DB_PASSWORD` | your Neon password |
   | `TZ` | `Asia/Thimphu` (already set by `render.yaml`) |

   Do **not** set `PORT`: Render injects it and the server reads it.
4. Deploy. The log shows `SkillSwap server running at http://localhost:<port>`; the app is
   then available at `https://<service>.onrender.com`.
5. The Neon database already has the schema. For a new Neon database, run
   `database/schema.sql` once from the Neon SQL editor.

Render free instances sleep after inactivity; the first request after that takes a little
longer, and in-memory logins are lost on restart (see §9).

## 7. Deploy to a Java-compatible host

Any platform that can run a Docker image or a Java process and provides PostgreSQL works.
Example flow (Render / Railway / Fly.io / a VPS are all similar):

1. Create a managed **PostgreSQL** database and note its host, port, database, user and password.
2. Run `database/schema.sql` against it (§3).
3. Create a **web service** from this repository using the **Dockerfile**.
4. Set the environment variables `DB_URL`, `DB_USER`, `DB_PASSWORD` and `TZ` in the service
   settings. Do not set `PORT` if the platform injects it.
5. Deploy. The log should print `SkillSwap server running at http://localhost:<port>`.

On a plain VPS: install Java 21, copy the project, build (§4), set the variables, and run
`run.sh` under a process manager (e.g. a `systemd` service with `WorkingDirectory` set to the
project root), behind a reverse proxy such as Nginx or Caddy that terminates HTTPS.

## 8. Verify the deployment

1. `GET /` returns the login page; `GET /css/styles.css` and `GET /js/api.js` return 200.
2. `GET /api/me` without logging in returns **401** `"Please login first!"` — proves the API is up.
3. Sign up, then confirm you land on the dashboard with your name shown.
4. In the server log, `Database connected successfully!` appears for API calls.
5. Add a teaching and a learning skill on **Profile**, search for a skill on **Discover**,
   and send a request between two test accounts.

## 9. Known hosting limitations

- **Sessions are kept in memory** (`UserController.sessions`). Restarting or redeploying logs
  everyone out, and the app must run as **a single instance** (no horizontal scaling).
- **Time zone:** columns are `timestamp without time zone` and are filled by `CURRENT_TIMESTAMP`
  in the JDBC session, whose time zone follows the JVM. Set `TZ` (the Docker image defaults to
  `Asia/Thimphu`) so stored times and displayed times match your users.
- **Cookies** are issued as `HttpOnly; SameSite=Lax` without `Secure`. They work over HTTPS
  behind a proxy; adding `Secure` would require a backend change.
- **Profile pictures** are stored in the `users.profile_picture` TEXT column as compressed
  data URLs (~20–40 KB each, resized to 320×320 by the browser). No file storage is required.
- The built-in `HttpServer` uses its default single-threaded executor; it is fine for a class
  project or small user base, but not for heavy traffic.
- The frontend loads Bootstrap, Bootstrap Icons and the Inter font from public CDNs, so clients
  need internet access.
