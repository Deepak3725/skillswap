@echo off
rem Starts SkillSwap after build.bat has compiled the sources into out\
rem Optional environment variables: PORT, DB_URL, DB_USER, DB_PASSWORD
pushd "%~dp0" || exit /b 1
java --add-modules jdk.httpserver -cp "out;lib/*" Main
popd
