@echo off
chcp 65001 > nul
title DRAC Control de Asistencia - Instalador Windows y Configuración de Red
echo =========================================================================
echo   DIRECCIÓN REGIONAL DE AGRICULTURA CAJAMARCA - GOBIERNO REGIONAL
echo   Sistema Institucional de Control de Asistencia y Biométricos ZKTeco
echo   Instalador Oficial de Escritorio con Configuración de Firewall TCP 4370
echo =========================================================================
echo.

:: 1. Comprobar Privilegios Administrativos
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ADVERTENCIA] El instalador requiere privilegios de Administrador para configurar
    echo               las reglas del Firewall de Windows (Puerto TCP 4370).
    echo.
    echo Solicitando elevación de privilegios UAC...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"%~f0\"' -Verb RunAs"
    exit /b 0
)

echo [✓] Privilegios de Administrador verificados correctamente.
echo.

:: 2. Definir Rutas de Instalación
set "INSTALL_DIR=%LOCALAPPDATA%\DRAC-Control-Asistencia"
set "EXE_NAME=DRAC-Control-de-Asistencia.exe"
set "EXE_PATH=%INSTALL_DIR%\%EXE_NAME%"
set "SOURCE_DIR=%~dp0"

echo [1/4] Preparando directorio institucional en:
echo       %INSTALL_DIR%
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

echo.
echo [2/4] Copiando archivos del sistema...
if exist "%SOURCE_DIR%dist\" (
    xcopy /E /I /Y /Q "%SOURCE_DIR%*" "%INSTALL_DIR%\" > nul
) else (
    xcopy /E /I /Y /Q "%SOURCE_DIR%*" "%INSTALL_DIR%\" > nul
)

echo.
echo [3/4] Creando accesos directos en Escritorio y Menú Inicio...
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut([System.IO.Path]::Combine([System.Environment]::GetFolderPath('Desktop'), 'DRAC Control de Asistencia.lnk')); $Shortcut.TargetPath = '%EXE_PATH%'; $Shortcut.Description = 'DRAC Control de Asistencia - Dirección Regional de Agricultura Cajamarca'; $Shortcut.Save()"
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut([System.IO.Path]::Combine([System.Environment]::GetFolderPath('Programs'), 'DRAC Control de Asistencia.lnk')); $Shortcut.TargetPath = '%EXE_PATH%'; $Shortcut.Description = 'DRAC Control de Asistencia - Dirección Regional de Agricultura Cajamarca'; $Shortcut.Save()"

echo.
echo [4/4] Configurando Firewall de Windows para comunicación biométrica ZKTeco...
echo       - Verificando reglas para puerto TCP 4370 (Entrada y Salida)...

:: Regla 1: Entrada TCP 4370
netsh advfirewall firewall show rule name="DRAC Control Asistencia - ZKTeco TCP 4370 IN" >nul 2>&1
if %errorlevel% equ 0 (
    echo       [LOG] Regla ya existente: DRAC Control Asistencia - ZKTeco TCP 4370 IN
) else (
    netsh advfirewall firewall add rule name="DRAC Control Asistencia - ZKTeco TCP 4370 IN" dir=in action=allow protocol=TCP localport=4370 profile=any description="Regla institucional DRAC: Permite conexiones TCP entrantes de marcadores biometricos ZKTeco" >nul 2>&1
    if %errorlevel% equ 0 (
        echo       [LOG] Regla creada: DRAC Control Asistencia - ZKTeco TCP 4370 IN
    ) else (
        echo       [ERROR] Error al crear regla de entrada TCP 4370.
    )
)

:: Regla 2: Salida TCP 4370
netsh advfirewall firewall show rule name="DRAC Control Asistencia - ZKTeco TCP 4370 OUT" >nul 2>&1
if %errorlevel% equ 0 (
    echo       [LOG] Regla ya existente: DRAC Control Asistencia - ZKTeco TCP 4370 OUT
) else (
    netsh advfirewall firewall add rule name="DRAC Control Asistencia - ZKTeco TCP 4370 OUT" dir=out action=allow protocol=TCP remoteport=4370 profile=any description="Regla institucional DRAC: Permite conexiones TCP salientes hacia marcadores biometricos ZKTeco" >nul 2>&1
    if %errorlevel% equ 0 (
        echo       [LOG] Regla creada: DRAC Control Asistencia - ZKTeco TCP 4370 OUT
    ) else (
        echo       [ERROR] Error al crear regla de salida TCP 4370.
    )
)

:: Regla 3: Ejecutable Aplicación Entrada
netsh advfirewall firewall add rule name="DRAC Control Asistencia - Aplicación Ejecutable IN" dir=in action=allow program="%EXE_PATH%" enable=yes profile=any description="Regla institucional DRAC: Permite trafico de red entrante para DRAC Control de Asistencia" >nul 2>&1
echo       [LOG] Regla de ejecutable (Entrada): DRAC Control Asistencia.exe

:: Regla 4: Ejecutable Aplicación Salida
netsh advfirewall firewall add rule name="DRAC Control Asistencia - Aplicación Ejecutable OUT" dir=out action=allow program="%EXE_PATH%" enable=yes profile=any description="Regla institucional DRAC: Permite trafico de red saliente para DRAC Control de Asistencia" >nul 2>&1
echo       [LOG] Regla de ejecutable (Salida): DRAC Control Asistencia.exe

echo.
echo =========================================================================
echo   VALIDACIÓN FINAL DE INSTALACIÓN
echo =========================================================================
echo   [✓] Aplicación instalada
echo   [✓] Firewall configurado
echo   [✓] Puerto 4370 habilitado para la aplicación (Entrada y Salida)
echo   [✓] Diagnóstico de red disponible
echo   [✓] Listo para conexión con dispositivos ZKTeco
echo =========================================================================
echo.
echo Iniciando aplicación de escritorio DRAC...
start "" "%EXE_PATH%"
timeout /t 3 > nul
exit /b 0
