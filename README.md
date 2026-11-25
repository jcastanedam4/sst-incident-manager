# SST Incident Manager

Prototipo para gestionar reportes SST con dos roles y autenticacion real con Supabase Auth:

- Empleado (reportador)
- Administrador (revisor)

Objetivo de la fase actual: operar el flujo SST con RLS, bitacora de auditoria y evidencia multimedia en Storage.

## Tecnologías

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase JavaScript Client

## Requisitos

- Node.js 20+
- Proyecto de Supabase con las tablas requeridas

## Instalación

1. Instala dependencias:

```bash
npm install
```

1. Configura variables de entorno en .env.local:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_llave_anonima
```

Para ejecutar las pruebas de persistencia real, configura localmente (sin subir
el archivo) `TEST_SUPABASE_URL` y `TEST_SUPABASE_SERVICE_ROLE_KEY`.

1. Inicia el servidor de desarrollo:

```bash
npm run dev
```

1. Abre la app en [http://localhost:3000](http://localhost:3000)

## Scripts

- npm run dev: desarrollo
- npm run build: build de producción
- npm run start: ejecutar build
- npm run lint: validación con ESLint
- npm test: pruebas unitarias, de API y arquitectura
- npm run medir:consulta: medición de consultas de RF-02 con un JWT
- npx vitest run tests/integration/incidentRepository.integration.test.ts: pruebas reales de persistencia

## Corte vertical SST (RF-01 y RF-02)

Recorrido: Interfaz -> `POST/GET/PATCH /api/v1/incidentes` -> `IncidentService` -> `IncidentRepository` -> Supabase.

- RF-01 (prioridad 1): registrar y clasificar un incidente (tipo de peligro GTC 45 + gravedad). La prioridad y la atencion inmediata se calculan SOLO en `lib/incidentes/evaluadorRiesgo.ts`.
- RF-02 (prioridad 2): consultar un incidente clasificado por su identificador.
- La clasificación de tipo de peligro se sugiere automáticamente con BETO
  ejecutado como servicio FastAPI local; el empleado no edita el valor y admin
  puede corregirlo. La guía está en
  [docs/API_CLASIFICACION_RIESGO_IA.md](docs/API_CLASIFICACION_RIESGO_IA.md).
- La interfaz diferencia errores de validación, negocio y comunicación, conserva
  los datos rechazados y evita envíos o consultas simultáneas.
- Fuera del alcance de RF-01/RF-02: notificaciones SMS/correo, reevaluacion por medico ocupacional y gestion de brigadistas.

### Estructura
- `lib/incidentes/`: validacion, matriz de riesgo, servicio, contrato y repositorio Supabase.
- `app/api/v1/incidentes/`: endpoints.
- `ml_api/`: servicio privado FastAPI de inferencia BETO; los pesos se guardan localmente y no se suben a Git.
- `components/ReportarIncidente.tsx`, `ConsultaIncidente.tsx`: interfaz (sin SQL ni reglas).
- `db/migrations/`, `db/seed/`: esquema y datos reproducibles.

### Reproducir la verificacion (sin credenciales reales)
1. `cp .env.example .env.local` y completar con un proyecto Supabase de PRUEBA. Node 20+.
2. En el SQL Editor ejecutar en orden: `docs/SUPABASE_BASELINE.sql`, `db/migrations/001_corte_vertical_incidentes.sql`, `db/migrations/002_historial_incidentes_usuario.sql`, `db/migrations/003_clasificacion_pendiente.sql` y `db/seed/002_seed_corte_vertical.sql`.
3. `npm install` y `npm test` (pruebas unitarias, API, interfaz y arquitectura; no requieren base).
4. Para ejecutar la integración real, exporta las variables de `.env.local` al proceso PowerShell y corre los tests. Vitest omite esta suite de forma intencional si no se exportan:

   ```powershell
   Get-Content .env.local | ForEach-Object {
     if ($_ -match '^\s*(TEST_SUPABASE_URL|TEST_SUPABASE_SERVICE_ROLE_KEY)\s*=\s*(.*)\s*$') {
       $name = $Matches[1]
       $value = $Matches[2].Trim().Trim('"').Trim("'")
       Set-Item -Path ("Env:" + $name) -Value $value
     }
   }
   npx vitest run tests/integration/incidentRepository.integration.test.ts
   Remove-Item Env:\TEST_SUPABASE_URL, Env:\TEST_SUPABASE_SERVICE_ROLE_KEY
   ```

   No imprimas ni compartas la clave `service_role`.
5. Estado inicial conocido: 5 incidentes con ids `00000000-0000-4000-8000-00000000000{1..5}`. Para reiniciar: `db/seed/999_reset_corte_vertical.sql` y luego el seed.
6. Rendimiento de RF-02 con `npm run dev` activo. En PowerShell, configura un JWT de sesión y un ID existente solo en variables temporales:

   ```powershell
   $env:ACCESS_TOKEN = "<JWT de sesión>"
   $env:INCIDENT_ID = "<UUID existente>"
   npm run medir:consulta | Tee-Object -FilePath docs\medicion-consulta.txt
   Remove-Item Env:\ACCESS_TOKEN, Env:\INCIDENT_ID
   ```

   El script realiza 20 consultas, verifica HTTP 200 y el ID solicitado, y reporta máximo, mediana y promedio.
   Solo informa cumplimiento si el máximo no supera 1000 ms; la salida no incluye el token.
   Para adjuntar evidencia, registra fecha y ambiente junto a la salida, nunca el JWT.

### Ejecutar el clasificador local

La app requiere que el servicio local esté activo para obtener predicciones.
Desde la raíz del repositorio, prepara el entorno una sola vez:

```powershell
py -m venv .venv-ml
.\.venv-ml\Scripts\Activate.ps1
python -m pip install -r ml_api\requirements.txt
```

Coloca los artefactos del modelo y tokenizer en `ml_api/models/` como explica
[la guía de clasificación IA](docs/API_CLASIFICACION_RIESGO_IA.md). En una
terminal mantén el servicio ejecutándose:

```powershell
python -m uvicorn ml_api.main:app --host 127.0.0.1 --port 8000
```

Verifica `http://127.0.0.1:8000/health` y en otra terminal ejecuta `npm run dev`.
Si el servicio está apagado, la interfaz permite registrar el incidente como
`Sin clasificar` para que admin lo revise.

