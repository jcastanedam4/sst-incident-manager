# Organizacion del proyecto SST Incident Manager

## 1) Estructura actual recomendada

```text
app/
  layout.tsx                 # Layout raiz
  page.tsx                   # Login simulado por correo
  dashboard/
    admin/page.tsx           # Interfaz del Responsable SST
    empleado/page.tsx        # Interfaz del Trabajador
  globals.css                # Estilos globales (Tailwind v4)
components/
  Navbar.tsx                 # Muestra rol actual y boton cerrar sesion
  FormularioIncidente.tsx    # Componente de fase anterior (opcional)
  ListaRevision.tsx          # Componente de fase anterior (opcional)
  SimuladorRoles.tsx         # Componente de fase anterior (opcional)
utils/
  supabase.ts                # Cliente de Supabase
types/                       # Reservado para tipados compartidos
public/                      # Archivos estaticos
docs/
  ORGANIZACION_PROYECTO.md   # Este documento
  COMO_SE_DESARROLLO_FASE4.md# Explicacion pedagogica
  FLUJO_REPORTE_Y_GESTION_SST.md # Flujo funcional operativo
```

## 2) Revision de organizacion

- Bien separado por responsabilidad: login en `app/page.tsx`, paneles por rol en `app/dashboard/*`, conexion de datos en `utils/supabase.ts`.
- Escalable para la siguiente fase con Auth: solo reemplazas la simulacion en localStorage por sesion real.
- El folder `types/` esta listo para centralizar interfaces cuando crezca el proyecto.

## 3) Recomendaciones de siguiente paso

- Crear `types/incidente.ts` y `types/medidaCorrectiva.ts` para evitar duplicar tipos.
- Agregar `services/incidentes.ts` si quieres separar llamadas a Supabase de los componentes.
- Agregar validaciones con Zod para formularios en una fase posterior.
- Registrar prioridad en una columna dedicada (`prioridad`) si quieres filtrar y reportar por criticidad.
- Usar middleware o layout de dashboard para proteger rutas cuando pases a autenticacion real.
