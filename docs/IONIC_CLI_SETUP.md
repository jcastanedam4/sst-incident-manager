# Configuración de Ionic CLI para Capacitor

Ionic CLI es la herramienta oficial para gestionar proyectos Capacitor. Se requiere para:
- Compilar APKs desde la línea de comandos
- Sincronizar cambios web con Android
- Abrir el proyecto en Android Studio
- Realizar builds en Appflow

## Instalación

```bash
npm install -g @ionic/cli@latest
```

Verifica que se instaló correctamente:

```bash
ionic --version
```

## Comandos Principales

### Sincronizar y compilar web

```bash
# Opción 1: Ionic CLI (recomendado)
ionic capacitor build android

# Opción 2: Comandos npm (lo que usamos normalmente)
npm run build:web
npx cap sync android
```

### Abrir en Android Studio

```bash
npm run cap:open:android
# O
ionic capacitor open android
```

### Compilar APK directo

```bash
ionic capacitor build android --prod
```

Esto ejecuta internamente:
1. `npm run build:web`
2. `npx cap sync android`
3. `gradle assembleRelease` (si es --prod)

## Configuración en Appflow

Si usas Ionic CLI en los scripts de build de Appflow, puede ser más eficiente:

```bash
npm ci
ionic capacitor build android --prod
```

En lugar de:

```bash
npm ci
npm run build:web
npx cap sync android
```

Ambos funcionan, pero `ionic capacitor build` lo maneja todo en un comando.

## Troubleshooting

### "ionic: comando no encontrado"

**Solución**: Instala globalmente o usa `npx`:
```bash
npx @ionic/cli@latest capacitor build android
```

### Error al abrir en Android Studio

**Causa**: Android Studio no está en el PATH o no se detectó.

**Solución**:
1. Asegúrate de que Android Studio está instalado
2. Abre `android/` directamente desde Android Studio: `File → Open → android`
3. O usa el comando desde Android Studio SDK:
   ```bash
   ionic capacitor open android --sudo
   ```

## Próximos Pasos

Una vez instalado Ionic CLI:

1. **Prueba local**:
   ```bash
   ionic capacitor build android
   ```
   Esto debería generar el APK en `android/app/build/outputs/apk/`

2. **En Appflow**: Usa `ionic capacitor build android --prod` en los custom commands

3. **Versioning**: Mantén actualizado:
   ```bash
   npm update -g @ionic/cli
   ```
