import { supabase } from "@/utils/supabase";
import type { Gravedad, TipoPeligro, TipoPeligroRegistrado } from "@/types/incidentes";

/** Respuesta de la API (contrato de RF-01 y RF-02). */
export type IncidenteClasificadoApi = {
  id: string;
  titulo: string;
  descripcion: string;
  tipo_peligro: TipoPeligroRegistrado;
  gravedad: Gravedad;
  prioridad_asignada: "Alta" | "Media" | "Baja" | null;
  requiere_atencion_inmediata: boolean | null;
  estado: string;
  fecha_registro: string;
};

export type NuevoIncidenteApi = {
  titulo: string;
  descripcion: string;
  tipo_peligro: TipoPeligroRegistrado;
  gravedad: Gravedad;
};

export type SugerenciaTipoRiesgoApi = {
  tipo_peligro: TipoPeligro;
};

export type ActualizarClasificacionApi = {
  tipo_peligro: TipoPeligroRegistrado;
  gravedad: Gravedad;
};

/**
 * Tres clases de fallo que la interfaz debe distinguir:
 * - validacion: datos rechazados (400), se muestran por campo.
 * - negocio: la API respondió pero no se pudo completar (401, 404, 500 controlado).
 * - comunicacion: no se obtuvo respuesta utilizable (red caída, respuesta no JSON).
 */
export type ResultadoApi<T> =
  | { ok: true; data: T }
  | { ok: false; tipo: "validacion"; mensaje: string; detalles: { campo: string; mensaje: string }[] }
  | { ok: false; tipo: "negocio"; mensaje: string; status: number }
  | { ok: false; tipo: "comunicacion"; mensaje: string };

type CuerpoApi = {
  data?: unknown;
  error?: { codigo?: string; mensaje?: string; detalles?: { campo: string; mensaje: string }[] };
} | null;

const obtenerToken = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
};

const llamarApi = async <T>(ruta: string, opciones: RequestInit, mensajeRed: string): Promise<ResultadoApi<T>> => {
  let token: string | null;
  try {
    token = await obtenerToken();
  } catch {
    return { ok: false, tipo: "comunicacion", mensaje: mensajeRed };
  }

  if (!token) {
    return { ok: false, tipo: "negocio", mensaje: "Tu sesión expiró. Inicia sesión nuevamente.", status: 401 };
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(ruta, {
      ...opciones,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
  } catch {
    return { ok: false, tipo: "comunicacion", mensaje: mensajeRed };
  }

  let cuerpo: CuerpoApi;
  try {
    cuerpo = (await respuesta.json()) as CuerpoApi;
  } catch {
    return {
      ok: false,
      tipo: "comunicacion",
      mensaje: "El servidor devolvió una respuesta inesperada. No se pudo confirmar la operación.",
    };
  }

  if (respuesta.ok && cuerpo?.data) {
    return { ok: true, data: cuerpo.data as T };
  }

  const error = cuerpo?.error;
  if (respuesta.status === 400 && error?.codigo === "VALIDACION") {
    return { ok: false, tipo: "validacion", mensaje: error.mensaje ?? "Datos inválidos.", detalles: error.detalles ?? [] };
  }

  return {
    ok: false,
    tipo: "negocio",
    mensaje: error?.mensaje ?? "No se pudo completar la operación.",
    status: respuesta.status,
  };
};

/** RF-01. Un fallo de red es incierto: el incidente pudo haberse creado; no se reintenta automáticamente. */
export const crearIncidente = (datos: NuevoIncidenteApi) =>
  llamarApi<IncidenteClasificadoApi>(
    "/api/v1/incidentes",
    { method: "POST", body: JSON.stringify(datos) },
    "No se pudo confirmar el envío por un problema de conexión. Antes de reintentar, verifica si el reporte ya fue registrado."
  );

/** RF-02. Solo lectura. */
export const consultarIncidente = (id: string) =>
  llamarApi<IncidenteClasificadoApi>(
    `/api/v1/incidentes/${encodeURIComponent(id.trim())}`,
    { method: "GET" },
    "No se pudo consultar el incidente por un problema de conexión. Intenta de nuevo."
  );

/** Admin: actualiza tipo/gravedad; el servidor calcula prioridad y atención inmediata. */
export const actualizarClasificacionIncidente = (id: string, datos: ActualizarClasificacionApi) =>
  llamarApi<IncidenteClasificadoApi>(
    `/api/v1/incidentes/${encodeURIComponent(id.trim())}`,
    { method: "PATCH", body: JSON.stringify(datos) },
    "No se pudo actualizar la clasificación por un problema de conexión. Intenta de nuevo."
  );

/** Historial reciente del usuario autenticado; el servidor determina el propietario. */
export const listarMisIncidentes = () =>
  llamarApi<IncidenteClasificadoApi[]>(
    "/api/v1/incidentes/mis-reportes",
    { method: "GET" },
    "No se pudieron cargar tus últimos reportes. Intenta de nuevo."
  );

/** Solicita una sugerencia local; empleado la aplica y admin puede modificarla. */
export const sugerirTipoRiesgo = (descripcion: string, signal?: AbortSignal) =>
  llamarApi<SugerenciaTipoRiesgoApi>(
    "/api/v1/sugerir-tipo-riesgo",
    { method: "POST", body: JSON.stringify({ descripcion }), signal },
    "No se pudo obtener una sugerencia. Intenta de nuevo o reporta el incidente como Sin clasificar."
  );
