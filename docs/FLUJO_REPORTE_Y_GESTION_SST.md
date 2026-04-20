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
- Tipo de peligro (GTC 45).
- Evidencia multimedia (opcional).

1. Al enviar:

- Se inserta el incidente en Supabase.
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

1. Auditoria vacia en UI:

- Causa: trigger no creado o tabla `audit_logs` inexistente.

## Checklist rapido de validacion manual

1. Registro de empleado nuevo y login exitoso.
2. Login como invitado y acceso a dashboard empleado.
3. Login como Encargado SST y acceso a dashboard admin.
4. Creacion de incidente desde empleado.
5. Cambio de estado desde admin.
6. Registro de medida correctiva.
7. Visualizacion de auditoria.
8. Exportacion PDF y Excel.

## Archivos relacionados

- `app/page.tsx`
- `app/dashboard/empleado/page.tsx`
- `app/dashboard/admin/page.tsx`
- `components/Navbar.tsx`
- `utils/reportes.ts`
- `docs/SUPABASE_BASELINE.sql`
