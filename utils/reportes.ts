import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import type { Incidente } from "@/types/incidentes";
import { esAplicacionNativa } from "@/utils/capacitor";

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const resultado = reader.result;

      if (typeof resultado !== "string") {
        reject(new Error("No fue posible convertir el archivo a base64."));
        return;
      }

      const base64 = resultado.split(",")[1];
      if (!base64) {
        reject(new Error("Contenido base64 invalido."));
        return;
      }

      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Fallo la lectura del archivo."));
    reader.readAsDataURL(blob);
  });
};

const descargarBlob = (blob: Blob, nombreArchivo: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = nombreArchivo;
  anchor.click();
  URL.revokeObjectURL(url);
};

const compartirArchivoNativo = async (blob: Blob, nombreArchivo: string) => {
  const base64 = await blobToBase64(blob);
  const resultado = await Filesystem.writeFile({
    path: nombreArchivo,
    data: base64,
    directory: Directory.Cache,
  });

  await Share.share({
    title: "Exportacion SST",
    text: nombreArchivo,
    url: resultado.uri,
    dialogTitle: "Compartir reporte",
  });
};

const exportarBlob = async (blob: Blob, nombreArchivo: string) => {
  if (!esAplicacionNativa()) {
    descargarBlob(blob, nombreArchivo);
    return;
  }

  try {
    await compartirArchivoNativo(blob, nombreArchivo);
  } catch {
    // Si falla la capa nativa, mantenemos el comportamiento web como respaldo.
    descargarBlob(blob, nombreArchivo);
  }
};

export const exportarIncidentesExcel = async (incidentes: Incidente[]) => {
  const resp = await fetch("/api/export/excel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ incidentes }),
  });

  if (!resp.ok) {
    const mensaje = await resp.text();
    throw new Error(mensaje || "No se pudo generar el archivo Excel.");
  }

  const blob = await resp.blob();
  await exportarBlob(blob, `incidentes_${new Date().toISOString().slice(0, 10)}.xls`);
};

export const exportarIndicadoresPdf = async (incidentes: Incidente[]) => {
  const resp = await fetch("/api/export/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ incidentes }),
  });

  if (!resp.ok) {
    const mensaje = await resp.text();
    throw new Error(mensaje || "No se pudo generar el archivo PDF.");
  }

  const blob = await resp.blob();
  await exportarBlob(blob, `indicadores_sst_${new Date().toISOString().slice(0, 10)}.pdf`);
};
