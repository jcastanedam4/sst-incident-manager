import { ErrorNoEncontrado } from "./errores";
import { EvaluadorRiesgoService } from "./evaluadorRiesgo";
import type { IncidentRepository, IncidenteClasificado, UsuarioAutenticado } from "./modelo";
import { validarIdIncidente, validarNuevoIncidente } from "./validacion";

/**
 * Servicio de aplicación del corte vertical.
 * - RF-01: valida, aplica la matriz de riesgo y solo entonces pide persistir.
 * - RF-02: valida el id y consulta; la ausencia se traduce a ErrorNoEncontrado.
 * No conoce HTTP ni SQL; el repositorio se inyecta (puede ser simulado en pruebas).
 */
export class IncidentService {
  constructor(
    private readonly repositorio: IncidentRepository,
    private readonly evaluador: EvaluadorRiesgoService = new EvaluadorRiesgoService()
  ) {}

  async registrar(entrada: unknown, usuario: UsuarioAutenticado): Promise<IncidenteClasificado> {
    const datos = validarNuevoIncidente(entrada);
    const clasificacion = this.evaluador.evaluar(datos.tipo_peligro, datos.gravedad);

    return this.repositorio.guardar({
      ...datos,
      ...clasificacion,
      estado: "Abierto",
      user_id: usuario.id,
      user_email: usuario.email,
    });
  }

  async consultarPorId(id: unknown): Promise<IncidenteClasificado> {
    const idValido = validarIdIncidente(id);
    const incidente = await this.repositorio.buscarPorId(idValido);

    if (!incidente) {
      throw new ErrorNoEncontrado();
    }

    return incidente;
  }
}
