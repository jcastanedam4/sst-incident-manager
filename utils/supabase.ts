import { createClient } from "@supabase/supabase-js";
import type { RolUsuario, UsuarioApp } from "@/types/incidentes";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    `Missing Supabase credentials: NEXT_PUBLIC_SUPABASE_URL=${!!supabaseUrl}, NEXT_PUBLIC_SUPABASE_ANON_KEY=${!!supabaseAnonKey}. Check your .env.local`
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const esRolValido = (valor: unknown): valor is RolUsuario => {
  return valor === "ADMIN" || valor === "EMPLEADO";
};

const normalizarRol = (role: unknown): RolUsuario => {
  if (typeof role !== "string") {
    return "EMPLEADO";
  }

  const rolMayuscula = role.trim().toUpperCase();
  return esRolValido(rolMayuscula) ? rolMayuscula : "EMPLEADO";
};

export const mapearUsuarioAuth = (
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
    app_metadata?: Record<string, unknown>;
  } | null
): UsuarioApp | null => {
  if (!user || !user.email) {
    return null;
  }

  const roleEnUserMetadata = user.user_metadata?.role;
  const roleEnAppMetadata = user.app_metadata?.role;

  return {
    id: user.id,
    email: user.email,
    rol: normalizarRol(roleEnUserMetadata ?? roleEnAppMetadata),
  };
};

export const obtenerUsuarioSesion = async (): Promise<UsuarioApp | null> => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return mapearUsuarioAuth(user);
};
