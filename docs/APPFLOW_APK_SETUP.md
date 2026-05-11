# Generar APK con Ionic Appflow - Paso a Paso

Esta guía te explica cómo obtener un APK compilado del proyecto usando Ionic Appflow.

## Paso 1: Crear una cuenta en Ionic Appflow

1. Ve a https://ionicframework.com/
2. Crea una cuenta (o usa la existente)
3. Ve a https://dashboard.ionicframework.com/

## Paso 2: Conectar el repositorio de GitHub

1. En el dashboard de Appflow, haz clic en **"New App"** (o "Create New App")
2. Selecciona **"Connect GitHub"**
3. Autoriza Appflow para acceder a tu cuenta de GitHub
4. Busca y selecciona el repositorio: `jcastanedam4/sst-incident-manager`
5. Selecciona la rama: `master`
6. Haz clic en **"Create App"**

## Paso 3: Configurar la Build de Android

Una vez creada la app en Appflow:

1. En el menú lateral, haz clic en **"Builds"**
2. Haz clic en **"New Build"** (o "Start a new build")
3. Elige la plataforma: **"Android"**

### Configuración de la Build

En la pantalla de configuración de build, completa los siguientes campos:

#### 3.1 Información Básica
- **Commit/Branch**: `master` (o el commit específico que quieras)
- **Build Type**: `Release` (para distribución) o `Debug` (para pruebas)

#### 3.2 Configuración del Entorno (Build Parameters)

Si Appflow te pide configuración avanzada, usa:

| Campo | Valor |
|-------|-------|
| Node version | 20.x o superior |
| Build command | Verifica que Appflow detecte `npm run build:web` |
| Output directory | `out` |

#### 3.3 Pasos de Build (Build Steps)

Appflow debería auto-detectar que es un proyecto Capacitor. Si no, configura manualmente:

1. **Install Dependencies** (si no está)
   ```
   npm ci
   ```

2. **Build Web Assets** (crítico)
   ```
   npm run build:web
   ```

3. **Sync Capacitor Android** (crítico)
   ```
   npx cap sync android
   ```

#### 3.4 Signing (Firmado del APK)

Si quieres un APK final para distribuir (Google Play):

1. En la sección **"Signing"**, haz clic en **"Configure Signing"**
2. Sube tu keystore Android (archivo `.jks` o `.p12`):
   - Si no tienes uno, crea uno localmente con:
     ```bash
     keytool -genkey -v -keystore release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias sst-key
     ```
   - Luego sube ese archivo a Appflow
3. Ingresa:
   - **Keystore Password**: la contraseña del keystore
   - **Key Alias**: `sst-key` (o el que usaste)
   - **Key Password**: la contraseña de la key

Si no configuras signing, Appflow te generará un APK sin firmar (solo para pruebas).

## Paso 4: Lanzar la Build

1. Revisa que la configuración sea correcta
2. Haz clic en **"Build Now"** o **"Start Build"**
3. Appflow comenzará a compilar (tarda 5-15 minutos)

En el panel verás el progreso:
- ✅ Installing dependencies
- ✅ Building web assets
- ✅ Syncing Capacitor
- ✅ Building Android APK
- ✅ Signing APK (si configuraste keystore)

## Paso 5: Descargar el APK

1. Cuando la build termine exitosamente (estado: **"Succeeded"**)
2. Haz clic en el build completado
3. Haz clic en **"Download"** (aparecerá un botón de descarga)
4. Descarga el archivo:
   - Si es Debug: `app-debug.apk`
   - Si es Release: `app-release.apk` (firmado) o `app-release-unsigned.apk`

## Paso 6: Instalar en dispositivo o emulador

### Opción A: Instalar en emulador

```powershell
# Conecta el emulador o dispositivo
adb install C:\ruta\al\app-debug.apk
```

### Opción B: Instalar en dispositivo físico

1. Habilita "Instalación desde fuentes desconocidas" en Configuración del dispositivo
2. Transfiere el APK al dispositivo
3. Toca el APK para instalar

## Paso 7: Verificar la app en el dispositivo

1. Abre la app desde el drawer de aplicaciones
2. Busca "SST Incident Manager"
3. Verifica que cargue correctamente
4. Prueba las rutas: `/dashboard/admin` y `/dashboard/empleado`

---

## Solución de problemas

### La build falla con error de Node/npm
- Verifica que `package.json` esté correctamente formateado
- Asegúrate de que `npm ci` pueda instalar las dependencias (no hay errores en `package-lock.json`)

### La build falla con error de Capacitor
- Verifica que `capacitor.config.json` existe y está válido
- Asegúrate de que `webDir` está establecido en `out` (que es donde Next.js exporte los archivos estáticos)

### El APK no inicia la app
- Verifica en los logs que `npx cap sync android` se ejecutó exitosamente
- Comprueba que `app/dashboard/admin/page.tsx` y `app/dashboard/empleado/page.tsx` existen

### Error de firma (signing)
- Asegúrate de que el keystore tiene la contraseña correcta
- Verifica que el alias de la key es correcto
- Si usaste `keytool`, el alias por defecto es `mykey`

---

## Configuración rápida (CLI local alternativa)

Si prefieres compilar el APK en tu máquina en lugar de Appflow:

```bash
# 1. Compilar la web
npm run build:web

# 2. Sincronizar Capacitor con Android
npm run cap:sync:android

# 3. Generar APK debug
npm run apk:debug

# 4. Generar APK release (requiere keystore configurado en gradle.properties)
npm run apk:release

# El APK estará en:
# - Debug: android/app/build/outputs/apk/debug/app-debug.apk
# - Release: android/app/build/outputs/apk/release/app-release.apk
```

Pero con Appflow tienes la ventaja de que la compilación ocurre en la nube y no necesitas Android Studio ni SDK locales.