La integración real se verificó previamente con cinco pruebas de repositorio:
creación y consulta, ausencia de registro, lectura del seed y restricciones de
integridad. Sin `TEST_SUPABASE_SERVICE_ROLE_KEY`, Vitest omite esas cinco pruebas.

Contratos de API implementados: ver `docs/API_ENDPOINTS.md`.

## Flujo funcional implementado

## 1) Login con Supabase Auth (ruta /)

- Formulario con correo electronico y contrasena.
- Autenticacion con email/password usando Supabase Auth.
- Opcion de registro para crear cuentas de empleado con metadata role=EMPLEADO.
- Para cuentas de administrador debes configurar metadata role=ADMIN en Supabase.
- Si las credenciales son validas, la app redirige segun rol autenticado.
- Si fallan, se muestra alerta de credenciales incorrectas.

## 2) Vista Empleado (ruta /dashboard/empleado)

- Interfaz limpia para reportar incidentes.
- Campos: Titulo, Descripcion, Tipo de Peligro (GTC 45), Gravedad y evidencia multimedia.
- El formulario consume `POST /api/v1/incidentes`; no escribe directamente en Supabase.
- El backend valida los datos, calcula la prioridad y la atencion inmediata, y devuelve la clasificacion persistida.
- La consulta muestra los cinco reportes más recientes del empleado autenticado; se puede seleccionar uno para ver su clasificación sin ingresar el UUID.
- La pantalla conserva el último ID confirmado en el almacenamiento de sesión; después de recargar,
  permite consultar de nuevo ese mismo incidente mediante `GET /api/v1/incidentes/{id}`.
- Los errores de validación, autorización, ausencia y comunicación se muestran en pantalla sin
  limpiar los datos rechazados ni reintentar automáticamente un envío incierto.

## 3) Vista Administrador (ruta /dashboard/admin)

