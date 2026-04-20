# SST Incident Manager

Prototipo educativo para gestionar reportes SST con dos roles simulados y entrada por login:

- Empleado (reportador)
- Administrador (revisor)

Objetivo de la fase actual: aprender el flujo de datos entre tablas en Supabase sin implementar autenticacion real todavia.

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

## Flujo funcional implementado

## 1) Login simulado (ruta /)

- Formulario con correo electronico y contrasena.
- Cuenta invitado de empleado: invitado(at)sst.com / Invitado123.
- Cuenta de administrador (Encargado SST): encargado.sst(at)empresa.com / E1234.
- Opcion de registro local para crear nuevas cuentas de empleado desde la pantalla de login.
- Si las credenciales son validas, se guarda el objeto de usuario en localStorage bajo la llave sst_user y redirige segun rol.
- Si fallan, se muestra alerta de credenciales incorrectas.

## 2) Vista Empleado (ruta /dashboard/empleado)

- Interfaz limpia para reportar incidentes.
- Campos: Titulo, Descripcion, Tipo de Peligro (GTC 45), y evidencia multimedia.
- Al enviar se hace INSERT en incidentes con estado Abierto (si el enum/columna en Supabase lo permite).

## 3) Vista Administrador (ruta /dashboard/admin)

- Interfaz diferenciada con barra lateral azul.
- Lista de incidentes por estado (Abierto, En Proceso, Cerrado).
- Al seleccionar un incidente:
- Permite asignar prioridad (Alta, Media, Baja).
- Permite escribir medida correctiva.
- Al guardar:
- INSERT en medidas_correctivas.
- UPDATE del incidente a estado en_revision.

## 4) Navbar y cierre de sesion

- Navbar compartida en ambos dashboards.
- Muestra rol actual y correo simulado.
- Boton Cerrar sesion: limpia localStorage y regresa al login.

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
- user_id (nullable)
- titulo
- descripcion
- tipo_peligro
- estado
- ubicacion
- fecha_suceso (obligatoria)
- created_at (recomendado)

Nota: en este prototipo no hay datos semilla de incidentes cargados en el repositorio. Los registros aparecen cuando el trabajador envia un reporte desde la interfaz y se guardan en Supabase.

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

- En el prototipo actual, el login de la app es simulado con localStorage y no con Supabase Auth.
- Por lo anterior, `auth.uid()` puede quedar `NULL` si la operacion no se ejecuta con una sesion autenticada de Supabase.
- Si quieres trazabilidad de usuario final en esta fase, puedes guardar adicionalmente `usuario_email` en `incidentes` y/o pasar el usuario en metadatos de la operacion.

## Archivos clave del flujo

- [app/page.tsx](app/page.tsx)
- [app/dashboard/empleado/page.tsx](app/dashboard/empleado/page.tsx)
- [app/dashboard/admin/page.tsx](app/dashboard/admin/page.tsx)
- [components/Navbar.tsx](components/Navbar.tsx)
- [utils/supabase.ts](utils/supabase.ts)
- [docs/COMO_SE_DESARROLLO_FASE4.md](docs/COMO_SE_DESARROLLO_FASE4.md)

## Documentación de apoyo

- Organización del proyecto: [docs/ORGANIZACION_PROYECTO.md](docs/ORGANIZACION_PROYECTO.md)
- Explicación paso a paso de la fase: [docs/COMO_SE_DESARROLLO_FASE4.md](docs/COMO_SE_DESARROLLO_FASE4.md)
- Guia de login y proteccion de rutas: [docs/LOGIN_SIMULADO_Y_PROTECCION_RUTAS.md](docs/LOGIN_SIMULADO_Y_PROTECCION_RUTAS.md)
- Flujo funcional completo (reporte, gestion, auditoria, exportacion): [docs/FLUJO_REPORTE_Y_GESTION_SST.md](docs/FLUJO_REPORTE_Y_GESTION_SST.md)
