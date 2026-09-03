================================================================================
GUÍA DE INSTALACIÓN Y CONFIGURACIÓN - VERSIÓN DESKTOP
SISTEMA DE CONTROL DE ASISTENCIA INSTITUCIONAL - DRAC CAJAMARCA
================================================================================

1. REQUISITOS DE SISTEMA (WINDOWS)
--------------------------------------------------------------------------------
- Sistema Operativo: Windows 10 (64-bit) o Windows 11 (64-bit).
- Procesador: Intel Core i3 / AMD Ryzen 3 o superior (x64).
- Memoria RAM: Mínimo 4 GB (Recomendado 8 GB).
- Espacio en disco: Al menos 600 MB de espacio disponible.
- Conectividad: Conexión de red local (LAN / Ethernet o Wi-Fi) para comunicación con los relojes biométricos ZKTeco.

2. CÓMO EJECUTAR EL INSTALADOR
--------------------------------------------------------------------------------
1. Descomprima el archivo "DRAC_ASISTENCIA_DESKTOP_WINDOWS.zip" en una carpeta de su equipo.
2. Localice el archivo "DRAC-Control-de-Asistencia-Setup.exe".
3. Haga clic derecho sobre "DRAC-Control-de-Asistencia-Setup.exe" y seleccione:
   "Ejecutar como administrador".
4. Si Windows SmartScreen muestra la advertencia "Windows protegió su PC":
   - Haga clic en "Más información".
   - Haga clic en "Ejecutar de todas formas".

3. CÓMO INSTALAR
--------------------------------------------------------------------------------
1. El asistente de instalación guiada de DRAC Control de Asistencia se abrirá.
2. Seleccione el modo de instalación:
   - "Cualquier usuario que use este equipo (todos los usuarios)" [Recomendado]
   - O "Solo para mí".
3. Elija la carpeta de destino (por defecto: C:\Program Files\DRAC Control de Asistencia).
4. Marque las casillas:
   [X] Crear acceso directo en el Escritorio.
   [X] Crear acceso directo en el Menú Inicio.
5. Presione "Instalar" y espere que la barra de progreso finalice.
6. En la ventana final, marque "Ejecutar DRAC Control de Asistencia" y presione "Terminar".

4. CÓMO ABRIR EL SISTEMA
--------------------------------------------------------------------------------
- Opción 1: Haga doble clic en el icono "DRAC Control de Asistencia" en su Escritorio.
- Opción 2: Abra el menú Inicio de Windows y busque "DRAC Control de Asistencia".
- El sistema iniciará en su propia ventana nativa de alta velocidad optimizada para Windows.

5. CONFIGURACIÓN INICIAL
--------------------------------------------------------------------------------
1. Al abrir el aplicativo, ingrese al módulo correspondiente según su rol administrativo.
2. Verifique la estructura de Dependencias, Direcciones y Áreas cargadas.
3. Compruebe la conectividad del servidor local o la base de datos central institucional.

6. CONFIGURACIÓN DE MARCADORES ZKTECO
--------------------------------------------------------------------------------
1. Diríjase a la sección "Dispositivos Biométricos" en el menú lateral.
2. Para cada reloj marcador biométrico (ZKTeco K40, MB360, IN01, etc.):
   - Nombre: Ingrese la ubicación (Ej. "Marcador Puerta Principal - Sede Central").
   - Dirección IP: Asigne la IP estática local del marcador (Ej. 192.168.1.201).
   - Puerto: Ingrese el puerto estándar 4370.
   - Contraseña de comunicación: 0 (o la clave establecida en el menú del marcador).
3. Presione el botón "Probar Conexión" para verificar el enlace en tiempo real.

7. PUERTO TCP 4370 Y CONFIGURACIÓN DE RED
--------------------------------------------------------------------------------
- Los biométricos ZKTeco se comunican mediante el protocolo ZK / UDP-TCP a través del puerto 4370.
- Regla de Firewall de Windows:
  El instalador configura o permite el tráfico por el puerto 4370. Si experimenta bloqueos:
  1. Abra el Panel de Control -> Firewall de Windows Defender -> Reglas de Entrada.
  2. Asegúrese de que el puerto TCP/UDP 4370 esté permitido en la subred local.
  3. Compruebe que la computadora donde está instalado el sistema se encuentre en el mismo segmento de red (LAN/VLAN) que los marcadores.

8. SOLUCIÓN DE PROBLEMAS BÁSICOS
--------------------------------------------------------------------------------
- "No se puede conectar con el biométrico en la IP indicada":
  * Verifique que el equipo haga ping a la IP del marcador desde la consola CMD (ping 192.168.1.x).
  * Verifique que el cable de red del biométrico esté conectado y con enlace activo.
  * Verifique que no haya conflicto de IP con otro dispositivo en la red.
- "Error al iniciar la aplicación":
  * Verifique que su sistema cuente con los paquetes redistribuibles de Visual C++ (vcredist x64).
  * Ejecute la aplicación con permisos de Administrador si la instalación se realizó para todos los usuarios.
- "Desinstalación del sistema":
  * Puede desinstalar la aplicación en cualquier momento desde "Configuración -> Aplicaciones y características" o ejecutando el desinstalador en la carpeta del programa.
================================================================================
Dirección Regional de Agricultura Cajamarca (DRAC)
Oficina de Informática y Estadística / Unidad Funcional de Recursos Humanos
================================================================================
