import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Workbook } from "exceljs";
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

  await exportarBlob(blob, `incidentes_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

export const exportarIndicadoresPdf = async (incidentes: Incidente[]) => {
  const total = incidentes.length;
  const abiertos = incidentes.filter((i) => i.estado === "Abierto").length;
  const enProceso = incidentes.filter((i) => i.estado === "En Proceso").length;
  const cerrados = incidentes.filter((i) => i.estado === "Cerrado").length;

  const porTipo = incidentes.reduce<Record<string, number>>((acc, incidente) => {
    acc[incidente.tipo_peligro] = (acc[incidente.tipo_peligro] ?? 0) + 1;
    return acc;
  }, {});

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 40;

  // Tipografías y colores
  const colorBlue = "#0047AB";
  const colorOrange = "#F97316";
  const colorGreen = "#22C55E";
  const colorGray = "#F3F4F6";
  doc.setFont("helvetica", "normal");

  // Encabezado
  doc.setTextColor(colorBlue);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Indicadores de Accidentalidad", 40, y);
  y += 24;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50);
  doc.text(`Fecha: ${new Date().toLocaleString()}`, 40, y);
  y += 18;

  // Tarjetas resumen (4 cajas)
  const cardWidth = (pageWidth - 80 - 30) / 4; // margins and gaps
  const cardHeight = 64;
  const gap = 10;

  const cards = [
    { label: "Total", value: total, bg: colorGray, fg: "#111827" },
    { label: "Abiertos", value: abiertos, bg: "#FFF7ED", fg: colorOrange },
    { label: "En Proceso", value: enProceso, bg: "#EFF6FF", fg: "#1E40AF" },
    { label: "Cerrados", value: cerrados, bg: "#ECFDF5", fg: colorGreen },
  ];

  let x = 40;
  cards.forEach((card) => {
    // fondo
    try {
      // rounded rect if available
      // @ts-ignore
      if (typeof doc.roundedRect === "function") {
        // x, y, width, height, rx, ry, style
        // @ts-ignore
        doc.setFillColor(card.bg);
        // @ts-ignore
        doc.roundedRect(x, y, cardWidth, cardHeight, 6, 6, "F");
      } else {
        doc.setFillColor(card.bg);
        doc.rect(x, y, cardWidth, cardHeight, "F");
      }
    } catch (e) {
      doc.setFillColor(card.bg);
      doc.rect(x, y, cardWidth, cardHeight, "F");
    }

    // label
    doc.setFontSize(9);
    doc.setTextColor(card.fg);
    doc.text(card.label, x + 10, y + 18);

    // value
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(String(card.value), x + 10, y + 42);
    doc.setFont("helvetica", "normal");

    x += cardWidth + gap;
  });

  y += cardHeight + 22;

  // Titulo sección de peligros
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(34);
  doc.text("Distribución por tipo de peligro", 40, y);
  y += 18;

  // Preparar datos para tabla/barras
  const tipos = Object.entries(porTipo).sort((a, b) => b[1] - a[1]);
  const maxValue = tipos.length > 0 ? Math.max(...tipos.map((t) => t[1])) : 1;

  // Construir tabla con autoTable, dibujando barras en la segunda columna
  autoTable(doc, {
    startY: y,
    theme: "plain",
    styles: { font: "helvetica", fontSize: 10 },
    head: [["Tipo de peligro", "Proporción"]],
    body: tipos.map(([tipo, cantidad]) => [tipo, String(cantidad)]),
    columnStyles: {
      0: { cellWidth: 140 },
      1: { cellWidth: pageWidth - 80 - 140 },
    },
    didDrawCell: (data) => {
      if (data.column.index === 1 && data.cell.section === "body") {
        const cantidad = parseInt(String(data.cell.text), 10) || 0;
        const cell = data.cell;
        const padding = 6;
        const barMaxWidth = cell.width - padding * 2 - 30; // leave space for number
        const ratio = maxValue > 0 ? cantidad / maxValue : 0;
        const barWidth = Math.max(8, Math.round(barMaxWidth * ratio));
        const barX = cell.x + padding;
        const barY = cell.y + cell.height / 2 - 6;

        // barra de fondo
        doc.setFillColor("#E6EEF9");
        doc.rect(barX, barY, barMaxWidth, 12, "F");

        // barra principal azul
        doc.setFillColor(colorBlue);
        doc.rect(barX, barY, barWidth, 12, "F");

        // numero al final
        doc.setFontSize(9);
        doc.setTextColor(34);
        const numX = barX + barMaxWidth + 8;
        doc.text(String(cantidad), numX, barY + 10);
      }
    },
    headStyles: { fillColor: [255, 255, 255], textColor: 34, fontStyle: "bold" },
    margin: { left: 40, right: 40 },
  });

  const pdfBlob = doc.output("blob");
  await exportarBlob(pdfBlob, `indicadores_sst_${new Date().toISOString().slice(0, 10)}.pdf`);
};
