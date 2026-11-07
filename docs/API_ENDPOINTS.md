# API v1 - Corte vertical de incidentes

Autenticacion: `Authorization: Bearer <access_token de Supabase>`. Errores: `{ "error": { "codigo", "mensaje", "detalles?" } }`.

## POST /api/v1/incidentes (RF-01)

Request:

```json
{
  "titulo": "Derrame en area de produccion",
  "descripcion": "Se detecto una sustancia cerca de la zona de trabajo.",
  "tipo_peligro": "Quimico",
  "gravedad": "Alta"
}
```

Valores permitidos: `tipo_peligro` = Fisico, Quimico, Biologico, Biomecanico, Psicosocial, Seguridad, Fenomeno natural; `gravedad` = Baja, Media, Alta. Cualquier prioridad enviada por el cliente se ignora.

201 (header `Location: /api/v1/incidentes/{id}`):

```json
{
  "data": {
    "id": "uuid",
    "titulo": "...",
    "descripcion": "...",
    "tipo_peligro": "Quimico",
    "gravedad": "Alta",
    "prioridad_asignada": "Alta",
    "requiere_atencion_inmediata": true,
    "estado": "Abierto",
    "fecha_registro": "2026-11-02T08:00:00.000Z"
  }
}
```

Errores: 400 `VALIDACION` (con `detalles` por campo), 401 `NO_AUTORIZADO`, 500 `ERROR_INTERNO` (sin detalles tecnicos).

## GET /api/v1/incidentes/{id} (RF-02)

200 con el mismo objeto `data`. 400 `VALIDACION` (id no UUID), 401, 404 `NO_ENCONTRADO` (inexistente o fuera del alcance RLS del usuario), 500 `ERROR_INTERNO`. No modifica datos.

## Matriz de priorizacion

| Condicion | Prioridad | Atencion inmediata |
|---|---|---|
| Peligro Biologico o Quimico | Alta | Si |
| Gravedad Alta | Alta | Si |
| Gravedad Media | Media | No |
| Gravedad Baja | Baja | No |

---

# Documentacion previa (referencial)

## Documentacion de API - SST Incident Manager

## Objetivo

Definir endpoints principales para gestion de usuarios, incidentes, bitacoras y reportes.

## Convenciones

- Base URL: /api
- Content-Type: application/json
- Autenticacion esperada: JWT de Supabase Auth (fase de implementacion)

## 1) Autenticacion

### POST /api/auth/login

Request:

```json
{
  "email": "usuario(at)empresa.com",
  "password": "******"
}
```

Response 200:

```json
{
  "token": "jwt",
  "user": {
    "id": "uuid",
    "email": "usuario(at)empresa.com",
    "rol": "ADMIN"
  }
}
```

## 2) Incidentes

### GET /api/incidentes

Query opcional:

- estado = Abierto|En Proceso|Cerrado
- tipo_peligro = Fisico
- desde=2026-01-01
- hasta=2026-12-31

Response 200:

```json
{
  "items": [
    {
      "id": "uuid",
      "titulo": "Piso humedo",
      "descripcion": "...",
      "tipo_peligro": "Seguridad",
      "estado": "Abierto",
      "fecha_suceso": "2026-04-19T10:00:00Z",
      "evidencia_url": "https://..."
    }
  ]
}
```

### POST /api/incidentes

Request:

```json
{
  "titulo": "Piso humedo",
  "descripcion": "Riesgo de caida",
  "tipo_peligro": "Seguridad",
  "evidencia_url": "https://..."
}
```

Response 201:

```json
{
  "id": "uuid",
  "estado": "Abierto"
}
```

### PATCH /api/incidentes/:id/estado

Request:

```json
{
  "estado": "En Proceso"
}
```

Response 200:

```json
{
  "id": "uuid",
  "estado": "En Proceso"
}
```

## 3) Medidas correctivas

### POST /api/incidentes/:id/medidas

Request:

```json
{
  "descripcion_accion": "Instalar cinta antideslizante",
  "prioridad": "Alta"
}
```

Response 201:

```json
{
  "id": "uuid",
  "incidente_id": "uuid"
}
```

## 4) Auditoria

### GET /api/incidentes/:id/auditoria

Response 200:

```json
{
  "items": [
    {
      "id": "uuid",
      "action": "UPDATE",
      "changed_by": "uuid",
      "created_at": "2026-04-19T12:00:00Z",
      "old_data": {},
      "new_data": {}
    }
  ]
}
```

## 5) Reportes

### GET /api/reportes/indicadores

Response 200:

```json
{
  "total": 30,
  "abiertos": 5,
  "en_proceso": 12,
  "cerrados": 13,
  "por_tipo": [
    { "tipo": "Seguridad", "cantidad": 10 }
  ]
}
```

### GET /api/reportes/exportar?formato=pdf|excel

Response 200:

- Archivo binario descargable

## Errores estandar

Response 400:

```json
{
  "error": "Solicitud invalida"
}
```

Response 401:

```json
{
  "error": "No autenticado"
}
```

Response 403:

```json
{
  "error": "Sin permisos"
}
```

Response 500:

```json
{
  "error": "Error interno"
}
```
