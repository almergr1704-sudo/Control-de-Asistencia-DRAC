================================================================================
GUÍA DE INSTALACIÓN Y PUESTA EN MARCHA - VERSIÓN DE ESCRITORIO
SISTEMA DE CONTROL DE ASISTENCIA INSTITUCIONAL
DIRECCIÓN REGIONAL DE AGRICULTURA CAJAMARCA - DRAC
================================================================================

1. REQUISITOS DEL SISTEMA OPERATIVO
--------------------------------------------------------------------------------
- Sistema Operativo: Windows 10 o Windows 11 (Ediciones Home, Pro o Enterprise de 64 bits).
- Memoria RAM: Mínimo 4 GB (Recomendado: 8 GB o superior).
- Espacio en Disco: Al menos 500 MB libres para la aplicación y registros locales.
- Conectividad:
  * Conexión a la red local (LAN o Wi-Fi) en el mismo segmento de red de los relojes biométricos.
  * Conexión a Internet para sincronización con la base de datos institucional Supabase.

2. CÓMO EJECUTAR EL INSTALADOR
--------------------------------------------------------------------------------
Opción A: Instalador Asistido (Setup .exe)
1. Localice el archivo "DRAC-Asistencia-Setup.exe".
2. Haga clic derecho sobre el archivo y seleccione "Ejecutar como administrador".
3. Si Windows Defender SmartScreen muestra la alerta "Windows protegió su PC", haga clic en "Más información" y luego en "Ejecutar de todas formas" (software institucional firmado internamente).

Opción B: Paquete Portable (.zip)
1. Extraiga el contenido de "DRAC_ASISTENCIA_DESKTOP_WINDOWS.zip" en una carpeta de su elección (por ejemplo: "C:\DRAC-Asistencia").
2. Ejecute directamente "DRAC-Control-de-Asistencia.exe".
3. Opcional: También puede ejecutar el script "Instalar-DRAC-Asistencia.bat" para configurar accesos directos en el Escritorio automáticamente.

3. PROCESO DE INSTALACIÓN
--------------------------------------------------------------------------------
1. El asistente de instalación le permitirá seleccionar la ruta de destino (por defecto: "%LOCALAPPDATA%\Programs\DRAC Control de Asistencia").
2. Marque las casillas para crear acceso directo en el Escritorio y en el Menú Inicio.
3. Haga clic en "Instalar" y espere que finalice la copia de archivos.
4. Al terminar, marque "Ejecutar DRAC Control de Asistencia" y presione "Finalizar".

4. CÓMO ABRIR EL SISTEMA
--------------------------------------------------------------------------------
- Desde el acceso directo creado en su Escritorio: "DRAC Control de Asistencia".
- O desde el Menú Inicio de Windows buscando "DRAC Control de Asistencia".

5. CONFIGURACIÓN INICIAL
--------------------------------------------------------------------------------
1. Al iniciar por primera vez, el sistema verificará la conexión a la base de datos institucional.
2. Inicie sesión con sus credenciales de Administrador o Supervisor asignadas por la DRAC.
3. Verifique en el panel superior que el estado de sincronización se muestre en color verde ("Conectado").

6. CONFIGURACIÓN DE MARCADORES BIOMÉTRICOS ZKTECO
--------------------------------------------------------------------------------
1. Ingrese a la sección "Relojes Biométricos" o "Dispositivos ZKTeco" en el menú lateral.
2. Haga clic en "Registrar Marcador" e ingrese:
   - Nombre / Ubicación (ejemplo: "Sede Central - Puerta Principal").
   - Dirección IP fija asignada al dispositivo (ejemplo: 192.168.1.201).
   - Puerto TCP de comunicación (por defecto: 4370).
   - Clave de comunicación (por defecto: 0, a menos que el reloj tenga clave configurada).
3. Haga clic en "Probar Conexión" para verificar el enlace directo con el hardware.

7. PUERTO TCP 4370 Y REGLAS DE RED / FIREWALL
--------------------------------------------------------------------------------
- Los relojes biométricos ZKTeco utilizan de forma estándar el puerto TCP/UDP 4370.
- Asegúrese de que el Firewall de Windows no bloquee el tráfico saliente/entrante hacia dicho puerto.
- En caso de conexión a través de switches administrados o VLANs institucionales, coordine con el área de TI de la DRAC para habilitar la comunicación entre la subred de cómputo y la subred de marcadores biométricos en el puerto 4370.

8. SOLUCIÓN DE PROBLEMAS BÁSICOS
--------------------------------------------------------------------------------
A. Error: "No se puede conectar con el marcador ZKTeco en la IP indicada":
   - Verifique que el cable de red del marcador esté conectado y con enlace activo.
   - Abra la consola de Windows (CMD) y ejecute "ping [IP_DEL_MARCADOR]" para comprobar respuesta física.
   - Revise que su equipo esté conectado a la misma red local que el marcador.

B. Error: "Base de datos no disponible / Sin conexión":
   - Compruebe el acceso a Internet de su estación de trabajo.
   - Verifique que no haya un proxy bloqueando conexiones HTTPS salientes hacia Supabase.

C. La aplicación se cierra inesperadamente:
   - Verifique los registros en "%APPDATA%\DRAC Control de Asistencia\logs".
   - Ejecute la aplicación en modo administrador.
================================================================================
Dirección Regional de Agricultura Cajamarca - DRAC
Soporte Técnico y Gestión de Recursos Humanos
================================================================================
