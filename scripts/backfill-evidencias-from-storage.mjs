import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRole) {
  console.error("Faltan variables NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
const bucket = "evidencias-incidentes";

const extraerMimePorExtension = (path) => {
  const lower = path.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
};

const toPublicUrl = (path) => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

const extraerIncidenteIdDesdePath = (path) => {
  // Formato esperado: incidentes/<incidente_id>/<archivo>
  const partes = path.split("/");
  if (partes.length < 3) return null;
  return partes[1] || null;
};

async function main() {
  let offset = 0;
  const limit = 100;
  let totalInsertados = 0;
  let totalSaltados = 0;

  while (true) {
    const { data: objetos, error } = await supabase.storage.from(bucket).list("incidentes", {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) {
      console.error("Error listando storage:", error.message);
      process.exit(1);
    }

    if (!objetos || objetos.length === 0) break;

    for (const obj of objetos) {
      // list("incidentes") devuelve hijos; puede incluir carpetas
      if (!obj.name) continue;

      // Si es carpeta, listar su contenido
      const carpetaPath = `incidentes/${obj.name}`;
      const { data: inner, error: innerErr } = await supabase.storage.from(bucket).list(carpetaPath, {
        limit: 500,
        offset: 0,
      });

      if (innerErr) {
        console.warn("No se pudo listar carpeta", carpetaPath, innerErr.message);
        continue;
      }

      for (const file of inner || []) {
        if (!file.name) continue;
        const fullPath = `${carpetaPath}/${file.name}`;
        const incidenteId = extraerIncidenteIdDesdePath(fullPath);
        if (!incidenteId) {
          totalSaltados += 1;
          continue;
        }

        const url = toPublicUrl(fullPath);

        const { data: existente, error: exErr } = await supabase
          .from("evidencias")
          .select("id")
          .eq("url_storage", url)
          .limit(1)
          .maybeSingle();

        if (exErr) {
          console.warn("Error verificando evidencia existente:", exErr.message);
          totalSaltados += 1;
          continue;
        }

        if (existente?.id) {
          totalSaltados += 1;
          continue;
        }

        const { error: insErr } = await supabase.from("evidencias").insert({
          incidente_id: incidenteId,
          url_storage: url,
          tipo_archivo: extraerMimePorExtension(fullPath),
        });

        if (insErr) {
          console.warn("Error insertando evidencia para", fullPath, insErr.message);
          totalSaltados += 1;
          continue;
        }

        totalInsertados += 1;
      }
    }

    offset += limit;
  }

  console.log("Backfill completado");
  console.log("Insertados:", totalInsertados);
  console.log("Saltados:", totalSaltados);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
