# Organizacion del proyecto SST Incident Manager

## 1) Estructura actual recomendada

```text
app/
  layout.tsx                 # Layout raiz
  page.tsx                   # Login simulado por correo
  dashboard/
    admin/page.tsx           # Interfaz del Responsable SST
    empleado/page.tsx        # Interfaz del Trabajador
  globals.css                # Estilos globales (Tailwind v4)
components/
  Navbar.tsx                 # Muestra rol actual y boton cerrar sesion
  FormularioIncidente.tsx    # Componente de fase anterior (opcional)
  ListaRevision.tsx          # Componente de fase anterior (opcional)
  SimuladorRoles.tsx         # Componente de fase anterior (opcional)
utils/
  supabase.ts                # Cliente de Supabase
  reportes.ts                # Exportación de PDF/Excel y compartir (Capacitor)
  capacitor.ts               # Helper SSR-safe para detectar plataforma nativa
types/                       # Tipados compartidos (incidentes.ts)
public/                      # Archivos estaticos
android/                     # Proyecto Android nativo (Capacitor)
  app/src/main/assets/public/ # ← Archivos web sincronizados aquí por "cap sync"
  build.gradle.kts
  local.properties           # LOCAL (no commit): SDK, NDK, paths
docs/
  ORGANIZACION_PROYECTO.md   # Este documento
  CAPACITOR_IMPLEMENTACION.md# Cómo se implementó Capacitor y webview nativo
  APPFLOW_APK_SETUP.md       # Guía para generar APK con Ionic Appflow
  COMO_SE_DESARROLLO_FASE4.md# Explicacion pedagogica
  FLUJO_REPORTE_Y_GESTION_SST.md # Flujo funcional operativo
next.config.ts              # CRÍTICO: output: "export" para Capacitor
capacitor.config.json       # Configuración de Capacitor (webDir: "out")
```

## 2) Revisión de organización

- Bien separado por responsabilidad: login en `app/page.tsx`, paneles por rol en `app/dashboard/*`, conexion de datos en `utils/supabase.ts`.
- **Escalable a móvil**: Con Capacitor + Next.js static export (`output: "export"`), la misma codebase se convierte en APK nativo Android.
  - `capacitor.config.json` define que los assets web van en `webDir: "out"` (salida de Next.js)
  - `utils/capacitor.ts` proporciona helper SSR-safe para detectar si se ejecuta en plataforma nativa
  - `utils/reportes.ts` usa APIs nativas via Capacitor (@capacitor/camera, @capacitor/filesystem, @capacitor/share)
- El folder `types/` esta listo para centralizar interfaces cuando crezca el proyecto.
- La carpeta `android/` (ignorada en git) contiene el proyecto Gradle; se regenera automáticamente con `npx cap sync android`.

## 3) Flujos principales

### Flujo Web (Vercel)
```
git push → Vercel detecta → npm run build → Despliegue en https://...
```

### Flujo Móvil (APK)
```
npm run build:web → npx cap sync android → gradle build → APK en android/app/build/outputs/apk/
O usando Ionic Appflow:
git push → Appflow detecta → npm run build:web && npx cap sync android → gradle build → APK descargable
```

## 4) Recomendaciones de siguiente paso

- **Para Web (Vercel)**: Crear autenticación real con Supabase Auth reemplazando el simulador en `app/page.tsx`.
- **Para Móvil (APK)**:
  - Usar `npm run cap:sync:android` antes de cada compilación para sincronizar cambios web.
  - Solicitar permisos en runtime en Android 6.0+ (declarar en `AndroidManifest.xml` + código de solicitud).
  - Probar APIs nativas (cámara, almacenamiento) usando el emulador o dispositivo físico.
  - Para distribución en Google Play, firmar con keystore y configurar en Ionic Appflow.
- **Validación y Seguridad**:
  - Agregar validaciones con Zod para formularios en una fase posterior.
  - Implementar middleware Next.js para proteger rutas (`/dashboard/*` solo para roles autenticados).
- **Base de datos**:
  - Registrar prioridad en una columna dedicada (`prioridad`) si quieres filtrar y reportar por criticidad.
  - Usar `types/incidente.ts` centralizado (ya existe) para tipado consistente en web y móvil.
- **Scripts útiles**:
  - `npm run build:web` - Compilar Next.js a archivos estáticos
  - `npm run cap:sync:android` - Sincronizar web + Capacitor plugins con Android
  - `npm run apk:debug` - Generar APK de desarrollo
  - `npm run apk:release` - Generar APK para distribución (requiere keystore)
