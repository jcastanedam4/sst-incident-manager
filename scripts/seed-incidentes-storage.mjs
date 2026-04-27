import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const cargarEnvDesdeArchivo = (filename) => {
  const fullPath = resolve(process.cwd(), filename);
  if (!existsSync(fullPath)) {
    return;
  }

  const contenido = readFileSync(fullPath, "utf8");
  const lineas = contenido.split(/\r?\n/);

  for (const linea of lineas) {
    if (!linea || linea.trim().startsWith("#") || !linea.includes("=")) {
      continue;
    }

    const separador = linea.indexOf("=");
    const key = linea.slice(0, separador).trim();
    let value = linea.slice(separador + 1).trim();

    if (!key || process.env[key]) {
      continue;
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
};

cargarEnvDesdeArchivo(".env");
cargarEnvDesdeArchivo(".env.local");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "encargado.sst@empresa.com";
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "E1234";

if (!supabaseUrl) {
  console.error("Falta variable: NEXT_PUBLIC_SUPABASE_URL");
  process.exit(1);
}

const key = serviceRoleKey || anonKey;
const usaServiceRole = Boolean(serviceRoleKey);

if (!key) {
  console.error("Falta llave de Supabase. Define SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, key, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const BUCKET = "evidencias-incidentes";
const TOTAL = 25;

const tipos = [
  "Fisico",
  "Quimico",
  "Biologico",
  "Biomecanico",
  "Psicosocial",
  "Seguridad",
  "Fenomeno natural",
];

const estados = ["Abierto", "En Proceso", "Cerrado"];

const titulos = [
  "Resbalon en pasillo de produccion",
  "Derrame menor de sustancia",
  "Ruido excesivo en zona de maquinas",
  "Postura forzada en area de carga",
  "Caida de objeto en bodega",
  "Falla de senalizacion preventiva",
  "Iluminacion insuficiente en turno noche",
  "Contacto accidental con superficie caliente",
  "Desorden en area de almacenamiento",
  "Fatiga por jornada extendida",
];

const descripciones = [
  "Se identifico condicion insegura durante inspeccion rutinaria SST.",
  "El hallazgo fue reportado por operario y requiere seguimiento administrativo.",
  "Se observaron riesgos potenciales para la integridad del personal en la zona.",
  "La situacion demanda acciones de control y registro en bitacora de incidentes.",
  "Se detectaron incumplimientos de medidas preventivas definidas por el area SST.",
];

const generarFecha = (indice) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - (indice % 20));
  fecha.setHours(8 + (indice % 9), 5 * (indice % 11), 0, 0);
  return fecha.toISOString();
};

const generarIncidente = (indice) => {
  const tituloBase = titulos[indice % titulos.length];
  const descripcionBase = descripciones[indice % descripciones.length];

  return {
    titulo: `${tituloBase} #${indice + 1}`,
    descripcion: `${descripcionBase} Caso de prueba ${indice + 1} para validar trazabilidad y tableros SST.`,
    tipo_peligro: tipos[indice % tipos.length],
    estado: estados[indice % estados.length],
    fecha_suceso: generarFecha(indice),
    user_email: usaServiceRole ? `empleado${(indice % 5) + 1}@empresa.com` : adminEmail,
  };
};

const descargarImagen = async (indice) => {
  const url = `https://picsum.photos/seed/sst-incidente-${indice + 1}/1200/800`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`No se pudo descargar imagen (${response.status})`);
  }

  return response.arrayBuffer();
};

const crearIncidenteConEvidencia = async (indice) => {
  const payload = generarIncidente(indice);
  let incidente = null;
  let incidenteError = null;

  const intentoConEmail = await supabase.from("incidentes").insert(payload).select("id").single();
  incidente = intentoConEmail.data;
  incidenteError = intentoConEmail.error;

  if (incidenteError && incidenteError.message.includes("Could not find the 'user_email' column")) {
    const { user_email: _omitido, ...payloadSinEmail } = payload;
    const intentoSinEmail = await supabase.from("incidentes").insert(payloadSinEmail).select("id").single();
    incidente = intentoSinEmail.data;
    incidenteError = intentoSinEmail.error;
  }

  if (incidenteError || !incidente) {
    throw new Error(`Insert incidente fallo: ${incidenteError?.message ?? "sin detalle"}`);
  }

  const imageBuffer = await descargarImagen(indice);
  const path = `incidentes/${incidente.id}/seed_${indice + 1}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, imageBuffer, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "3600",
    });

  if (uploadError) {
    throw new Error(`Upload evidencia fallo: ${uploadError.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("incidentes")
    .update({ evidencia_url: publicUrl })
    .eq("id", incidente.id);

  if (updateError) {
    throw new Error(`Update incidente con evidencia_url fallo: ${updateError.message}`);
  }

  const { error: evidenciaError } = await supabase.from("evidencias").insert({
    incidente_id: incidente.id,
    url_storage: publicUrl,
    tipo_archivo: "image/jpeg",
  });

  if (evidenciaError) {
    console.warn(`Incidente ${incidente.id}: evidencia no insertada en tabla evidencias (${evidenciaError.message})`);
  }

  return incidente.id;
};

const main = async () => {
  if (!serviceRoleKey) {
    console.log("No se detecto SUPABASE_SERVICE_ROLE_KEY. Se usara login admin y user_email del admin para cumplir RLS.");
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    });

    if (loginError) {
      console.error("No hay service role key y fallo el login admin para seeding:", loginError.message);
      process.exit(1);
    }
  }

  console.log(`Creando ${TOTAL} incidentes con evidencia en Storage...`);

  let exitosos = 0;
  const errores = [];

  for (let i = 0; i < TOTAL; i += 1) {
    try {
      const incidenteId = await crearIncidenteConEvidencia(i);
      exitosos += 1;
      console.log(`OK ${i + 1}/${TOTAL} -> ${incidenteId}`);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error);
      errores.push({ indice: i + 1, mensaje });
      console.error(`ERROR ${i + 1}/${TOTAL}: ${mensaje}`);
    }
  }

  console.log(`\nResultado: ${exitosos}/${TOTAL} incidentes creados correctamente.`);

  if (errores.length > 0) {
    console.log("Errores detectados:");
    for (const item of errores) {
      console.log(`- Incidente ${item.indice}: ${item.mensaje}`);
    }
    process.exitCode = 1;
  }
};

void main();
