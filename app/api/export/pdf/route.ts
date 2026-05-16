import { NextResponse } from "next/server";

type IncidenteInput = {
  id?: string;
  titulo?: string;
  tipo_peligro?: string;
  estado?: string;
  created_at?: string | null;
};

const escaparPdf = (texto: string) => texto.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

const crearPdfBasico = (lineas: string[]): Buffer => {
  const yInicio = 800;
  const salto = 16;
  const contenido = [
    "BT",
    "/F1 12 Tf",
    `50 ${yInicio} Td`,
    ...lineas.flatMap((linea, idx) => {
      if (idx === 0) return [`(${escaparPdf(linea)}) Tj`];
      return ["T*", `(${escaparPdf(linea)}) Tj`];
    }),
    "ET",
  ].join("\n");

  const objetos: string[] = [];
  objetos[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objetos[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
  objetos[3] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>";
  objetos[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objetos[5] = `<< /Length ${Buffer.byteLength(contenido, "utf8")} >>\nstream\n${contenido}\nendstream`;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let i = 1; i <= 5; i++) {
    offsets[i] = Buffer.byteLength(pdf, "utf8");
    pdf += `${i} 0 obj\n${objetos[i]}\nendobj\n`;
  }

  const xrefPos = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 6\n0000000000 65535 f \n`;

  for (let i = 1; i <= 5; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const incidentes = (body?.incidentes ?? []) as IncidenteInput[];

    const total = incidentes.length;
    const abiertos = incidentes.filter((i) => i.estado === "Abierto").length;
    const enProceso = incidentes.filter((i) => i.estado === "En Proceso").length;
    const cerrados = incidentes.filter((i) => i.estado === "Cerrado").length;

    const porTipo = incidentes.reduce<Record<string, number>>((acc, i) => {
      const clave = i.tipo_peligro || "Sin tipo";
      acc[clave] = (acc[clave] ?? 0) + 1;
      return acc;
    }, {});

    const lineas = [
      "SST - Indicadores de accidentalidad",
      `Fecha: ${new Date().toLocaleString()}`,
      "",
      `Total incidentes: ${total}`,
      `Abiertos: ${abiertos}`,
      `En Proceso: ${enProceso}`,
      `Cerrados: ${cerrados}`,
      "",
      "Distribucion por tipo de peligro:",
      ...Object.entries(porTipo).map(([tipo, cantidad]) => `- ${tipo}: ${cantidad}`),
    ];

    const pdf = crearPdfBasico(lineas);

    const bytes = new Uint8Array(pdf);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=indicadores_sst_${new Date().toISOString().slice(0, 10)}.pdf`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? String(error) }, { status: 500 });
  }
}
