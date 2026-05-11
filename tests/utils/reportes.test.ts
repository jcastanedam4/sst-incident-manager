import { exportarIncidentesExcel, exportarIndicadoresPdf } from "@/utils/reportes";
import type { Incidente } from "@/types/incidentes";

const excelState: {
  rows: Array<Record<string, unknown>>;
  writeBufferCalls: number;
} = {
  rows: [],
  writeBufferCalls: 0,
};

const pdfState: {
  downloadFileName: string | null;
  downloadClicks: number;
  pageCount: number;
  textCalls: string[];
} = {
  downloadFileName: null,
  downloadClicks: 0,
  pageCount: 1,
  textCalls: [],
};

vi.mock("exceljs", () => {
  class MockWorksheet {
    columns: Array<{ header: string; key: string; width: number }> = [];

    addRows(rows: Array<Record<string, unknown>>) {
      excelState.rows = rows;
    }
  }

  class MockWorkbook {
    xlsx = {
      writeBuffer: async () => {
        excelState.writeBufferCalls += 1;
        return new ArrayBuffer(16);
      },
    };

    addWorksheet() {
      return new MockWorksheet();
    }
  }

  return {
    Workbook: MockWorkbook,
  };
});

vi.mock("jspdf", () => {
  class MockPdf {
    setFontSize() {
      return undefined;
    }

    text(text: string) {
      pdfState.textCalls.push(text);
      return undefined;
    }

    addPage() {
      pdfState.pageCount += 1;
      return undefined;
    }

    output() {
      return new Blob(["pdf"], { type: "application/pdf" });
    }

    save() {
      return undefined;
    }
  }

  return {
    jsPDF: MockPdf,
  };
});

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

    excelState.rows = [];
    excelState.writeBufferCalls = 0;

    pdfState.downloadFileName = null;
    pdfState.downloadClicks = 0;
    pdfState.pageCount = 1;
    pdfState.textCalls = [];

    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:archivo");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.createElement = originalCreateElement;
  });

  it("exporta incidentes a Excel con estructura esperada y nombre con fecha", async () => {
    const clickSpy = vi.fn();
    const anchor = {
      href: "",
      download: "",
      click: clickSpy,
    } as unknown as HTMLAnchorElement;

    vi.spyOn(document, "createElement").mockReturnValue(anchor);

    await exportarIncidentesExcel(incidentesBase);

    expect(excelState.rows).toHaveLength(3);
    expect(excelState.rows[0]).toMatchObject({
      ID: "1",
      Titulo: "Piso humedo",
      Estado: "Abierto",
      EvidenciaURL: "https://example.com/evidencia.jpg",
    });
    expect(excelState.writeBufferCalls).toBe(1);
    expect(anchor.download).toBe("incidentes_2026-04-26.xlsx");
    expect(anchor.href).toBe("blob:archivo");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:archivo");
  });

  it("genera PDF de indicadores con conteos correctos y nombre esperado", () => {
    const clickSpy = vi.fn();
    const anchor = {
      href: "",
      download: "",
      click: clickSpy,
    } as unknown as HTMLAnchorElement;

    vi.spyOn(document, "createElement").mockReturnValue(anchor);

    exportarIndicadoresPdf(incidentesBase);

    expect(anchor.download).toBe("indicadores_sst_2026-04-26.pdf");
    expect(anchor.href).toBe("blob:archivo");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(pdfState.textCalls).toContain("Total de incidentes: 3");
    expect(pdfState.textCalls).toContain("Abiertos: 1");
    expect(pdfState.textCalls).toContain("En Proceso: 1");
    expect(pdfState.textCalls).toContain("Cerrados: 1");
    expect(pdfState.textCalls).toContain("- Seguridad: 1");
    expect(pdfState.textCalls).toContain("- Fisico: 1");
    expect(pdfState.textCalls).toContain("- Quimico: 1");
  });

  it("agrega pagina en PDF cuando el detalle por tipo supera el alto de hoja", () => {
    const muchosTipos: Incidente[] = Array.from({ length: 60 }, (_, idx) => ({
      id: String(idx + 1),
      titulo: `Incidente ${idx + 1}`,
      descripcion: "Descripcion",
      tipo_peligro: `Tipo ${idx + 1}`,
      estado: "Abierto",
    }));

    exportarIndicadoresPdf(muchosTipos);

    expect(pdfState.pageCount).toBeGreaterThan(1);
  });
});
