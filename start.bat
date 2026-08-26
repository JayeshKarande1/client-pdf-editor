@echo off
title PDFZen - Client-Side PDF Editor
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File server.ps1
pause
