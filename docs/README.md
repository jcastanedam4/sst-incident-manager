# Documentación del Proyecto SST Incident Manager

Este directorio contiene toda la documentación del proyecto. Aquí está la guía de cada archivo:

## 📋 Índice de Documentos

### Arquitectura y Estructura
- **[ORGANIZACION_PROYECTO.md](ORGANIZACION_PROYECTO.md)** - Estructura del proyecto, folders, responsabilidades y flujos de desarrollo (web + móvil)
- **[CAPACITOR_IMPLEMENTACION.md](CAPACITOR_IMPLEMENTACION.md)** - Detalle técnico de cómo se implementó Capacitor para crear webview nativo Android

### Guías de Compilación y Despliegue
- **[APPFLOW_APK_SETUP.md](APPFLOW_APK_SETUP.md)** - Paso a paso para generar APK usando Ionic Appflow (nube)
- **[IONIC_CLI_SETUP.md](IONIC_CLI_SETUP.md)** - Instalación y uso de Ionic CLI (herramienta oficial Capacitor)
- **[COMO_SE_DESARROLLO_FASE4.md](COMO_SE_DESARROLLO_FASE4.md)** - Evolución pedagógica de cómo se construyó este proyecto desde cero

### Funcionalidad y Flujos
- **[FLUJO_REPORTE_Y_GESTION_SST.md](FLUJO_REPORTE_Y_GESTION_SST.md)** - Flujo operativo: reportar incidentes, revisiones, exportar PDF/Excel
- **[API_ENDPOINTS.md](API_ENDPOINTS.md)** - Listado de endpoints y funciones disponibles en Supabase
- **[LOGIN_SIMULADO_Y_PROTECCION_RUTAS.md](LOGIN_SIMULADO_Y_PROTECCION_RUTAS.md)** - Cómo funciona la autenticación simulada y protección de rutas

### Infraestructura y Base de Datos
- **[INFORME_PRUEBAS.md](INFORME_PRUEBAS.md)** - Resultados y cobertura de pruebas automatizadas
- **[SUPABASE_BASELINE.sql](SUPABASE_BASELINE.sql)** - Script de inicialización de base de datos
- **[SEED_25_INCIDENTES.sql](SEED_25_INCIDENTES.sql)** - Datos de prueba (25 incidentes para testing)

---

## 🚀 Flujos Rápidos

### Quiero... generar un APK
→ Lee: **[APPFLOW_APK_SETUP.md](APPFLOW_APK_SETUP.md)** (opción cloud) o **[CAPACITOR_IMPLEMENTACION.md](CAPACITOR_IMPLEMENTACION.md)** §Paso 8 (opción local)

### Quiero... entender la arquitectura del proyecto
→ Lee: **[ORGANIZACION_PROYECTO.md](ORGANIZACION_PROYECTO.md)** + **[CAPACITOR_IMPLEMENTACION.md](CAPACITOR_IMPLEMENTACION.md)**

### Quiero... saber cómo funciona el reporte y exportación
→ Lee: **[FLUJO_REPORTE_Y_GESTION_SST.md](FLUJO_REPORTE_Y_GESTION_SST.md)**

### Quiero... entender cómo se implementó Capacitor y el webview
→ Lee: **[CAPACITOR_IMPLEMENTACION.md](CAPACITOR_IMPLEMENTACION.md)** (todo el documento)

### Quiero... configurar la base de datos desde cero
→ Corre: `SUPABASE_BASELINE.sql` y `SEED_25_INCIDENTES.sql`

---

## 🔧 Stack Técnico

| Capa | Tecnología | Docs |
|------|-----------|------|
| **Web** | Next.js 16.2.4 (Turbopack) + React 19 + Tailwind v4 | [ORGANIZACION_PROYECTO.md](ORGANIZACION_PROYECTO.md) |
| **API** | Supabase (PostgreSQL) | [API_ENDPOINTS.md](API_ENDPOINTS.md) |
| **Móvil** | Capacitor 8.x + Android Gradle | [CAPACITOR_IMPLEMENTACION.md](CAPACITOR_IMPLEMENTACION.md) |
| **Despliegue Web** | Vercel | - |
| **Despliegue APK** | Ionic Appflow o Gradle local | [APPFLOW_APK_SETUP.md](APPFLOW_APK_SETUP.md) |
| **Autenticación** | Simulada (localStorage) → Supabase Auth (futuro) | [LOGIN_SIMULADO_Y_PROTECCION_RUTAS.md](LOGIN_SIMULADO_Y_PROTECCION_RUTAS.md) |

---

## 📦 Dependencias Principales

```json
{
  "dependencies": {
    "next": "16.2.4",
    "react": "19.2.4",
    "@capacitor/core": "^8.3.3",
    "@capacitor/android": "^8.3.3",
    "@capacitor/camera": "^8.2.0",
    "@capacitor/filesystem": "^8.1.2",
    "@capacitor/share": "^8.0.1",
    "@supabase/supabase-js": "^2.101.1",
    "jspdf": "^4.2.1",
    "jspdf-autotable": "^5.0.7",
    "exceljs": "^4.4.0"
  }
}
```

---

## 🎯 Cómo Navegar Esta Documentación

1. **Nuevo en el proyecto?** → Empieza por [ORGANIZACION_PROYECTO.md](ORGANIZACION_PROYECTO.md)
2. **¿Necesitas construir un APK?** → Ve a [APPFLOW_APK_SETUP.md](APPFLOW_APK_SETUP.md)
3. **¿Entender la integración Capacitor?** → Lee [CAPACITOR_IMPLEMENTACION.md](CAPACITOR_IMPLEMENTACION.md)
4. **¿Implementar/entender un feature?** → Busca en los docs específicos (FLUJO_REPORTE_*, API_ENDPOINTS, etc.)

---

## 📝 Notas de Mantenimiento

- Los SQL scripts están en este directorio para facilitar reset/seeding rápido.
- `CAPACITOR_IMPLEMENTACION.md` se actualiza cuando hay cambios en la configuración de Capacitor.
- `APPFLOW_APK_SETUP.md` incluye troubleshooting y configuraciones de signinig (keystore).
- Todos los docs usan Markdown estándar y son editables con cualquier editor de texto.

---

**Última actualización**: 11 de mayo de 2026