- Interfaz diferenciada con barra lateral azul.
- Indicadores con totales por estado, distribucion de prioridad (incluye incidentes sin clasificar) y conteo de atencion inmediata.
- La distribucion por tipo de peligro muestra cantidad y porcentaje sobre el total.
- Lista de incidentes por estado (Abierto, En Proceso, Cerrado).
- Cada reporte muestra gravedad, prioridad asignada por el sistema y si requiere atención inmediata.
- La lista se ordena por prioridad (Alta, Media, Baja y Sin clasificar), con atencion inmediata primero dentro de cada nivel, y se puede filtrar por estado y prioridad.
- Al cambiar de pagina, la vista se desplaza suavemente al inicio de la lista.
- Al seleccionar un incidente:
- Muestra la prioridad calculada por el sistema; la prioridad de la medida correctiva se selecciona aparte.
- Permite escribir medida correctiva.
- Al guardar:
- INSERT en medidas_correctivas.
- UPDATE del incidente a estado en_revision.

## 4) Navbar y cierre de sesion

- Navbar compartida en ambos dashboards.
- Muestra rol actual y correo simulado.
- Boton Cerrar sesion: ejecuta supabase.auth.signOut() y regresa al login.

## Verificación del corte vertical

La suite automatizada cubre reglas de riesgo, validaciones, servicio, API,
arquitectura, resultados visibles del flujo de reporte/consulta, filtros de
prioridad, indicadores del panel administrador, interfaz de exportación y
persistencia real. La última ejecución de `npm test` fue:

- 95 pruebas aprobadas y 5 pruebas de integración Supabase omitidas porque
  requieren variables de entorno de integración.
- En una ejecución anterior con credenciales configuradas, las 5 pruebas de
  integración Supabase aprobaron.
- `npm run build` aprobado con la configuración de Supabase.
- El lint de los archivos del corte vertical pasa; el lint global aún reporta
  incidencias heredadas fuera de este flujo.
- La medición real de latencia debe adjuntarse desde un entorno autenticado;
  no se debe registrar ni compartir el JWT.

## Estructura principal

```text
app/
  page.tsx
  dashboard/
    admin/page.tsx
    empleado/page.tsx
  layout.tsx
  globals.css
components/
  Navbar.tsx
  FormularioIncidente.tsx
  ListaRevision.tsx
  SimuladorRoles.tsx
utils/
  supabase.ts
docs/
  ORGANIZACION_PROYECTO.md
  COMO_SE_DESARROLLO_FASE4.md
  LOGIN_SIMULADO_Y_PROTECCION_RUTAS.md
```

## Tablas esperadas en Supabase

### Tabla incidentes

- id (PK)
- user_id (FK opcional a `auth.users`)
- titulo
- descripcion
- tipo_peligro: categoría GTC 45 o `Sin clasificar`
- gravedad: Baja | Media | Alta
- prioridad_asignada: Baja | Media | Alta | null si queda pendiente de clasificación
- requiere_atencion_inmediata: boolean | null si queda pendiente de clasificación
- estado
- ubicacion
- fecha_suceso (obligatoria)
- created_at (fecha de registro)

El esquema reproducible se aplica en este orden:

1. `docs/SUPABASE_BASELINE.sql`
2. `db/migrations/001_corte_vertical_incidentes.sql`
3. `db/migrations/002_historial_incidentes_usuario.sql`
4. `db/migrations/003_clasificacion_pendiente.sql`
5. `db/seed/002_seed_corte_vertical.sql`

Las migraciones agregan restricciones para los catalogos, mantienen la prioridad
calculada junto con el incidente y permiten dejar temporalmente pendiente un
reporte sin tipo sugerido. El seed crea cinco registros con identificadores
conocidos; para reiniciarlos se usa `db/seed/999_reset_corte_vertical.sql`.

### Tabla medidas_correctivas

- id (PK)
- incidente_id (FK a incidentes.id)
- descripcion_accion
- responsable
- fecha_cumplimiento
- completado
- created_at (recomendado)

### Tabla audit_logs

- id (PK)
- record_id (FK logica al incidente afectado)
- changed_by (UUID del usuario autenticado en Supabase)
- action (INSERT | UPDATE | DELETE)
- old_data (jsonb)
- new_data (jsonb)
- created_at (timestamp recomendado)

## Auditoria en Supabase (trigger)

La auditoria historica de cambios en `incidentes` se maneja en base de datos mediante trigger.

