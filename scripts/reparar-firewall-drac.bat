@echo off
chcp 65001 > nul
title DRAC - Reparar Reglas de Firewall de Windows (TCP 4370)
echo =========================================================================
echo   DIRECCIÓN REGIONAL DE AGRICULTURA CAJAMARCA - GOBIERNO REGIONAL
echo   Herramienta Administrativa: Reparación de Red y Firewall ZKTeco
echo =========================================================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [AVISO] Solicitando elevación de privilegios de Administrador (UAC)...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"%~f0\"' -Verb RunAs"
    exit /b 0
)

echo [1/3] Limpiando reglas previas de DRAC en Firewall...
netsh advfirewall firewall delete rule name="DRAC Control Asistencia - ZKTeco TCP 4370 IN" >nul 2>&1
netsh advfirewall firewall delete rule name="DRAC Control Asistencia - ZKTeco TCP 4370 OUT" >nul 2>&1
netsh advfirewall firewall delete rule name="DRAC Control Asistencia - Aplicación Ejecutable IN" >nul 2>&1
netsh advfirewall firewall delete rule name="DRAC Control Asistencia - Aplicación Ejecutable OUT" >nul 2>&1

echo [2/3] Creando reglas de puerto TCP 4370 (Entrada y Salida)...
netsh advfirewall firewall add rule name="DRAC Control Asistencia - ZKTeco TCP 4370 IN" dir=in action=allow protocol=TCP localport=4370 profile=any description="Regla institucional DRAC: Permite conexiones TCP entrantes de marcadores biometricos ZKTeco"
netsh advfirewall firewall add rule name="DRAC Control Asistencia - ZKTeco TCP 4370 OUT" dir=out action=allow protocol=TCP remoteport=4370 profile=any description="Regla institucional DRAC: Permite conexiones TCP salientes hacia marcadores biometricos ZKTeco"

echo [3/3] Creando reglas para la aplicación DRAC...
set "EXE_PATH=%LOCALAPPDATA%\DRAC-Control-Asistencia\DRAC-Control-de-Asistencia.exe"
if exist "%EXE_PATH%" (
    netsh advfirewall firewall add rule name="DRAC Control Asistencia - Aplicación Ejecutable IN" dir=in action=allow program="%EXE_PATH%" enable=yes profile=any
    netsh advfirewall firewall add rule name="DRAC Control Asistencia - Aplicación Ejecutable OUT" dir=out action=allow program="%EXE_PATH%" enable=yes profile=any
)

echo.
echo =========================================================================
echo   [✓] Firewall configurado correctamente
echo   [✓] Puerto 4370 habilitado para Entrada y Salida (Dominio, Privado, Público)
echo   [✓] Comunicación con marcadores ZKTeco desbloqueada en Windows
echo =========================================================================
echo.
pause
