export const ESTADOS_INCIDENTE = ["Abierto", "En Proceso", "Cerrado"] as const;

export type EstadoIncidente = (typeof ESTADOS_INCIDENTE)[number];

export type UsuarioSimulado = {
  email: string;
  rol: "EMPLEADO" | "ADMIN";
};

export type Incidente = {
  id: string;
  titulo: string;
  descripcion: string;
  tipo_peligro: string;
  estado: string;
  created_at?: string | null;
  fecha_suceso?: string | null;
  user_email?: string | null;
  evidencia_url?: string | null;
  evidencias?: Evidencia[] | null;
};

export type Evidencia = {
  id?: string;
  incidente_id?: string;
  url_storage: string;
  tipo_archivo?: string | null;
  created_at?: string;
};

export type AuditLog = {
  id: string;
  record_id: string;
  changed_by: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
};

export const TIPOS_GTC45 = [
  "Fisico",
  "Quimico",
  "Biologico",
  "Biomecanico",
  "Psicosocial",
  "Seguridad",
  "Fenomeno natural",
] as const;

export const obtenerEstadosPersistencia = (estado: EstadoIncidente): string[] => {
  return [estado];
};

export const normalizarEstado = (estado: string): EstadoIncidente => {
  const limpio = estado.trim().toLowerCase();

  if (limpio === "abierto" || limpio === "pendiente") {
    return "Abierto";
  }

  if (limpio === "en proceso" || limpio === "en_revision" || limpio === "en revisión") {
    return "En Proceso";
  }

  return "Cerrado";
};
