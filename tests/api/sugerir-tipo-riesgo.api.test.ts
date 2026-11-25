import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/v1/sugerir-tipo-riesgo/route";

const { autenticarMock } = vi.hoisted(() => ({
  autenticarMock: vi.fn(),
}));

vi.mock("@/lib/incidentes/contexto", () => ({
  autenticar: autenticarMock,
}));

const crearRequest = (descripcion: unknown) =>
  new Request("http://localhost/api/v1/sugerir-tipo-riesgo", {
    method: "POST",
    headers: {
      Authorization: "Bearer token-de-prueba",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ descripcion }),
  });

describe("POST /api/v1/sugerir-tipo-riesgo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    autenticarMock.mockResolvedValue({});
    vi.stubEnv("RISK_MODEL_API_URL", "http://127.0.0.1:8000/predict");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("adapta las etiquetas BETO a los valores del formulario y solo reenvía la descripción", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ label: "Condiciones de Seguridad" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(crearRequest("Escalera mojada"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { tipo_peligro: "Seguridad" } });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/predict",
      expect.objectContaining({
        body: JSON.stringify({ text: "Escalera mojada" }),
        cache: "no-store",
      })
    );
  });

  it("rechaza descripciones vacías sin llamar al modelo", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(crearRequest("   "));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("devuelve un error explícito cuando el servicio local no está disponible", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(crearRequest("Escalera mojada"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { codigo: "IA_NO_DISPONIBLE" },
    });
  });
});
