@echo off
rem Inicia el frontend de Ofix (Angular) en http://localhost:4200
cd /d "%~dp0frontend"
if not exist node_modules call npm install
call npm start
pause
