@echo off
chcp 65001 > nul
title DRAC Control de Asistencia - Instalador Windows y Configuración de Red
echo =========================================================================
echo   DIRECCIÓN REGIONAL DE AGRICULTURA CAJAMARCA - GOBIERNO REGIONAL
echo   Sistema Institucional de Control de Asistencia y Biométricos ZKTeco
echo =========================================================================
echo.

:: 1. Comprobación de privilegios administrativos
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [AVISO] Solicitando permisos de Administrador para configurar el Firewall de Windows...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"%~f0\"' -Verb RunAs"
    exit /b 0
)

echo [1/4] Preparando entorno de instalación con privilegios de Administrador...
set "INSTALL_DIR=%LOCALAPPDATA%\DRAC-Control-Asistencia"
set "EXE_PATH=%INSTALL_DIR%\DRAC-Control-de-Asistencia.exe"
set "SOURCE_DIR=%~dp0"

echo [2/4] Copiando archivos del sistema a %INSTALL_DIR%...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
xcopy /E /I /Y /Q "%SOURCE_DIR%*" "%INSTALL_DIR%\" > nul

echo [3/4] Creando accesos directos institucionales...
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut([System.IO.Path]::Combine([System.Environment]::GetFolderPath('Desktop'), 'DRAC Control de Asistencia.lnk')); $Shortcut.TargetPath = '%EXE_PATH%'; $Shortcut.Description = 'DRAC Control de Asistencia - DRAC Cajamarca'; $Shortcut.Save()"
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut([System.IO.Path]::Combine([System.Environment]::GetFolderPath('Programs'), 'DRAC Control de Asistencia.lnk')); $Shortcut.TargetPath = '%EXE_PATH%'; $Shortcut.Description = 'DRAC Control de Asistencia - DRAC Cajamarca'; $Shortcut.Save()"

echo [4/4] Configurando Firewall de Windows para comunicación biométrica ZKTeco...
echo       - Habilitando puerto TCP 4370 (Entrada y Salida)...
netsh advfirewall firewall delete rule name="DRAC Control Asistencia - ZKTeco TCP 4370 IN" >nul 2>&1
netsh advfirewall firewall add rule name="DRAC Control Asistencia - ZKTeco TCP 4370 IN" dir=in action=allow protocol=TCP localport=4370 profile=any description="Regla institucional DRAC: Permite conexiones TCP entrantes de marcadores biometricos ZKTeco" >nul 2>&1

netsh advfirewall firewall delete rule name="DRAC Control Asistencia - ZKTeco TCP 4370 OUT" >nul 2>&1
netsh advfirewall firewall add rule name="DRAC Control Asistencia - ZKTeco TCP 4370 OUT" dir=out action=allow protocol=TCP remoteport=4370 profile=any description="Regla institucional DRAC: Permite conexiones TCP salientes hacia marcadores biometricos ZKTeco" >nul 2>&1

echo       - Habilitando reglas de red para el ejecutable de la aplicación...
netsh advfirewall firewall delete rule name="DRAC Control Asistencia - Aplicación Ejecutable IN" >nul 2>&1
netsh advfirewall firewall add rule name="DRAC Control Asistencia - Aplicación Ejecutable IN" dir=in action=allow program="%EXE_PATH%" enable=yes profile=any description="Regla institucional DRAC: Trafico entrante para DRAC Control de Asistencia" >nul 2>&1

netsh advfirewall firewall delete rule name="DRAC Control Asistencia - Aplicación Ejecutable OUT" >nul 2>&1
netsh advfirewall firewall add rule name="DRAC Control Asistencia - Aplicación Ejecutable OUT" dir=out action=allow program="%EXE_PATH%" enable=yes profile=any description="Regla institucional DRAC: Trafico saliente para DRAC Control de Asistencia" >nul 2>&1

echo.
echo =========================================================================
echo   RESULTADO DE LA INSTALACIÓN Y CONFIGURACIÓN DE RED
echo =========================================================================
echo   [✓] Aplicación instalada
echo   [✓] Firewall configurado
echo   [✓] Puerto 4370 habilitado para la aplicación
echo   [✓] Diagnóstico de red disponible
echo   [✓] Listo para conexión con dispositivos ZKTeco
echo =========================================================================
echo.
echo Iniciando aplicación DRAC Control de Asistencia...
start "" "%EXE_PATH%"
exit /b 0
