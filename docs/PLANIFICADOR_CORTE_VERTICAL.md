# Planificador de desarrollo: corte vertical SST

Basado en la plantilla de alcance del corte vertical, las guías de semanas 12–15 y el estado actual del repositorio `sst-incident-manager`.

## 1. Alcance acordado

### RF-01 — Registrar y clasificar incidente

El empleado registra una novedad SST indicando:

- Tipo de peligro según GTC 45.
- Gravedad: Baja, Media o Alta.
- Título y descripción.
- Evidencia opcional, si se conserva el alcance actual.

El sistema debe:

1. Validar los datos recibidos.
2. Aplicar la matriz de priorización en backend.
3. Determinar prioridad: Alta, Media o Baja.
4. Determinar si requiere atención inmediata.
5. Persistir el resultado.
6. Retornar la clasificación al usuario.

### RF-02 — Consultar incidente clasificado

El usuario consulta un incidente mediante su identificador y obtiene:

- Datos básicos del incidente.
- Tipo de peligro.
- Gravedad.
- Prioridad asignada.
- Indicador de atención inmediata.
- Fecha de registro.

> Las guías de semanas 13–15 exigen trabajar con dos RF. La plantilla actual describe principalmente el registro; por eso se recomienda incorporar la consulta como segundo RF del mismo corte vertical.

## 2. Flujo arquitectónico objetivo

```text
Empleado
   ↓
Formulario ReportarIncidente
   ↓
POST /api/v1/incidentes
   ↓
IncidentService / EvaluadorRiesgoService
   ↓
IncidentRepository
   ↓
Supabase: tabla incidentes
   ↓
Respuesta JSON con clasificación
```

Para la consulta:

```text
Pantalla de consulta
   ↓
GET /api/v1/incidentes/{id}
   ↓
IncidentService
   ↓
IncidentRepository
   ↓
Supabase
```

La pantalla no debe consultar Supabase directamente ni calcular la prioridad. La regla debe quedar en negocio y el acceso a datos en persistencia.

## 3. Fases de desarrollo

| Fase | Actividades | Entregables |
|---|---|---|
| 0. Alineación | Confirmar RF-01 y RF-02, actores, alcance y exclusiones | Matriz de alcance actualizada |
| 1. Datos y persistencia | Revisar campos, restricciones, migración y datos de prueba | Esquema reproducible, seed y repositorio |
| 2. Reglas de negocio | Definir catálogo GTC 45, gravedad y matriz de prioridad | Servicio de evaluación y casos de prueba |
| 3. API | Diseñar contratos, validaciones, códigos HTTP y errores | Endpoints documentados |
| 4. Integración de interfaz | Conectar formulario y consulta a la API real | Flujo completo desde pantalla |
| 5. Verificación | Ejecutar pruebas funcionales, de persistencia y calidad | Evidencias y matriz RF–RNF |
| 6. Cierre | Actualizar README y preparar demostración | Entrega reproducible y guion de demo |

## 4. Plan detallado

### Fase 0 — Alcance y priorización

- Mantener como prioridad 1 el registro y clasificación.
- Definir la consulta como prioridad 2.
- Documentar explícitamente lo que queda fuera:
  - Notificaciones por SMS o correo.
  - Reevaluación manual por médico ocupacional.
  - Entrenamiento o cambio del modelo de Machine Learning.
  - Gestión completa de brigadistas.
  - Panel administrativo avanzado.
- Registrar dependencias y riesgos.
- Confirmar si la evidencia multimedia permanece dentro del flujo o se deja como funcionalidad secundaria.

**Criterio de salida:** los dos RF tienen actor, acción, resultado observable, prioridad y justificación.

La inferencia BETO se integró como una ayuda complementaria al registro: el
modelo ya entrenado sugiere el tipo de peligro y no calcula prioridad. El
entrenamiento y la evaluación independiente del modelo quedan fuera de este
corte vertical; la matriz de prioridad sigue centralizada en el backend.

### Fase 1 — Datos y persistencia

Revisar la tabla `incidentes` y asegurar, como mínimo:

- `id`
- `user_id`
- `titulo`
- `descripcion`
- `tipo_peligro`
- `gravedad`
- `prioridad_asignada`
- `requiere_atencion_inmediata`
- `estado`
- `fecha_registro` o `created_at`

Actividades:

- Definir valores permitidos para peligro y gravedad.
- Definir nulabilidad y valores por defecto.
- Crear o actualizar migraciones.
- Preparar datos iniciales conocidos.
- Encapsular lectura y escritura en `IncidentRepository`.
- Probar creación, consulta por ID y ausencia de registro.
- Verificar que la prioridad se guarde junto con el incidente.

**Criterio de salida:** la persistencia puede recrearse y probarse sin depender de datos manuales desconocidos.

### Fase 2 — Servicio y reglas de negocio

Definir una matriz explícita:

| Condición | Prioridad | Atención inmediata |
|---|---|---|
| Peligro biológico o químico | Alta | Sí |
| Gravedad alta | Alta | Sí |
| Riesgo intermedio | Media | No |
| Riesgo bajo | Baja | No |

