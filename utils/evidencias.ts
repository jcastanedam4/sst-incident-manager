import { supabase } from "@/utils/supabase";

/**
 * Evidencia multimedia (funcionalidad secundaria del corte vertical).
 * Se sube DESPUÉS de que la API confirmó el incidente y confirmó su id real.
 */

const TIPOS_POR_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  md: "text/markdown",
};

const obtenerContentType = (archivo: File): string => {
  if (archivo.type && archivo.type !== "application/octet-stream") {
    return archivo.type;
  }

  const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "";
  return TIPOS_POR_EXTENSION[extension] ?? "application/octet-stream";
};

const convertirWebpAJpeg = async (archivo: File): Promise<File> => {
  const bitmap = await createImageBitmap(archivo);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return archivo;

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) return archivo;

  return new File([blob], `${archivo.name.replace(/\.[^.]+$/, "")}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
};

const normalizarArchivo = async (archivo: File): Promise<File> => {
  if (archivo.type === "image/webp") {
    try {
      return await convertirWebpAJpeg(archivo);
    } catch {
      return archivo;
    }
  }

  const contentType = obtenerContentType(archivo);
  if (contentType !== archivo.type) {
    return new File([archivo], archivo.name, { type: contentType, lastModified: archivo.lastModified });
  }

  return archivo;
};

export type ResultadoEvidencia = { ok: true } | { ok: false; mensaje: string };

export const subirEvidencia = async (incidenteId: string, archivoOriginal: File): Promise<ResultadoEvidencia> => {
  const archivo = await normalizarArchivo(archivoOriginal);
  const nombreSeguro = archivo.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
  const ruta = `incidentes/${incidenteId}/${Date.now()}_${nombreSeguro}`;
  const contentType = obtenerContentType(archivo);

  const { data, error: errorSubida } = await supabase.storage
    .from("evidencias-incidentes")
    .upload(ruta, archivo, { cacheControl: "3600", upsert: false, contentType });

  if (errorSubida || !data) {
    return { ok: false, mensaje: errorSubida?.message ?? "No se pudo subir el archivo." };
  }

  const { data: urlPublica } = supabase.storage.from("evidencias-incidentes").getPublicUrl(data.path);

  const { error: errorRegistro } = await supabase.from("evidencias").insert({
    incidente_id: incidenteId,
    url_storage: urlPublica.publicUrl,
    tipo_archivo: contentType,
  });

  return errorRegistro ? { ok: false, mensaje: errorRegistro.message } : { ok: true };
};
