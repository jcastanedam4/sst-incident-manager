import { jsPDF } from "jspdf";
import { Workbook } from "exceljs";
import type { Incidente } from "@/types/incidentes";

const descargarBlob = (blob: Blob, nombreArchivo: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = nombreArchivo;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const exportarIncidentesExcel = async (incidentes: Incidente[]) => {
  const filas = incidentes.map((incidente) => ({
    ID: incidente.id,
    Titulo: incidente.titulo,
    Descripcion: incidente.descripcion,
    TipoPeligro: incidente.tipo_peligro,
    Estado: incidente.estado,
    FechaSuceso: incidente.fecha_suceso ?? "",
    FechaCreacion: incidente.created_at ?? "",
    Reportante: incidente.user_email ?? "",
    EvidenciaURL: incidente.evidencia_url ?? "",
  }));

  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet("Incidentes");
  worksheet.columns = Object.keys(filas[0] ?? { ID: "" }).map((key) => ({ header: key, key, width: 22 }));
  worksheet.addRows(filas);

  const excelArray = await workbook.xlsx.writeBuffer();
  const blob = new Blob([excelArray], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  descargarBlob(blob, `incidentes_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

export const exportarIndicadoresPdf = (incidentes: Incidente[]) => {
  const total = incidentes.length;
  const abiertos = incidentes.filter((i) => i.estado === "Abierto").length;
  const enProceso = incidentes.filter((i) => i.estado === "En Proceso").length;
  const cerrados = incidentes.filter((i) => i.estado === "Cerrado").length;

  const porTipo = incidentes.reduce<Record<string, number>>((acc, incidente) => {
    acc[incidente.tipo_peligro] = (acc[incidente.tipo_peligro] ?? 0) + 1;
    return acc;
  }, {});

  const doc = new jsPDF();
  let y = 18;

  doc.setFontSize(16);
  doc.text("Reporte SST - Indicadores de Accidentalidad", 14, y);
  y += 10;

  doc.setFontSize(10);
  doc.text(`Fecha de generacion: ${new Date().toLocaleString()}`, 14, y);
  y += 10;

  doc.setFontSize(12);
  doc.text("Resumen general", 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.text(`Total de incidentes: ${total}`, 14, y);
  y += 6;
  doc.text(`Abiertos: ${abiertos}`, 14, y);
  y += 6;
  doc.text(`En Proceso: ${enProceso}`, 14, y);
  y += 6;
  doc.text(`Cerrados: ${cerrados}`, 14, y);
  y += 10;

  doc.setFontSize(12);
  doc.text("Distribucion por tipo de peligro", 14, y);
  y += 8;
  doc.setFontSize(10);

  for (const [tipo, cantidad] of Object.entries(porTipo)) {
    doc.text(`- ${tipo}: ${cantidad}`, 14, y);
    y += 6;

    if (y > 275) {
      doc.addPage();
      y = 20;
    }
  }

  doc.save(`indicadores_sst_${new Date().toISOString().slice(0, 10)}.pdf`);
};
