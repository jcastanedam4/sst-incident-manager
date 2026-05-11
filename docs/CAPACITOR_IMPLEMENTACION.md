# Implementación de Capacitor - Webview Nativo

Esta documentación detalla cómo se implementó **Capacitor** en este proyecto para convertir la aplicación web Next.js en una aplicación móvil Android con webview nativo.

## ¿Qué es Capacitor?

Capacitor es un framework que permite ejecutar aplicaciones web (HTML, CSS, JS) dentro de un contenedor nativo (webview) en iOS y Android. Actúa como un puente entre el código web y las APIs nativas del dispositivo (cámara, almacenamiento, contactos, etc.).

## Arquitectura Implementada

```
Next.js (web)
    ↓
Static Export (output: export en next.config.ts)
    ↓
Assets generados en /out
    ↓
Capacitor Copy/Sync
    ↓
Android Project (webview + plugins nativos)
    ↓
Gradle Build
    ↓
APK compilado
```

## Paso 1: Configuración de Next.js para Static Export

**Archivo**: `next.config.ts`

```typescript
const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "export",  // ← CRÍTICO: genera archivos estáticos en /out
};
```

**Por qué**: Capacitor necesita archivos estáticos (HTML, CSS, JS, assets). Next.js por defecto genera servidor Node, pero con `output: "export"` genera un sitio estático puro.

## Paso 2: Instalación de Capacitor

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android --save
```

Estos paquetes añaden:
- **@capacitor/core**: Runtime que inicia el webview y gestiona el puente web-nativo
- **@capacitor/cli**: Herramientas para crear y sincronizar proyectos Android/iOS
- **@capacitor/android**: Módulo específico para Android (contiene dependencias de Gradle)

## Paso 3: Inicialización de Capacitor

```bash
npx cap init "sst-incident-manager" com.jcastanedam4.sstincidentmanager
```

Esto crea:
- `capacitor.config.json`: Configuración de Capacitor
- `capacitor.plugins.json`: Registro de plugins nativos

**Contenido esperado en `capacitor.config.json`**:

```json
{
  "appId": "com.jcastanedam4.sstincidentmanager",
  "appName": "sst-incident-manager",
  "webDir": "out",
  "plugins": {
    "SplashScreen": {
      "launchAutoHide": true
    }
  }
}
```

**Parámetros clave**:
- `appId`: Package ID único en Google Play / Android
- `appName`: Nombre visible en el device
- `webDir`: **Ruta donde Capacitor busca los archivos web** (en este proyecto es `out`, salida de Next.js)

## Paso 4: Agregar Plataforma Android

```bash
npx cap add android
```

Genera:
- `android/`: Proyecto completo de Android (Gradle, AndroidManifest.xml, etc.)
- `android/app/src/main/java/com/jcastanedam4/sstincidentmanager/MainActivity.kt`
- `android/app/src/main/AndroidManifest.xml`

**Estructura generada**:
```
android/
  ├── app/
  │   ├── build/                    # Salida de compilación (ignorado en .gitignore)
  │   ├── src/
  │   │   ├── main/
  │   │   │   ├── java/...          # Código Kotlin/Java nativo
  │   │   │   ├── res/              # Recursos (layouts, strings, drawables)
  │   │   │   ├── AndroidManifest.xml
  │   │   │   └── assets/
  │   │   │       └── public/       # ← Archivos web copiados aquí por "cap sync"
  │   │   └── ...
  │   ├── build.gradle.kts
  │   └── ...
  ├── gradle/
  ├── build.gradle.kts
  ├── settings.gradle.kts
  └── local.properties              # Variables locales (JDK, SDK, etc.)
```

## Paso 5: Sincronizar Archivos Web con Android

```bash
npm run build:web
npx cap sync android
```

Este comando:
1. Detecta cambios en el proyecto Next.js
2. Copia los archivos de `/out` a `android/app/src/main/assets/public/`
3. Sincroniza los plugins instalados con las dependencias de Gradle

**¿Qué se copia?**
```
/out (salida Next.js)
  ├── _next/
  ├── dashboard/
  ├── index.html
  ├── favicon.ico
  └── ...
       ↓ cap sync
  → android/app/src/main/assets/public/
