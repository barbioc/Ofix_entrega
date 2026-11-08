@echo off
rem Inicia el backend de Ofix (Django).
rem Requisito: MySQL encendido en el panel de XAMPP.
rem Usa el Python de DSWenv si lo encuentra. Si no, usa el "python" que este activo.
rem Para usar otro entorno: set OFIX_PYTHON=C:\ruta\a\DSWenv\Scripts\python.exe

set "PY=python"
if exist "C:\Users\barba\OneDrive\Escritorio\OFIX babe\OFIX\DSWenv\Scripts\python.exe" set "PY=C:\Users\barba\OneDrive\Escritorio\OFIX babe\OFIX\DSWenv\Scripts\python.exe"
if exist "%~dp0DSWenv\Scripts\python.exe" set "PY=%~dp0DSWenv\Scripts\python.exe"
if defined OFIX_PYTHON set "PY=%OFIX_PYTHON%"

cd /d "%~dp0backend"
"%PY%" manage.py migrate
"%PY%" manage.py runserver 8000
pause
