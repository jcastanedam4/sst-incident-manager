# Plan de Desarrollo y Cumplimiento de Requerimientos (RF)

## Objetivo del plan

Alinear el proyecto SST Incident Manager con los RF1-RF10, objetivos del proyecto y alcance de Practica de Ingenieria III.

## Fase 1 - Base funcional (Aplicada)

1. Estandarizar estados de incidentes en formato de negocio:

- Abierto
- En Proceso
- Cerrado

1. Implementar carga de evidencia multimedia en Supabase Storage desde el panel de Empleado.

1. Incorporar indicadores de accidentalidad en panel de Administrador.

1. Implementar exportaciones:

- PDF de indicadores
- Excel consolidado de incidentes

1. Integrar visualizacion de auditoria (tabla audit_logs) en la revision administrativa.

### Evidencia aplicada en codigo

- app/dashboard/empleado/page.tsx
- app/dashboard/admin/page.tsx
- types/incidentes.ts
- utils/reportes.ts

## Fase 2 - Capa de datos y cumplimiento normativo

1. Confirmar estructura de tablas y columnas para trazabilidad:

- incidentes
- medidas_correctivas
- audit_logs
- evidencias_incidente (opcional si no se guarda en incidentes)

1. Mantener trigger de auditoria en incidentes.

1. Crear indices para rendimiento de reportes y auditoria:

- audit_logs(record_id, created_at desc)
- incidentes(estado, created_at desc)
- incidentes(tipo_peligro)

1. Revisar politicas RLS por rol para proteger informacion SST.

## Fase 3 - Autenticacion real (Pendiente)

1. Migrar login simulado de localStorage a Supabase Auth.

1. Mapear roles desde perfiles y restringir vistas por rol real.

1. Garantizar changed_by en audit_logs con auth.uid() no nulo.

## Fase 4 - API y documentacion (Pendiente)

1. Definir endpoints principales para:

- usuarios
- incidentes
- medidas correctivas
- auditoria
- reportes

1. Documentar contratos request/response y errores.

1. Consolidar diccionario de datos con tipos y reglas.

## Fase 5 - Prototipado de alta fidelidad (Pendiente)

1. Diseñar en Figma flujo completo:

- reporte de incidente
- administracion y cierre
- historial de auditoria
- dashboard con indicadores

1. Validar usabilidad movil y escritorio.

## Matriz RF (estado actual)

- RF1 Autenticacion por credenciales: Parcial (simulada).
- RF2 Redireccion por rol: Cumple.
- RF3 Registro de incidente GTC45: Cumple.
- RF4 Evidencia fotografica: Parcial (carga implementada, falta validar bucket/politicas/camara por dispositivo).
- RF5 Fecha, hora e identificacion de reportante: Parcial (fecha/hora si; identificacion completa depende de Auth real).
- RF6 Actualizacion de estado por administrador: Cumple.
- RF7 Graficas estadisticas: Cumple (indicadores visuales en dashboard).
- RF8 Exportacion PDF consolidado: Cumple.
- RF9 Historial de cambios por incidente: Cumple (trigger + vista en admin, sujeto a datos en audit_logs).
- RF10 Exportacion PDF y Excel de indicadores: Cumple.

## Criterio de cierre

El proyecto quedara totalmente alineado cuando se cierre Fase 3 (Auth real) y Fase 4 (API/documentacion), manteniendo la auditoria por trigger en Supabase.
