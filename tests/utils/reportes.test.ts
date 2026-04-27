import { exportarIncidentesExcel, exportarIndicadoresPdf } from "@/utils/reportes";
import type { Incidente } from "@/types/incidentes";

const xlsxState: {
  rows: Array<Record<string, unknown>>;
  appendCalls: number;
  writeCalls: number;
} = {
  rows: [],
  appendCalls: 0,
  writeCalls: 0,
};

const pdfState: {
  savedFileName: string | null;
  pageCount: number;
  textCalls: string[];
} = {
  savedFileName: null,
  pageCount: 1,
  textCalls: [],
};

vi.mock("xlsx", () => {
  return {
    utils: {
      json_to_sheet: (rows: Array<Record<string, unknown>>) => {
        xlsxState.rows = rows;
        return { rows };
      },
      book_new: () => ({ sheets: [] as Array<unknown> }),
      book_append_sheet: () => {
        xlsxState.appendCalls += 1;
      },
    },
    write: () => {
      xlsxState.writeCalls += 1;
      return new ArrayBuffer(16);
    },
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

    save(fileName: string) {
      pdfState.savedFileName = fileName;
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

    xlsxState.rows = [];
    xlsxState.appendCalls = 0;
    xlsxState.writeCalls = 0;

    pdfState.savedFileName = null;
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

  it("exporta incidentes a Excel con estructura esperada y nombre con fecha", () => {
    const clickSpy = vi.fn();
    const anchor = {
      href: "",
      download: "",
      click: clickSpy,
    } as unknown as HTMLAnchorElement;

    vi.spyOn(document, "createElement").mockReturnValue(anchor);

    exportarIncidentesExcel(incidentesBase);

    expect(xlsxState.rows).toHaveLength(3);
    expect(xlsxState.rows[0]).toMatchObject({
      ID: "1",
      Titulo: "Piso humedo",
      Estado: "Abierto",
      EvidenciaURL: "https://example.com/evidencia.jpg",
    });
    expect(xlsxState.appendCalls).toBe(1);
    expect(xlsxState.writeCalls).toBe(1);
    expect(anchor.download).toBe("incidentes_2026-04-26.xlsx");
    expect(anchor.href).toBe("blob:archivo");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:archivo");
  });

  it("genera PDF de indicadores con conteos correctos y nombre esperado", () => {
    exportarIndicadoresPdf(incidentesBase);

    expect(pdfState.savedFileName).toBe("indicadores_sst_2026-04-26.pdf");
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
