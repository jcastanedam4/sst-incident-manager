import { exportarIncidentesExcel, exportarIndicadoresPdf } from "@/utils/reportes";
import type { Incidente } from "@/types/incidentes";

const incidentesBase: Incidente[] = [
  {
    id: "1",
    titulo: "Piso humedo",
    descripcion: "Riesgo de caida",
    tipo_peligro: "Seguridad",
    estado: "Abierto",
    created_at: "2026-04-26T12:00:00Z",
    fecha_suceso: "2026-04-26T11:30:00Z",
    user_email: "trabajador@empresa.com",
    evidencia_url: "https://example.com/evidencia.jpg",
  },
  {
    id: "2",
    titulo: "Ruido alto",
    descripcion: "Posible afectacion auditiva",
    tipo_peligro: "Fisico",
    estado: "En Proceso",
    created_at: "2026-04-26T12:10:00Z",
    fecha_suceso: "2026-04-26T11:40:00Z",
    user_email: "operario@empresa.com",
    evidencia_url: null,
  },
  {
    id: "3",
    titulo: "Sustancia derramada",
    descripcion: "Riesgo quimico",
    tipo_peligro: "Quimico",
    estado: "Cerrado",
    created_at: "2026-04-26T12:20:00Z",
    fecha_suceso: "2026-04-26T11:50:00Z",
    user_email: "qa@empresa.com",
    evidencia_url: null,
  },
];

describe("utils/reportes", () => {
  const originalCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-26T12:00:00.000Z"));
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:archivo");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.createElement = originalCreateElement;
  });

  it("solicita el Excel al endpoint y descarga el archivo recibido", async () => {
    const clickSpy = vi.fn();
    const anchor = { href: "", download: "", click: clickSpy } as unknown as HTMLAnchorElement;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("excel", {
        status: 200,
        headers: { "Content-Type": "application/vnd.ms-excel" },
      })
    );

    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(document, "createElement").mockReturnValue(anchor);

    await exportarIncidentesExcel(incidentesBase);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/export/excel",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ incidentes: incidentesBase }),
      })
    );
    expect(anchor.download).toBe("incidentes_2026-04-26.xls");
    expect(anchor.href).toBe("blob:archivo");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:archivo");
  });

  it("solicita el PDF al endpoint y descarga el archivo recibido", async () => {
    const clickSpy = vi.fn();
    const anchor = { href: "", download: "", click: clickSpy } as unknown as HTMLAnchorElement;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("pdf", {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      })
    );

    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(document, "createElement").mockReturnValue(anchor);

    await exportarIndicadoresPdf(incidentesBase);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/export/pdf",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ incidentes: incidentesBase }),
      })
    );
    expect(anchor.download).toBe("indicadores_sst_2026-04-26.pdf");
    expect(anchor.href).toBe("blob:archivo");
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("expone el error del endpoint y no descarga un archivo falso", async () => {
    const clickSpy = vi.fn();
    const anchor = { href: "", download: "", click: clickSpy } as unknown as HTMLAnchorElement;
    const fetchMock = vi.fn().mockResolvedValue(new Response("fallo del servidor", { status: 500 }));

    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(document, "createElement").mockReturnValue(anchor);

    await expect(exportarIndicadoresPdf(incidentesBase)).rejects.toThrow("fallo del servidor");
    expect(clickSpy).not.toHaveBeenCalled();
  });
});
