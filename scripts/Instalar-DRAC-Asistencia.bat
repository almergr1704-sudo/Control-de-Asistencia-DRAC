@echo off
chcp 65001 > nul
title DRAC Control de Asistencia - Instalador Windows
echo =========================================================================
echo   DIRECCIÓN REGIONAL DE AGRICULTURA CAJAMARCA - GOBIERNO REGIONAL
echo   Sistema Institucional de Control de Asistencia y Biométricos ZKTeco
echo =========================================================================
echo.
echo [1/3] Preparando instalación en el equipo...
set "INSTALL_DIR=%LOCALAPPDATA%\DRAC-Control-Asistencia"
set "EXE_PATH=%INSTALL_DIR%\DRAC-Control-de-Asistencia.exe"
set "SOURCE_DIR=%~dp0"

echo [2/3] Copiando archivos de la aplicación a %INSTALL_DIR%...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
xcopy /E /I /Y /Q "%SOURCE_DIR%*" "%INSTALL_DIR%\" > nul

echo [3/3] Creando accesos directos en Escritorio y Menú Inicio...
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut([System.IO.Path]::Combine([System.Environment]::GetFolderPath('Desktop'), 'DRAC Control de Asistencia.lnk')); $Shortcut.TargetPath = '%EXE_PATH%'; $Shortcut.Description = 'DRAC Control de Asistencia - DRAC Cajamarca'; $Shortcut.Save()"
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut([System.IO.Path]::Combine([System.Environment]::GetFolderPath('Programs'), 'DRAC Control de Asistencia.lnk')); $Shortcut.TargetPath = '%EXE_PATH%'; $Shortcut.Description = 'DRAC Control de Asistencia - DRAC Cajamarca'; $Shortcut.Save()"

echo.
echo =========================================================================
echo   INSTALACIÓN COMPLETADA CON ÉXITO
echo   Acceso directo creado en el Escritorio: "DRAC Control de Asistencia"
echo =========================================================================
echo.
echo Iniciando aplicación...
start "" "%EXE_PATH%"
exit /b 0
