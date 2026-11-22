#!/bin/sh
# Compile SkillSwap on Linux/macOS (Windows: build.bat)
set -e
cd "$(dirname "$0")"
mkdir -p out
find src -name "*.java" > /tmp/skillswap-sources.list
javac --add-modules jdk.httpserver -cp "lib/*" -d out @/tmp/skillswap-sources.list
echo "Compilation succeeded."