```sql
CREATE OR REPLACE FUNCTION fn_audit_incidente_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (record_id, changed_by, action, old_data, new_data)
    VALUES (
      OLD.id,
      auth.uid(),
      'UPDATE',
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    RETURN NEW;

  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_logs (record_id, changed_by, action, old_data, new_data)
    VALUES (
      OLD.id,
      auth.uid(),
      'DELETE',
      to_jsonb(OLD),
      NULL
    );
    RETURN OLD;

  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (record_id, changed_by, action, old_data, new_data)
    VALUES (
      NEW.id,
      auth.uid(),
      'INSERT',
      NULL,
      to_jsonb(NEW)
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_incidentes
AFTER INSERT OR UPDATE OR DELETE ON incidentes
FOR EACH ROW EXECUTE FUNCTION fn_audit_incidente_changes();
```

Nota tecnica:

- Con autenticacion real, auth.uid() se propaga al trigger y la tabla audit_logs registra el usuario que ejecuta la operacion.
- Configura RLS con base en role del usuario (ADMIN o EMPLEADO) para mantener el control de acceso.

## Carga de datos de prueba (25 incidentes)

Para poblar el sistema con 25 incidentes y evidencias en el bucket evidencias-incidentes:

```bash
npm run seed:incidentes
```

Variables requeridas:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

## Archivos clave del flujo

- [app/page.tsx](app/page.tsx)
- [app/dashboard/empleado/page.tsx](app/dashboard/empleado/page.tsx)
- [app/dashboard/admin/page.tsx](app/dashboard/admin/page.tsx)
- [components/Navbar.tsx](components/Navbar.tsx)
- [utils/supabase.ts](utils/supabase.ts)
- [docs/COMO_SE_DESARROLLO_FASE4.md](docs/COMO_SE_DESARROLLO_FASE4.md)

## Formatos de evidencia soportados

La aplicación acepta y almacena evidencias multimedia en el bucket de Storage. Formatos soportados por el flujo actual:

- Imágenes: `image/jpeg`, `image/png`.
- `image/webp` — se convierte a JPEG en el cliente antes de subir.
- Documentos: `application/pdf`.
- Ofimática: `.doc`, `.docx`, `.xls`, `.xlsx` (se suben con su content-type correspondiente si el navegador lo provee).

Notas:

- Siempre se intenta inferir y pasar `contentType` explícito al subir a Storage.
- Si el navegador reporta `application/octet-stream` o un tipo no soportado, el cliente intenta normalizar el archivo o rechaza la subida mostrando un mensaje claro al usuario.
- Actualiza las políticas del bucket y RLS en Supabase si añades más formatos.

## Documentación de apoyo

- Organización del proyecto: [docs/ORGANIZACION_PROYECTO.md](docs/ORGANIZACION_PROYECTO.md)
- Explicación paso a paso de la fase: [docs/COMO_SE_DESARROLLO_FASE4.md](docs/COMO_SE_DESARROLLO_FASE4.md)
- Guia de login y proteccion de rutas: [docs/LOGIN_SIMULADO_Y_PROTECCION_RUTAS.md](docs/LOGIN_SIMULADO_Y_PROTECCION_RUTAS.md)
- Flujo funcional completo (reporte, gestion, auditoria, exportacion): [docs/FLUJO_REPORTE_Y_GESTION_SST.md](docs/FLUJO_REPORTE_Y_GESTION_SST.md)


## Test

- npm install -> Descarga las librerías 


- mkdir evidencias -> Crea una carpeta llamada evidencias para guardar los resultados


- npm test | Tee-Object evidencias\npm-test.txt -> Corre todas las pruebas automáticas del proyecto


- npx vitest run tests/lib/incidentService.test.ts ->Comprueba que se puede registrar un incidente, que un dato inválido se rechaza sin guardar nada, que se encuentra uno existente y que uno inexistente da error controlado. 


- npx vitest run tests/lib/evaluadorRiesgo.test.ts -> Prueba la matriz de prioridad. Cubre las 21 combinaciones de peligro y gravedad.


- npx vitest run tests/api -> Prueba los dos endpoints, con el servicio simulado. Comprueba las respuestas: 201 al crear, 400 por datos inválidos, 401 sin sesión, 404 si el incidente no existe y 500 sin mostrar detalles técnicos.


- npx vitest run tests/architecture -> Revisa la estructura del código, no su funcionamiento. Verifica que la pantalla no tenga SQL ni repita la regla de prioridad, que los endpoints deleguen al servicio y que solo el repositorio toque la tabla. Es la evidencia de que cada capa hace solo lo suyo.
