import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ErrorNoAutorizado, ErrorSinPermiso } from "./errores";
import { IncidentService } from "./incidentService";
import type { UsuarioAutenticado } from "./modelo";
import { SupabaseIncidentRepository } from "./supabaseIncidentRepository";

export type ContextoSolicitud = {
  usuario: UsuarioAutenticado;
  cliente: SupabaseClient;
  rol?: "ADMIN" | "EMPLEADO";
};

const CORREO_ADMINISTRADOR = "encargado.sst@empresa.com";

const extraerToken = (request: Request): string | null => {
  const encabezado = request.headers.get("authorization") ?? "";
  const [esquema, token] = encabezado.split(" ");
  return esquema?.toLowerCase() === "bearer" && token ? token : null;
};

/**
 * Verifica el JWT de Supabase y crea un cliente que actúa en nombre del usuario,
 * de modo que las políticas RLS siguen aplicando. No usa la service role.
 */
export async function autenticar(request: Request): Promise<ContextoSolicitud> {
  const token = extraerToken(request);
  if (!token) {
    throw new ErrorNoAutorizado();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Configuración de Supabase incompleta.");
  }

  const cliente = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await cliente.auth.getUser(token);
  if (error || !data.user || !data.user.email) {
    throw new ErrorNoAutorizado();
  }

  const rolApp = data.user.app_metadata?.role;
  const esAdministrador =
    (typeof rolApp === "string" && rolApp.trim().toUpperCase() === "ADMIN") ||
    data.user.email.trim().toLowerCase() === CORREO_ADMINISTRADOR;

  return {
    usuario: { id: data.user.id, email: data.user.email },
    cliente,
    rol: esAdministrador ? "ADMIN" : "EMPLEADO",
  };
}

export async function autenticarAdministrador(request: Request): Promise<ContextoSolicitud> {
  const contexto = await autenticar(request);
  if (contexto.rol !== "ADMIN") {
    throw new ErrorSinPermiso();
  }
  return contexto;
}

/** Punto único de composición: servicio + repositorio real. */
export function crearIncidentService(cliente: SupabaseClient): IncidentService {
  return new IncidentService(new SupabaseIncidentRepository(cliente));
}
