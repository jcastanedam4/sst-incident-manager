# Capacitor Android (APK)

Guia operativa para generar APK de `SST Incident Manager` usando Capacitor + Next.js 16.

## Estado actual del proyecto

- App web exportada en modo estatico (`output: "export"`).
- Plataforma Android creada en `android/`.
- Plugins nativos integrados:
  - `@capacitor/camera`
  - `@capacitor/filesystem`
  - `@capacitor/share`

## 1) Requisitos locales (Windows)

1. Node.js 20+
2. Android Studio (SDK + Build Tools + Platform Tools)
3. JDK 17 (Temurin recomendado)
4. Variables de entorno:
   - `JAVA_HOME` apuntando al JDK 17
   - `%JAVA_HOME%\\bin` en `Path`

Comprobacion rapida:

```powershell
java -version
```

## 2) Comandos base del flujo

Desde la raiz del repo:

```powershell
npm install
npm run cap:assets:android
npm run cap:sync:android
```

Abrir proyecto Android en Android Studio:

```powershell
npm run cap:open:android
```

## 3) Generar APK debug

Opcion terminal (Windows):

```powershell
npm run apk:debug
```

Salida esperada:

- `android/app/build/outputs/apk/debug/app-debug.apk`

## 4) Generar build release

1. Generar keystore (una sola vez):

```powershell
keytool -genkeypair -v -keystore keystore\sst-incident-manager-release.jks -alias sstincident -keyalg RSA -keysize 2048 -validity 10000
```

2. Copiar el template y completar secretos:

```powershell
Copy-Item android\keystore.properties.example android\keystore.properties
```

3. Editar `android/keystore.properties` con tus claves reales.

4. Ejecutar release:

```powershell
npm run apk:release
```

Salida esperada:

- `android/app/build/outputs/apk/release/app-release.apk`

## 5) Icono y splash (personalizacion)

El repositorio ya incluye `resources/logo.svg` y un script para generar assets Android.

Para personalizar:

1. Reemplaza `resources/logo.svg` por tu branding.
2. Regenera assets:

```powershell
npm run cap:assets:android
```

Despues de actualizar assets, sincroniza:

```powershell
npm run cap:copy:android
```

Si cambias plugins o `AndroidManifest`, usa `npm run cap:sync:android`.

## 6) Flujo de desarrollo recomendado

- Cambios web (React/Next):

```powershell
npm run cap:copy:android
```

- Cambios de plugins/permisos/config nativa:

```powershell
npm run cap:sync:android
```

## 7) Validacion funcional minima en Android

1. Login y redireccion por rol.
2. Reporte incidente con camara nativa.
3. Subida de evidencia a Supabase Storage.
4. Exportar PDF y Excel (share nativo).
5. Cierre de sesion y nuevo ingreso.
