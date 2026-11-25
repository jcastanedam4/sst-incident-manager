# API del SST Incident Manager

Este documento describe las APIs HTTP y las operaciones de datos implementadas
en el proyecto a la fecha. La base del proyecto es Next.js App Router y Supabase.

## Resumen

| Operación | Ubicación | Método |
|---|---|---|
| Registrar y clasificar incidente | `/api/v1/incidentes` | `POST` |
| Listar últimos reportes propios | `/api/v1/incidentes/mis-reportes` | `GET` |
| Consultar incidente por ID | `/api/v1/incidentes/{id}` | `GET` |
| Registrar una evidencia | `/api/evidencias` | `POST` |
| Exportar consolidado a Excel | `/api/export/excel` | `POST` |
| Exportar indicadores a PDF | `/api/export/pdf` | `POST` |

Los endpoints de incidentes siguen el corte vertical
Interfaz -> API -> servicio -> repositorio -> Supabase.

## Convenciones

- Base URL web: origen actual de la aplicación, por ejemplo `http://localhost:3000`.
- Las solicitudes JSON usan `Content-Type: application/json`.
- Los endpoints de incidentes requieren un JWT de Supabase Auth:
  `Authorization: Bearer <access_token>`.
- Las exportaciones reciben los incidentes en el cuerpo de la solicitud.
- Las respuestas tienen JSON cuando representan datos o errores.
- Las exportaciones tienen como respuesta un archivo binario con el encabezado
  `Content-Disposition: attachment`.

---

# API de incidentes

## POST /api/v1/incidentes

Registra y clasifica un incidente.

Autenticación: requerida.

Request:

```json
{
  "titulo": "Derrame en área de producción",
  "descripcion": "Se detectó una sustancia cerca de la zona de trabajo.",
  "tipo_peligro": "Quimico",
  "gravedad": "Alta"
}
```

Campos:

| Campo | Tipo | Obligatorio | Valores o reglas |
|---|---|---:|---|
| `titulo` | string | Sí | Texto no vacío |
| `descripcion` | string | Sí | Texto no vacío |
| `tipo_peligro` | string | Sí | Fisico, Quimico, Biologico, Biomecanico, Psicosocial, Seguridad, Fenomeno natural |
| `gravedad` | string | Sí | Baja, Media, Alta |

La prioridad enviada por el cliente no se utiliza. La prioridad y la atención
inmediata se calculan en el backend.

Response `201 Created`:

```json
{
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "titulo": "Derrame en área de producción",
    "descripcion": "Se detectó una sustancia cerca de la zona de trabajo.",
    "tipo_peligro": "Quimico",
    "gravedad": "Alta",
    "prioridad_asignada": "Alta",
    "requiere_atencion_inmediata": true,
    "estado": "Abierto",
    "fecha_registro": "2026-11-02T08:00:00.000Z"
  }
}
```

El encabezado `Location` contiene
`/api/v1/incidentes/{id}`.

## GET /api/v1/incidentes/{id}

Consulta un incidente clasificado por su identificador. No modifica datos.

Autenticación: requerida.

Parámetros:

| Parámetro | Ubicación | Tipo | Reglas |
|---|---|---|---|
| `id` | ruta | string | UUID válido |

Response `200 OK`:

```json
{
  "data": {
    "id": "00000000-0000-4000-8000-000000000001",
    "titulo": "Derrame en área de producción",
    "descripcion": "Se detectó una sustancia cerca de la zona de trabajo.",
    "tipo_peligro": "Quimico",
    "gravedad": "Alta",
    "prioridad_asignada": "Alta",
    "requiere_atencion_inmediata": true,
    "estado": "Abierto",
    "fecha_registro": "2026-11-02T08:00:00.000Z"
  }
}
```

## GET /api/v1/incidentes/mis-reportes

Devuelve como máximo los cinco incidentes más recientes del usuario autenticado,
ordenados por fecha de registro descendente. El servidor obtiene la identidad del
JWT, consulta por `user_id` y también incluye registros antiguos sin `user_id`
cuando `user_email` coincide con el correo autenticado. No acepta una identidad
enviada por el cliente.

Autenticación: requerida.

Response `200 OK`:

```json
{
  "data": [
    {
      "id": "00000000-0000-4000-8000-000000000001",
      "titulo": "Derrame en área de producción",
      "descripcion": "Se detectó una sustancia cerca de la zona de trabajo.",
      "tipo_peligro": "Quimico",
      "gravedad": "Alta",
      "prioridad_asignada": "Alta",
      "requiere_atencion_inmediata": true,
      "estado": "Abierto",
      "fecha_registro": "2026-11-02T08:00:00.000Z"
    }
  ]
}
```

## Matriz de priorización

| Condición | Prioridad | Atención inmediata |
|---|---|---|
| Peligro biológico o químico | Alta | Sí |
| Gravedad Alta | Alta | Sí |
| Gravedad Media | Media | No |
| Gravedad Baja | Baja | No |

La selección de prioridad debe realizarse solo en
`lib/incidentes/evaluadorRiesgo.ts`.

