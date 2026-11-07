// RNF-01 (comportamiento temporal de RF-02): 20 consultas consecutivas por id existente.
// Uso: API_BASE_URL=http://localhost:3000 ACCESS_TOKEN=<jwt> INCIDENT_ID=<uuid> node scripts/medir-consulta.mjs
const base = process.env.API_BASE_URL ?? "http://localhost:3000";
const token = process.env.ACCESS_TOKEN;
const id = process.env.INCIDENT_ID ?? "00000000-0000-4000-8000-000000000001";
const UMBRAL_MS = 1000;
const REPETICIONES = 20;

if (!token) {
  console.error("Falta ACCESS_TOKEN (JWT de un usuario autenticado).");
  process.exit(1);
}

const tiempos = [];
for (let i = 1; i <= REPETICIONES; i++) {
  const inicio = performance.now();
  const r = await fetch(`${base}/api/v1/incidentes/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  const ms = performance.now() - inicio;
  tiempos.push(ms);
  console.log(`#${i} status=${r.status} ${ms.toFixed(1)} ms`);
}

const max = Math.max(...tiempos);
const prom = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
console.log(`\nmáx=${max.toFixed(1)} ms  promedio=${prom.toFixed(1)} ms  umbral=${UMBRAL_MS} ms`);
console.log(max <= UMBRAL_MS ? "RESULTADO: CUMPLE" : "RESULTADO: NO CUMPLE");
process.exit(max <= UMBRAL_MS ? 0 : 2);
