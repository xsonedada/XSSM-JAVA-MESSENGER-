@echo off

set "JAVA_HOME=C:\Program Files\Java\jdk-21.0.11"
set "PATH=%JAVA_HOME%\bin;%PATH%"

echo ========================================
echo XSSM MESSENGER
echo ========================================
echo.
echo JAVA_HOME: "%JAVA_HOME%"
echo.
java -version
echo.

set DIRNAME=%~dp0
"%DIRNAME%gradle-local\bin\gradle.bat" bootRun
