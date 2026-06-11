@echo off
setlocal
set DIRNAME=%~dp0
set GRADLE_HOME=%DIRNAME%gradle-local
"%GRADLE_HOME%\bin\gradle.bat" %*
endlocal