La matriz final debe ser confirmada por el equipo, especialmente para los casos no definidos en la plantilla.

El servicio debe:

- Recibir datos validados.
- Aplicar la matriz.
- No depender de HTTP ni de la interfaz.
- No ejecutar consultas directamente.
- Solicitar al repositorio la persistencia.
- Devolver un resultado de dominio claro.
- Traducir conflictos y ausencias a errores controlados.

**Criterio de salida:** existen pruebas para combinaciones de riesgo alta, media y baja, además de entradas inválidas.

### Fase 3 — Contrato de API

#### Crear incidente

```text
POST /api/v1/incidentes
```

Entrada esperada:

```json
{
  "titulo": "Derrame en área de producción",
  "descripcion": "Se detectó una sustancia cerca de la zona de trabajo.",
  "tipo_peligro": "Quimico",
  "gravedad": "Alta"
}
```

Respuesta exitosa:

- Código `201`.
- Identificador real.
- Datos persistidos.
- Prioridad calculada.
- Indicador de atención inmediata.

Errores mínimos:

- `400`: datos inválidos.
- `401` o `403`: usuario no autorizado, si aplica.
- `500`: error interno sin exponer detalles técnicos.

#### Consultar incidente

```text
GET /api/v1/incidentes/{id}
```

Respuestas:

- `200`: incidente encontrado.
- `400`: identificador inválido.
- `404`: incidente inexistente.
- `500`: error interno controlado.

**Criterio de salida:** el contrato coincide con las solicitudes y respuestas reales.

### Fase 4 — Interfaz e integración

Actualizar el flujo del dashboard de empleado para que:

- Envíe los datos a la API.
- No inserte directamente en Supabase.
- Muestre el resultado real del backend.
- Muestre prioridad y atención inmediata.
- Preserve los campos cuando exista un rechazo.
- Diferencie validación, error de negocio y error de comunicación.
- Evite envíos simultáneos.
- No muestre éxito antes de recibir confirmación.

Agregar una acción de consulta por ID y verificarla después de recargar la pantalla.

**Criterio de salida:** el recorrido comprobable es:

```text
Interfaz → API → Servicio → Repositorio → Base de datos
```

### Fase 5 — Pruebas y evidencias

#### RF-01

1. Registro válido con peligro químico y gravedad alta.
2. Registro válido con prioridad media.
3. Registro válido con prioridad baja.
4. Campo obligatorio ausente.
5. Tipo de peligro no permitido.
6. Gravedad no permitida.
7. Confirmación de persistencia desde una nueva consulta.

#### RF-02

1. Consulta de un incidente existente.
2. Consulta de un identificador inexistente.
3. Consulta con identificador inválido.
4. Confirmación de que la consulta no modifica datos.

#### Pruebas de arquitectura

- La interfaz no contiene SQL ni acceso directo a Supabase.
- La API delega al servicio.
- La regla de prioridad no está duplicada en frontend.
- El servicio puede probarse con repositorio simulado.
- El repositorio concentra las operaciones de persistencia.

## 5. Matriz RF–RNF propuesta

| RF | RNF sugerido | Verificación |
|---|---|---|
| RF-01 | Mantenibilidad / capacidad para ser probado | Servicio probado con repositorio simulado |
| RF-01 | Adecuación funcional / corrección funcional | Prioridad calculada correctamente en todos los casos |
| RF-02 | Eficiencia de desempeño / comportamiento temporal | Medición de consultas bajo una carga acordada |
| RF-01 y RF-02 | Fiabilidad / tolerancia a fallos | Errores de API controlados sin éxito falso |

Cada RNF debe registrar:

- Condición.
- Métrica.
- Umbral.
- Resultado observado.
- Evidencia.
- Estado: cumple, no cumple o pendiente.

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| La prioridad se calcula en frontend | Centralizar la matriz en el servicio backend |
| La pantalla accede directamente a Supabase | Forzar el recorrido mediante endpoints |
| La tabla no tiene campos de clasificación | Crear migración y datos de prueba reproducibles |
| La respuesta se pierde después de crear | Informar resultado incierto y evitar reintentos automáticos |
| La matriz tiene casos ambiguos | Documentar todas las combinaciones antes de implementar |
| El contrato cambia durante la integración | Mantener una tabla única de contratos y pruebas |
| RLS impide las pruebas | Documentar usuario, políticas y configuración de entorno |

## 7. Definition of Done

El corte vertical estará terminado cuando:

- Los dos RF estén documentados y priorizados.
- Existan migraciones y datos de prueba reproducibles.
- La prioridad se calcule exclusivamente en negocio.
- La API tenga contratos de éxito y error.
- La interfaz consuma la API real.
- Se demuestre persistencia real.
- Se prueben éxito, rechazo y ausencia.
- La matriz RF–RNF tenga resultados y evidencias.
- El README permita repetir la ejecución sin credenciales reales.
- La demostración muestre pantalla, endpoint, servicio, repositorio y base de datos.

No se realizarán cambios de código en esta etapa; este documento queda como guía para la implementación posterior.
