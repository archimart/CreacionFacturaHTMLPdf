@echo off
title Operativa.engine - Full Stack Starter
echo 🚀 Iniciando Orquestador de Workflows...

:: Iniciar el servidor de archivos en segundo plano
start "Operativa.engine API" cmd /c "cd Operativa.engine/packages/core-logic && npx ts-node server.ts"

:: Iniciar el Frontend
echo 🖥️ Iniciando Interfaz Web...
npm run dev

pause