## Errores de incidentes

Los errores de incidentes usan el siguiente formato:

```json
{
  "error": {
    "codigo": "VALIDACION",
    "mensaje": "Los datos enviados no son válidos.",
    "detalles": [
      {
        "campo": "titulo",
        "mensaje": "El titulo es obligatorio."
      }
    ]
  }
}
```

| Estado | Código | Situación |
|---:|---|---|
| `400` | `VALIDACION` | JSON inválido o campos incorrectos |
| `401` | `NO_AUTORIZADO` | Falta el bearer token o el JWT no es válido |
| `404` | `NO_ENCONTRADO` | El incidente no existe o no está disponible según las políticas RLS |
| `500` | `ERROR_INTERNO` | Error interno o de persistencia; no expone detalles técnicos |

El frontend debe distinguir entre:

- errores de validación;
- errores de negocio, autenticación o recurso inexistente;
- errores de comunicación cuando no se recibe una respuesta JSON utilizable.

---

# Evidencias

## POST /api/evidencias

Registra en la tabla `evidencias` la URL de un archivo ya almacenado.

Request:

```json
{
  "incidente_id": "00000000-0000-4000-8000-000000000001",
  "url_storage": "https://example.supabase.co/storage/v1/object/public/evidencias-incidentes/ruta/archivo.jpg",
  "tipo_archivo": "image/jpeg"
}
```

Response `200 OK`:

```json
{
  "ok": true
}
```

Errores:

| Estado | Situación |
|---:|---|
| `400` | Falta `incidente_id` o `url_storage` |
| `500` | Error al insertar en Supabase o JSON inválido |

Respuesta de error:

```json
{
  "error": "Descripción del problema"
}
```

Este endpoint utiliza el cliente administrativo de Supabase. La clave
`SUPABASE_SERVICE_ROLE_KEY` solo debe existir en variables de entorno privadas
del servidor y nunca en código o variables públicas del cliente.

### Estado actual de las evidencias

La utilidad `utils/evidencias.ts` también puede subir archivos directamente a
Supabase Storage y registrar el enlace con el cliente de usuario:

1. sube el archivo al bucket `evidencias-incidentes`;
2. obtiene la URL pública;
3. inserta el registro en la tabla `evidencias`.

Por ello `/api/evidencias` y el flujo directo conviven en el código. La
integración nueva debería elegir una única ruta y mantener la autenticación y
las políticas RLS consistentes.

---

# Exportaciones

## POST /api/export/excel

Genera un archivo Excel HTML descargable con el consolidado de incidentes.

Request:

```json
{
  "incidentes": [
    {
      "id": "uuid",
      "titulo": "Incidente",
      "descripcion": "Descripción",
      "tipo_peligro": "Seguridad",
      "estado": "Abierto",
      "fecha_suceso": "2026-11-02",
      "created_at": "2026-11-02T08:00:00.000Z",
      "user_email": "usuario@empresa.com",
      "evidencia_url": "https://example.com/evidencia.jpg"
    }
  ]
}
```

Response `200 OK`:

- `Content-Type: application/vnd.ms-excel; charset=utf-8`
- `Content-Disposition: attachment; filename=incidentes_YYYY-MM-DD.xls`
- Cuerpo: documento HTML compatible con Excel.

Errores:

```json
{
  "error": "Descripción del problema"
}
```

## POST /api/export/pdf

Genera un PDF básico con indicadores de accidentalidad.

Request:

```json
{
  "incidentes": [
    {
      "id": "uuid",
      "titulo": "Incidente",
      "tipo_peligro": "Seguridad",
      "estado": "Abierto",
      "created_at": "2026-11-02T08:00:00.000Z"
    }
  ]
}
```

El endpoint calcula total de incidentes, abiertos, en proceso, cerrados y
distribución por tipo de peligro.

Response `200 OK`:

- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename=indicadores_sst_YYYY-MM-DD.pdf`
- Cuerpo: archivo PDF.

Errores:

```json
{
  "error": "Descripción del problema"
}
```

---

# Operaciones con Supabase fuera de una ruta API

Además de las rutas anteriores, varias pantallas consultan tablas de Supabase
directamente mediante el cliente `utils/supabase.ts`. Esto no significa que
existan automáticamente rutas HTTP Next.js para esas operaciones.

Ejemplos principales:

- autenticación con Supabase Auth;
- consulta del listado de incidentes para administración;
- actualización de estado de incidentes;
- inserción y consulta de evidencias;
- operaciones de Storage para subir archivos.

Esta documentación no debe considerar implementados los siguientes diseños
históricos mientras no exista una ruta Next.js correspondiente:

- `POST /api/auth/login`;
- `GET /api/incidentes`;
- `PATCH /api/incidentes/{id}/estado`;
- `POST /api/incidentes/{id}/medidas`;
- `GET /api/incidentes/{id}/auditoria`;
- `GET /api/reportes/indicadores`;
- `GET /api/reportes/exportar`.

Las exportaciones históricas se implementaron con las rutas `/api/export/excel`
y `/api/export/pdf`.
