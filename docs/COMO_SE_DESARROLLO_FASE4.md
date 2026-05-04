# Como se desarrollo la Fase 4

## Objetivo de esta fase

Construir un prototipo funcional sin autenticacion real para practicar el flujo de datos entre dos actores:

- Empleado (reporta un incidente)
- Administrador (revisa y agrega medida correctiva)

## Flujo funcional implementado

## Paso 1: Login simulado por correo

En `app/page.tsx` se implemento un formulario de ingreso con campo de correo.

- Si el correo contiene `admin`, se guarda `ADMIN` en localStorage y redirige a `app/dashboard/admin/page.tsx`.
- Si no contiene `admin`, se guarda `EMPLEADO` y redirige a `app/dashboard/empleado/page.tsx`.

Resultado pedagogico: practicas navegacion por rol sin integrar Auth todavia.

## Paso 2: Navbar con rol actual y cerrar sesion

En `components/Navbar.tsx` se creo una barra superior comun para ambos dashboards.

- Muestra rol actual.
- Muestra correo simulado.
- Permite cerrar sesion limpiando localStorage y regresando al login.

Resultado pedagogico: aprendes manejo de estado de sesion simulado y salida segura.

## Paso 3: Vista de Empleado (creacion)

En `app/dashboard/empleado/page.tsx` se implemento un formulario con:

- Titulo
- Descripcion
- Tipo de peligro GTC 45
- Input de archivo (simulado)

Al enviar:

1. Se evita el reload con `event.preventDefault()`.
2. Se ejecuta una insercion a Supabase en tabla `incidentes`.
3. El registro se guarda con estado `pendiente`.

Punto clave para aprender:

- Esta parte es **ESCRITURA (INSERT)** porque crea una fila nueva en `incidentes`.

## Paso 4: Vista de Administrador (revision)

En `app/dashboard/admin/page.tsx` se usa `useEffect` para validar rol y cargar incidentes `pendiente`.

Al seleccionar un incidente, se abre una seccion para:

- Asignar prioridad (Alta, Media, Baja)
- Escribir medida correctiva

Al guardar revision:

1. Se inserta una fila en `medidas_correctivas` con `incidente_id` y `descripcion_accion`.
2. Se actualiza el incidente original cambiando `estado` a `en_revision`.
3. Se recarga la tabla para ver solo pendientes restantes.

Punto clave para aprender:

- Primero hay **ESCRITURA (INSERT)** en `medidas_correctivas`.
- Despues hay **ACTUALIZACION (UPDATE)** sobre `incidentes`.

## Paso 5: Conexion central a Supabase

En `utils/supabase.ts` se creo una configuracion unica del cliente:

- Lee variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Exporta un cliente `supabase` reutilizable.

Resultado pedagogico: todos los componentes comparten la misma conexion sin duplicar codigo.

## Paso 6: Auditoria historica con Trigger en Supabase

Para la trazabilidad de cambios de `incidentes`, la auditoria se resuelve en la base de datos, no en la UI.

La funcion y trigger usados son:

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

Consideracion importante:

- `auth.uid()` captura el usuario autenticado en Supabase Auth.
- En este prototipo, el acceso esta simulado con localStorage, por lo que `changed_by` puede quedar en `NULL` si no hay sesion de Supabase activa.
- Para fase de implementacion real, se recomienda migrar el login a Supabase Auth para tener trazabilidad completa por usuario.

## Lo que aprendiste en esta fase

- Como modelar un flujo multi-rol con login simulado por localStorage.
- Diferencia practica entre `INSERT` y `UPDATE`.
- Como usar `useState`, `useEffect` y `useRouter` para navegacion por rol.
- Como conectar UI -> base de datos -> UI nuevamente.

## Requisitos de tabla esperados

Para que el prototipo funcione, necesitas al menos estas columnas:

### Tabla `incidentes`

- `id` (PK)
- `user_id` (nullable)
- `titulo`
- `descripcion`
- `tipo_peligro`
- `estado`
- `ubicacion`
- `fecha_suceso` (obligatoria)
- `created_at` (opcional en UI, recomendado)

### Tabla `medidas_correctivas`

- `id` (PK)
- `incidente_id` (FK a `incidentes.id`)
- `descripcion_accion`
- `responsable`
- `fecha_cumplimiento`
- `completado`
- `created_at` (opcional, recomendado)

### Tabla `audit_logs`

- `id` (PK)
- `record_id` (id del incidente afectado)
- `changed_by` (UUID del usuario)
- `action` (INSERT, UPDATE, DELETE)
- `old_data` (jsonb)
- `new_data` (jsonb)
- `created_at` (timestamp recomendado)

## Cierre

Esta fase esta pensada para entender el viaje de la data con rutas reales por rol. Cuando migres a fase con autenticacion, reemplazas localStorage por sesion real y mantienes casi toda la logica de negocio.
