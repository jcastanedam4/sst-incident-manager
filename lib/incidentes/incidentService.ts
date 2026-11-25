import { ErrorNoEncontrado } from "./errores";
import { EvaluadorRiesgoService } from "./evaluadorRiesgo";
import { TIPO_PELIGRO_SIN_CLASIFICAR } from "@/types/incidentes";
import type { ActualizarClasificacionEntrada, IncidentRepository, IncidenteClasificado, UsuarioAutenticado } from "./modelo";
import { validarActualizacionClasificacion, validarIdIncidente, validarNuevoIncidente } from "./validacion";

const LIMITE_HISTORIAL = 5;

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
    const clasificacion =
      datos.tipo_peligro === TIPO_PELIGRO_SIN_CLASIFICAR
        ? { prioridad_asignada: null, requiere_atencion_inmediata: null }
        : this.evaluador.evaluar(datos.tipo_peligro, datos.gravedad);

    return this.repositorio.guardar({
      ...datos,
      ...clasificacion,
      estado: "Abierto",
      user_id: usuario.id,
      user_email: usuario.email,
    });
  }

  async actualizarClasificacion(id: unknown, entrada: unknown): Promise<IncidenteClasificado> {
    const idValido = validarIdIncidente(id);
    const datos: ActualizarClasificacionEntrada = validarActualizacionClasificacion(entrada);
    const clasificacion =
      datos.tipo_peligro === TIPO_PELIGRO_SIN_CLASIFICAR
        ? { prioridad_asignada: null, requiere_atencion_inmediata: null }
        : this.evaluador.evaluar(datos.tipo_peligro, datos.gravedad);

    return this.repositorio.actualizarClasificacion(idValido, { ...datos, ...clasificacion });
  }

  async consultarPorId(id: unknown): Promise<IncidenteClasificado> {
    const idValido = validarIdIncidente(id);
    const incidente = await this.repositorio.buscarPorId(idValido);

    if (!incidente) {
      throw new ErrorNoEncontrado();
    }

    return incidente;
  }

  async listarUltimosPorUsuario(usuario: UsuarioAutenticado): Promise<IncidenteClasificado[]> {
    return this.repositorio.buscarUltimosPorUsuario(usuario.id, usuario.email, LIMITE_HISTORIAL);
  }
}
