@echo off
setlocal enabledelayedexpansion
pushd "%~dp0" || exit /b 1
if not exist out mkdir out

set FILES=
for /r src %%f in (*.java) do set "FILES=!FILES! "%%f""

javac -cp "lib/*" -d out !FILES!
if errorlevel 1 (
    echo Compilation failed.
    popd
    exit /b 1
)
echo Compilation succeeded.
popd
exit /b 0
