# Login simulado y proteccion de rutas

Este documento resume el login simulado vigente en la aplicacion.

## Nota de actualizacion

- Cuenta invitado de empleado: `invitado@sst.com` / `Invitado123`.
- Cuenta de administrador (Encargado SST): `encargado.sst@empresa.com` / `E1234`.
- Se habilito registro local de empleados desde la pantalla de login.

## 1) Referencia del flujo de ingreso actual

```tsx
const USUARIOS_QUEMADOS = [
  {
    email: "invitado@sst.com",
    password: "Invitado123",
    rol: "EMPLEADO" as const,
    redirectTo: "/dashboard/empleado",
  },
  {
    email: "encargado.sst@empresa.com",
    password: "E1234",
    rol: "ADMIN" as const,
    redirectTo: "/dashboard/admin",
  },
];

// Ademas del login por cuentas predefinidas, se permite registro local
// de empleados en localStorage con la llave sst_registered_users.
```

## 2) Ejemplo de proteccion de ruta en dashboard

Ejemplo para app/dashboard/admin/page.tsx:

```tsx
useEffect(() => {
  if (!usuario) {
    router.push("/");
    return;
  }

  if (usuario.rol !== "ADMIN") {
    router.push("/");
    return;
  }

  const timeoutId = setTimeout(() => {
    void cargarIncidentes();
  }, 0);

  return () => clearTimeout(timeoutId);
}, [router, usuario]);
```

## 3) Que mas hay en este documento

- El bloque 1 muestra una referencia resumida de la logica de login vigente.
- El bloque 2 muestra un ejemplo minimo para proteger una ruta.
- El bloque 4 explica la llave de localStorage que usa la sesion simulada.
- No incluye logica de incidentes porque ese flujo vive en los dashboards y es donde se conecta Supabase para crear y listar datos.
- Si no ves datos en pantalla, normalmente significa que aun no has enviado un incidente desde el formulario o que la tabla esta vacia.

## 4) Llave usada en localStorage

- `sst_user`: objeto JSON con email y rol.
- `sst_registered_users`: listado local de cuentas de empleado registradas desde el login.
