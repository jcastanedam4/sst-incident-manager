import { NextResponse } from "next/server";

type IncidenteInput = {
  id?: string;
  titulo?: string;
  descripcion?: string;
  tipo_peligro?: string;
  estado?: string;
  fecha_suceso?: string | null;
  created_at?: string | null;
  user_email?: string | null;
  evidencia_url?: string | null;
};

const escaparHtml = (value: unknown): string => {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const incidentes = (body?.incidentes ?? []) as IncidenteInput[];

    const rows = incidentes
      .map((inc) => {
        const columnas = [
          inc.id,
          inc.titulo,
          inc.descripcion,
          inc.tipo_peligro,
          inc.estado,
          inc.fecha_suceso ?? "",
          inc.created_at ?? "",
          inc.user_email ?? "",
          inc.evidencia_url ?? "",
        ].map((v) => `<td>${escaparHtml(v)}</td>`);

        return `<tr>${columnas.join("")}</tr>`;
      })
      .join("\n");

    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 12px; }
  th, td { border: 1px solid #d1d5db; padding: 6px; vertical-align: top; }
  th { background: #1e293b; color: white; }
  tr:nth-child(even) { background: #f8fafc; }
</style>
</head>
<body>
  <h3>Consolidado de Incidentes SST</h3>
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Titulo</th>
        <th>Descripcion</th>
        <th>Tipo Peligro</th>
        <th>Estado</th>
        <th>Fecha Suceso</th>
        <th>Fecha Creacion</th>
        <th>Reportante</th>
        <th>Evidencia URL</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename=incidentes_${new Date().toISOString().slice(0, 10)}.xls`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? String(error) }, { status: 500 });
  }
}
