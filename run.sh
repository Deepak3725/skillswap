#!/bin/sh
# Start SkillSwap on Linux/macOS after ./build.sh (Windows: run.bat)
# Optional environment variables: PORT, DB_URL, DB_USER, DB_PASSWORD
cd "$(dirname "$0")"
exec java --add-modules jdk.httpserver -cp "out:lib/*" Main
