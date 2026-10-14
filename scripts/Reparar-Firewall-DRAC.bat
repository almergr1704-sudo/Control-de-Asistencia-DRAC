@echo off
chcp 65001 > nul
title DRAC - Reparar Reglas de Firewall de Windows (TCP 4370)
echo =========================================================================
echo   DIRECCIÓN REGIONAL DE AGRICULTURA CAJAMARCA - GOBIERNO REGIONAL
echo   Herramienta de Reparación de Red y Firewall para Biométricos ZKTeco
echo =========================================================================
echo.

:: 1. Comprobar Privilegios Administrativos
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [SOLICITUD] Se requieren permisos de Administrador para reparar el Firewall.
    echo Solicitando elevación UAC...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"%~f0\"' -Verb RunAs"
    exit /b 0
)

echo [✓] Permisos de Administrador concedidos.
echo.

set "EXE_PATH=%LOCALAPPDATA%\DRAC-Control-Asistencia\DRAC-Control-de-Asistencia.exe"

echo [1/3] Eliminando reglas obsoletas o duplicadas...
netsh advfirewall firewall delete rule name="DRAC Control Asistencia - ZKTeco TCP 4370 IN" >nul 2>&1
netsh advfirewall firewall delete rule name="DRAC Control Asistencia - ZKTeco TCP 4370 OUT" >nul 2>&1
netsh advfirewall firewall delete rule name="DRAC Control Asistencia - Aplicación Ejecutable IN" >nul 2>&1
netsh advfirewall firewall delete rule name="DRAC Control Asistencia - Aplicación Ejecutable OUT" >nul 2>&1
echo       [LOG] Reglas previas limpiadas.

echo.
echo [2/3] Creando reglas de Firewall para Puerto TCP 4370...
netsh advfirewall firewall add rule name="DRAC Control Asistencia - ZKTeco TCP 4370 IN" dir=in action=allow protocol=TCP localport=4370 profile=any description="Regla institucional DRAC: Conexiones TCP entrantes ZKTeco"
netsh advfirewall firewall add rule name="DRAC Control Asistencia - ZKTeco TCP 4370 OUT" dir=out action=allow protocol=TCP remoteport=4370 profile=any description="Regla institucional DRAC: Conexiones TCP salientes ZKTeco"

echo.
echo [3/3] Creando reglas para el ejecutable institucional...
if exist "%EXE_PATH%" (
    netsh advfirewall firewall add rule name="DRAC Control Asistencia - Aplicación Ejecutable IN" dir=in action=allow program="%EXE_PATH%" enable=yes profile=any
    netsh advfirewall firewall add rule name="DRAC Control Asistencia - Aplicación Ejecutable OUT" dir=out action=allow program="%EXE_PATH%" enable=yes profile=any
    echo       [LOG] Reglas aplicadas al ejecutable: %EXE_PATH%
) else (
    echo       [AVISO] No se encontró la ruta en LocalAppData, la regla de puerto 4370 cubrirá el tráfico.
)

echo.
echo =========================================================================
echo   REPARACIÓN DE RED Y FIREWALL COMPLETADA
echo   Firewall Windows: OK
echo   Puerto TCP 4370: HABILITADO
echo =========================================================================
echo.
pause
exit /b 0
