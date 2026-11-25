# Flujo de Reporte y Gestion SST

## Objetivo

Documentar el flujo funcional completo del sistema, desde el ingreso hasta la gestion administrativa, auditoria y exportacion de reportes.

## Actores

- Empleado Invitado: cuenta predefinida para reportar incidentes.
- Empleado Registrado: cuenta creada localmente desde la pantalla de login.
- Encargado SST (Admin): responsable de revisar, actualizar estados, analizar indicadores y exportar reportes.

## Credenciales actuales (login simulado)

- Invitado empleado: `invitado@sst.com` / `Invitado123`.
- Encargado SST: `encargado.sst@empresa.com` / `E1234`.
- Registro local de empleados: disponible en la pantalla de inicio.

## Precondiciones

1. Variables de entorno de Supabase configuradas.
2. Tablas en Supabase creadas: `incidentes`, `medidas_correctivas`, `audit_logs`.
3. Trigger de auditoria activo sobre `incidentes`.
4. Bucket de storage para evidencias: `evidencias-incidentes`.
5. Para usar la clasificación automática: modelo local instalado y API FastAPI
   activa en `http://127.0.0.1:8000`. Si no está disponible, el reporte puede
   quedar pendiente como `Sin clasificar`.

## Flujo 1 - Ingreso y asignacion de rol

1. El usuario abre la app en `/`.
1. Puede elegir:

- Iniciar sesion con cuenta existente.
- Usar cuenta invitado (autocompleta credenciales).
- Registrarse como empleado (correo + contrasena + confirmacion).

1. Si las credenciales son validas, se guarda `sst_user` en localStorage.
1. El sistema redirige por rol:

- Empleado a `/dashboard/empleado`.
- Encargado SST a `/dashboard/admin`.

Resultado esperado:

- El navbar muestra el rol y correo de la sesion actual.

## Flujo 2 - Reporte de incidente (Empleado)

Ruta: `/dashboard/empleado`

1. El empleado completa:

- Titulo.
- Descripcion.
- Gravedad.
- Evidencia multimedia (opcional).

1. Al escribir el título o la descripción:

- La interfaz envía ambos textos a la API de sugerencia después de una pausa
  de 250 ms.
- El tipo sugerido aparece automáticamente en el campo de peligro GTC 45, que
  no se puede editar.

1. Al enviar:

- La ruta `POST /api/v1/incidentes` valida el reporte, calcula la prioridad y
  persiste el incidente mediante el servicio y repositorio.
- Si la IA no respondió, el campo se guarda como `Sin clasificar`, con prioridad
  y atención inmediata pendientes hasta la revisión administrativa.
- Se intenta subir evidencia a Storage.
- Se guarda URL publica de evidencia (si aplica).

Resultado esperado:

- Mensaje de confirmacion en pantalla.
- El incidente queda visible posteriormente para el Encargado SST.

Nota tecnica importante:

- El estado funcional esperado es `Abierto`.
- Si la BD usa enum legado (`pendiente`, `en_revision`, etc.), el insert puede fallar hasta normalizar estados.

## Flujo 3 - Gestion administrativa (Encargado SST)

Ruta: `/dashboard/admin`

1. El Encargado SST visualiza:

- Indicadores de accidentalidad.
- Lista de incidentes con filtro por estado.

1. Puede ejecutar acciones por incidente:

- Revisar y ver auditoria.
- Marcar En Proceso.
- Cerrar.

1. En modal de revision:

- Recibe una sugerencia de tipo de peligro que puede modificar.
- Puede modificar la gravedad.
- Al guardar tipo o gravedad, la ruta protegida
  `PATCH /api/v1/incidentes/{id}` recalcula prioridad y atención inmediata en
  backend. El cambio queda en la bitácora de auditoría de Supabase.
- Define prioridad.
- Registra medida correctiva.
- Guarda revision (inserta en `medidas_correctivas`).

Resultado esperado:

- El incidente cambia de estado segun la accion.
- Se actualiza la lista e indicadores.

## Flujo 4 - Auditoria historica

1. Cada INSERT/UPDATE/DELETE en `incidentes` dispara trigger.
1. El trigger registra en `audit_logs`:

- `record_id`.
- `changed_by`.
- `action`.
- `old_data`.
- `new_data`.

1. En el modal del admin se consulta historial por incidente.

Resultado esperado:

- El admin puede ver trazabilidad temporal de cambios.

Nota:

- Con login simulado, `changed_by` puede ser `NULL`.
- Para trazabilidad completa por usuario se recomienda Supabase Auth.

## Flujo 5 - Indicadores y exportacion

En `/dashboard/admin`:

1. El sistema calcula indicadores:

- Total incidentes.
- Abiertos.
- En Proceso.
- Cerrados.
- Distribucion por tipo de peligro.

1. El Encargado SST puede exportar:

- PDF de indicadores.
- Excel consolidado de incidentes.

Resultado esperado:

- Se descargan archivos con fecha en nombre.

## Flujo 6 - Cierre de sesion

1. El usuario hace clic en `Cerrar sesion`.
2. Se limpia localStorage de sesion.
3. El sistema regresa a `/`.

Resultado esperado:

- No se puede seguir en dashboard sin reiniciar sesion.

## Casos de error comunes

1. Error enum de estado:

- Mensaje: `invalid input value for enum incidente_estado: "Abierto"`.
- Causa: enum de BD no actualizado a estados funcionales actuales.

1. Error de evidencia en Storage:

- Causa: bucket inexistente o politicas de acceso no configuradas.

1. Clasificación automática no disponible:

- Comprueba `http://127.0.0.1:8000/health`.
- Inicia el servicio desde la raíz del repositorio con
  `python -m uvicorn ml_api.main:app --host 127.0.0.1 --port 8000`.
- Consulta [API_CLASIFICACION_RIESGO_IA.md](./API_CLASIFICACION_RIESGO_IA.md) para
  revisar entorno, pesos y configuración.

1. Auditoria vacia en UI:

- Causa: trigger no creado o tabla `audit_logs` inexistente.

## Checklist rapido de validacion manual

1. Registro de empleado nuevo y login exitoso.
2. Login como invitado y acceso a dashboard empleado.
3. Login como Encargado SST y acceso a dashboard admin.
4. Creacion de incidente desde empleado.
5. Verificar clasificación automática y el caso de envío `Sin clasificar`.
6. Cambiar tipo de peligro y gravedad desde admin y verificar recálculo.
7. Cambio de estado desde admin.
8. Registro de medida correctiva.
9. Visualizacion de auditoria.
10. Exportacion PDF y Excel.

## Archivos relacionados

- `app/page.tsx`
- `app/dashboard/empleado/page.tsx`
- `app/dashboard/admin/page.tsx`
- `components/Navbar.tsx`
- `utils/reportes.ts`
- `docs/SUPABASE_BASELINE.sql`
