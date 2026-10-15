; =========================================================================
; DRAC Control de Asistencia - Script NSIS para Configuración de Firewall
; Dirección Regional de Agricultura Cajamarca
; =========================================================================

!macro customInstall
  DetailPrint "DRAC: Configurando Firewall de Windows para marcadores biometricos ZKTeco..."

  ; 1. Regla de Entrada TCP 4370 (Recepción de datos ZKTeco y modo ADMS/PUSH)
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name=$\"DRAC Control Asistencia - ZKTeco TCP 4370 IN$\" dir=in action=allow protocol=TCP localport=4370 profile=any description=$\"Regla institucional DRAC: Permite conexiones TCP entrantes de marcadores biometricos ZKTeco$\"'

  ; 2. Regla de Salida TCP 4370 (Conexión socket a biométricos LAN en puerto 4370)
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name=$\"DRAC Control Asistencia - ZKTeco TCP 4370 OUT$\" dir=out action=allow protocol=TCP remoteport=4370 profile=any description=$\"Regla institucional DRAC: Permite conexiones TCP salientes hacia marcadores biometricos ZKTeco$\"'

  ; 3. Reglas de Firewall para el Ejecutable instalado
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name=$\"DRAC Control Asistencia - Aplicación Ejecutable IN$\" dir=in action=allow program=$\"$INSTDIR\DRAC-Control-de-Asistencia.exe$\" enable=yes profile=any description=$\"Regla institucional DRAC: Trafico de red entrante para DRAC Control de Asistencia$\"'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name=$\"DRAC Control Asistencia - Aplicación Ejecutable OUT$\" dir=out action=allow program=$\"$INSTDIR\DRAC-Control-de-Asistencia.exe$\" enable=yes profile=any description=$\"Regla institucional DRAC: Trafico de red saliente para DRAC Control de Asistencia$\"'

  ; 4. Respaldo PowerShell en caso de directivas netsh restringidas
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -Command \"New-NetFirewallRule -DisplayName \"DRAC Control Asistencia - ZKTeco TCP 4370 IN\" -Direction Inbound -Protocol TCP -LocalPort 4370 -Action Allow -Profile Any -ErrorAction SilentlyContinue; New-NetFirewallRule -DisplayName \"DRAC Control Asistencia - ZKTeco TCP 4370 OUT\" -Direction Outbound -Protocol TCP -RemotePort 4370 -Action Allow -Profile Any -ErrorAction SilentlyContinue\"'

  DetailPrint "DRAC: Reglas de Firewall de Windows aplicadas correctamente para TCP 4370."
!macroend

!macro customUnInstall
  DetailPrint "DRAC: Eliminando reglas de Firewall de Windows..."
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name=$\"DRAC Control Asistencia - ZKTeco TCP 4370 IN$\"'
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name=$\"DRAC Control Asistencia - ZKTeco TCP 4370 OUT$\"'
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name=$\"DRAC Control Asistencia - Aplicación Ejecutable IN$\"'
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name=$\"DRAC Control Asistencia - Aplicación Ejecutable OUT$\"'
!macroend
