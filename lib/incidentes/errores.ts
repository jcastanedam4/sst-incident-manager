/**
 * Errores controlados del corte vertical de incidentes.
 * La capa de API los traduce a códigos HTTP; el servicio nunca conoce HTTP.
 */

export type DetalleValidacion = { campo: string; mensaje: string };

export class ErrorValidacion extends Error {
  readonly detalles: DetalleValidacion[];

  constructor(detalles: DetalleValidacion[]) {
    super("Los datos enviados no son válidos.");
    this.name = "ErrorValidacion";
    this.detalles = detalles;
  }
}

export class ErrorNoAutorizado extends Error {
  constructor(mensaje = "Sesión no válida o ausente.") {
    super(mensaje);
    this.name = "ErrorNoAutorizado";
  }
}

export class ErrorNoEncontrado extends Error {
  constructor(mensaje = "El incidente solicitado no existe.") {
    super(mensaje);
    this.name = "ErrorNoEncontrado";
  }
}

/** Fallo de la base de datos o de la conexión. El detalle técnico no se expone al cliente. */
export class ErrorPersistencia extends Error {
  readonly causa: unknown;

  constructor(mensaje: string, causa?: unknown) {
    super(mensaje);
    this.name = "ErrorPersistencia";
    this.causa = causa;
  }
}
