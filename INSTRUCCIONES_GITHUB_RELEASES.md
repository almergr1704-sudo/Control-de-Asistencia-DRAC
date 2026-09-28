# GUÍA DE DISTRIBUCIÓN CI/CD: GITHUB ACTIONS A GITHUB RELEASES
## SISTEMA DE CONTROL DE ASISTENCIA INSTITUCIONAL — DRAC CAJAMARCA

Este documento explica cómo funciona la automatización configurada en el proyecto para compilar el instalador oficial de Windows (**DRAC-Control-de-Asistencia-Setup.exe**) en la infraestructura nativa de GitHub Actions y publicarlo automáticamente como **Release Asset** en GitHub.

---

### 1. ARQUITECTURA DE DISTRIBUCIÓN IMPLEMENTADA

```text
Google AI Studio (Código Fuente en la nube)
       ↓
GitHub (Sincronización de Repositorio)
       ↓
GitHub Actions (Workflow: .github/workflows/build-desktop.yml)
       ↓
Servidor Windows Nativo (windows-latest)
       ↓
Electron Builder (Compilación NSIS + Portable + ZIP)
       ↓
GitHub Releases (Creación automática de Release con Assets binarios)
       ↓
Descarga Directa en Windows (DRAC-Control-de-Asistencia-Setup.exe ≈ 484 MB)
```

---

### 2. ARCHIVOS CONFIGURADOS EN EL PROYECTO

1. **`.github/workflows/build-desktop.yml`**:
   - Se ejecuta sobre un entorno oficial **`windows-latest`**.
   - Descarga el código y configura Node.js 20.
   - Instala dependencias con `npm ci` utilizando `package-lock.json`.
   - Sincroniza el icono institucional con `scripts/prepare-build.cjs`.
   - Compila la aplicación Web SPA y el servidor con `npm run build`.
   - Empaqueta el instalador de Electron con `npx electron-builder --win nsis portable zip`.
   - Verifica los archivos generados y calcula firmas de seguridad **SHA-256** (`SHA256SUMS.txt`).
   - Publica la Release utilizando `softprops/action-gh-release@v2` con permisos `contents: write`.

2. **`.gitignore`**:
   - Excluye estrictamente carpetas pesadas y binarios (`dist/`, `dist-desktop/`, `node_modules/`, `*.exe`, `*.zip`, `*.7z`, `*.blockmap`).
   - Garantiza que los archivos pesados no se almacenen en el historial de Git, sino exclusivamente como activos de **GitHub Releases**.

3. **`package-lock.json`**:
   - Generado y sincronizado para permitir que el paso `npm ci` en GitHub Actions instale dependencias de forma determinista y ultrarrápida.

4. **`scripts/prepare-build.cjs`**:
   - Garantiza la preparación automática de `build/icon.png` a partir de `public/icon.png` antes de invocar Electron Builder tanto en Windows como en Linux.

---

### 3. CÓMO EJECUTAR LA COMPILACIÓN EN GITHUB (2 MÉTODOS)

#### MÉTODO A: Manual desde la interfaz web de GitHub (Recomendado / Inmediato)
1. Ingrese a su repositorio en **GitHub**: `https://github.com/TU_USUARIO/TU_REPOSITORIO`.
2. Haga clic en la pestaña superior **Actions**.
3. En la barra lateral izquierda, seleccione el workflow:
   **"Compilar y Publicar DRAC Desktop Windows (GitHub Release)"**.
4. A la derecha, haga clic en el botón desplegable **"Run workflow"**.
5. Ingrese o confirme los parámetros:
   - **Branch:** `main` (o la rama actual vinculada).
   - **Etiqueta de versión:** `v1.0.0` (o `v1.0.1`, etc.).
   - **Nombre de la Release:** `DRAC Control de Asistencia Desktop v1.0.0`.
6. Haga clic en el botón verde **"Run workflow"**.
7. GitHub Actions iniciará una máquina virtual con Windows, compilará el instalador completo (~484 MB) y creará la Release automáticamente.

#### MÉTODO B: Creando una Etiqueta Git (Git Tag)
Si trabaja desde Git local o la terminal:
```bash
git tag v1.0.0
git push origin v1.0.0
```
Cualquier tag que comience con `v*` activará automáticamente el workflow y publicará la versión correspondiente.

---

### 4. DÓNDE DESCARGAR EL INSTALADOR FINAL

Una vez finalizado el workflow (tarda entre 3 y 5 minutos en GitHub):
1. Ingrese a la página principal de su repositorio en GitHub.
2. En la columna derecha, busque la sección **Releases**.
3. Haga clic sobre la versión publicada (por ejemplo: **DRAC Control de Asistencia Desktop v1.0.0**).
4. En el apartado **Assets**, encontrará los archivos listos para descargar:
   - **`DRAC-Control-de-Asistencia-Setup.exe`** (~484 MB): Instalador asistido oficial para Windows 10/11.
   - **`DRAC-Control-de-Asistencia-Portable.exe`** (~483 MB): Versión portable de ejecución directa.
   - **`DRAC_ASISTENCIA_DESKTOP_WINDOWS.zip`** (~482 MB): Carpeta comprimida completa de distribución.
   - **`SHA256SUMS.txt`**: Sumas criptográficas para verificar la integridad del archivo descargado.

---

### 5. INTEGRACIÓN CON LA VERSIÓN WEB

Para que el botón de descarga en la versión web (en producción o Vercel) apunte directamente a la Release de GitHub:
1. En sus variables de entorno de producción (`.env` o Vercel):
   ```env
   VITE_GITHUB_RELEASES_URL="https://github.com/TU_USUARIO/TU_REPOSITORIO/releases"
   VITE_DESKTOP_EXE_URL="https://github.com/TU_USUARIO/TU_REPOSITORIO/releases/download/v1.0.0/DRAC-Control-de-Asistencia-Setup.exe"
   ```
2. Al configurar estas variables, los usuarios que ingresen a la aplicación Web podrán descargar directamente el instalador oficial alojado en GitHub sin consumir ancho de banda de su servidor web ni depender de Supabase Storage.