```

## Paso 6: Instalación de Plugins Nativos

Para este proyecto se instalaron:

```bash
npm install @capacitor/camera
npm install @capacitor/filesystem
npm install @capacitor/share
```

Estos proporcionan acceso nativo a:
- **Camera**: Capturar fotos desde la cámara del dispositivo
- **Filesystem**: Leer/escribir archivos en almacenamiento del dispositivo
- **Share**: Compartir archivos vía WhatsApp, email, etc.

**En el código**:

```typescript
// utils/reportes.ts
import { Camera } from "@capacitor/camera";
import { Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

// Usar las APIs nativas
const photo = await Camera.getPhoto({ ... });
```

El puente Capacitor traduce estas llamadas JavaScript a código Java/Kotlin nativo.

## Paso 7: Configuración para SSR Safety

Como Next.js puede renderizar en servidor (SSR), es crítico no acceder a Capacitor/window en servidor.

**Archivo**: `utils/capacitor.ts`

```typescript
export const esAplicacionNativa = (): boolean => {
  try {
    // Verifica que estamos en el navegador
    const g: any = typeof globalThis !== "undefined" ? globalThis : {}
    const Cap = g.Capacitor
    if (!Cap) return false
    // En plataforma nativa, Capacitor expone isNativePlatform() o platform
    if (typeof Cap.isNativePlatform === "function") return Cap.isNativePlatform()
    if (Cap.platform && Cap.platform !== "web") return true
    return false
  } catch {
    return false
  }
}
```

**Uso en componentes**:

```typescript
import { esAplicacionNativa } from "@/utils/capacitor";

export default function MiComponente() {
  const esNativa = esAplicacionNativa();
  
  if (esNativa) {
    // Usar APIs de Capacitor
    return <button onClick={() => Camera.getPhoto()}>Foto</button>;
  } else {
    // Usar fallback web
    return <input type="file" />;
  }
}
```

## Paso 8: Compilación de APK

### Debug (desarrollo)

```bash
npm run apk:debug
```

Genera: `android/app/build/outputs/apk/debug/app-debug.apk`

### Release (distribución)

```bash
npm run apk:release
```

Genera: `android/app/build/outputs/apk/release/app-release-unsigned.apk`

Para firmar y publicar en Google Play, se requiere un keystore (archivo .jks).

## Flujo Completo de Desarrollo

1. **Cambiar código web**:
   ```bash
   # Editar app/dashboard/admin/page.tsx, utils/reportes.ts, etc.
   ```

2. **Compilar web y sincronizar**:
   ```bash
   npm run cap:sync:android
   # Esto corre: npm run build:web && npx cap sync android
   ```

3. **Abrir en Android Studio** (opcional):
   ```bash
   npm run cap:open:android
   ```

4. **Compilar y ejecutar**:
   ```bash
   npm run apk:debug
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```

O instalar directamente desde Android Studio.

## Estructura Final en Git

```
.gitignore (actualizado)
  ├── android/          # ← Ignorado (builds, intermedios)
  ├── build-output.log  # ← Ignorado (logs)
  ├── node_modules/     # ← Ignorado (dependencias)
  ├── out/              # ← Ignorado (salida Next.js)
  └── .next/            # ← Ignorado (caché Next.js)

Archivos en Git:
  ├── capacitor.config.json          # ← Sí (configuración compartida)
  ├── capacitor.plugins.json         # ← Sí (registro de plugins)
  ├── app/dashboard/admin/page.tsx   # ← Sí (código web)
  ├── utils/reportes.ts              # ← Sí (lógica con APIs nativas)
  └── utils/capacitor.ts             # ← Sí (helper SSR-safe)
```

**La carpeta `android/` no se commitea** porque:
- Contiene archivos generados (build output)
- Es muy grande (cientos de MB)
- Se regenera automáticamente con `npx cap sync android`

## Variables de Entorno y Configuración Local

### `android/local.properties`

```properties
sdk.dir=C:\\Android\\sdk
ndk.dir=C:\\Android\\ndk\\27.0.11718014
java.home=C:\\Program Files\\Java\\jdk-21
```

Este archivo es **local** (ignorado en git) y contiene rutas específicas de cada máquina.

## Diferencias: Web vs. Nativo

| Aspecto | Web (Vercel) | Nativo (Capacitor) |
|--------|---------|---------|
| Despliegue | URL pública en navegador | APK instalado en el device |
| Persistencia | localStorage / sessionStorage | Filesystem nativo (permanente) |
| Permisos | Permisos del navegador | Permisos de Android (CAMERA, READ_STORAGE, etc.) |
| Cámara | HTML input file | @capacitor/camera (acceso nativo) |
| Compartir | Copy-paste manual | @capacitor/share (nativo) |
| Conectividad | Depende de red | Detecta conexión nativa |

## Troubleshooting

### Error: "Can't resolve '@capacitor/camera'"

**Causa**: Plugin no instalado.

**Solución**:
```bash
npm install @capacitor/camera
npx cap sync android
```

### El APK no muestra la app (pantalla blanca)

**Causa**: `webDir` en `capacitor.config.json` es incorrecto o `/out` no existe.

**Solución**:
```bash
npm run build:web
npx cap sync android
```

### Permisos no funcionan (cámara, almacenamiento)

**Causa**: Permisos no declarados en `AndroidManifest.xml` o no otorgados en runtime.

**Solución**:
- Verifica que `android/app/src/main/AndroidManifest.xml` tenga:
  ```xml
  <uses-permission android:name="android.permission.CAMERA" />
  <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
  ```
- En el código, solicita permisos en runtime (Android 6.0+).

## Referencias

- [Capacitor Official Docs](https://capacitorjs.com/docs)
- [Capacitor Android Guide](https://capacitorjs.com/docs/android)
- [Next.js Static Export](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
- [Android Gradle Documentation](https://developer.android.com/build)
