import { supabase } from './supabase';
import { VIGENCIA_MIN } from './config';
import { haversine } from './motor';
import { guardarAjuste, leerAjuste } from './ajustes';

export const TIPOS = {
  patrulla:   { nombre: 'Patrulla PNP', color: '#4DA3FF' },
  serenazgo:  { nombre: 'Serenazgo',    color: '#00E676' },
  ambulancia: { nombre: 'Ambulancia',   color: '#FFFFFF' },
};

/** Convierte la clase de Teachable Machine ("Patrulla", "Serenazgo"...) en nuestro tipo. null = "Otros". */
export function aTipo(clase) {
  const n = String(clase || '').toLowerCase();
  if (n.includes('patrulla') || n.includes('pnp')) return 'patrulla';
  if (n.includes('serenazgo')) return 'serenazgo';
  if (n.includes('ambulancia')) return 'ambulancia';
  return null;
}

async function deviceId() {
  let id = await leerAjuste('device_id', '');
  if (!id) {
    id = 'd' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    await guardarAjuste('device_id', id);
  }
  return id;
}

export const edadMin = (r) => Math.floor((Date.now() - new Date(r.created_at).getTime()) / 60000);
export const vigente = (r) => edadMin(r) < VIGENCIA_MIN;

export async function cargarRecientes() {
  const desde = new Date(Date.now() - VIGENCIA_MIN * 60000).toISOString();
  const { data, error } = await supabase.from('reportes').select('*')
    .gte('created_at', desde).order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  return data || [];
}

export async function enviarReporte({ tipo, lat, lon, confianza }) {
  const { error } = await supabase.from('reportes')
    .insert({ tipo, lat, lon, confianza, device_id: await deviceId() });
  if (error) throw error;
}

/** Tiempo real: llama onNuevo(reporte) cada vez que CUALQUIER usuario publica. Devuelve la función para cancelar. */
export function suscribir(onNuevo) {
  const canal = supabase.channel('reportes-en-vivo')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reportes' }, (p) => onNuevo(p.new))
    .subscribe();
  return () => { supabase.removeChannel(canal); };
}

const aDiez = (m) => Math.max(10, Math.round(m / 10) * 10);

/** Reportes ya avisados (compartido entre la app abierta y la tarea en segundo plano para no repetir). */
export const avisados = new Set();

/** Si hay un reporte vigente a <= radio m que aún no avisamos, devuelve { r, titulo, cuerpo, texto }. */
export function avisoCercano(pos, reportes, radio = 150) {
  for (const r of reportes) {
    if (avisados.has(r.id) || !vigente(r)) continue;
    const d = haversine(pos.lat, pos.lon, r.lat, r.lon);
    if (d > radio) continue;
    avisados.add(r.id);
    const m = edadMin(r);
    const hace = m < 1 ? 'hace menos de un minuto' : `hace ${m} minuto${m === 1 ? '' : 's'}`;
    const nombre = TIPOS[r.tipo].nombre;
    const cuerpo = `Se reportó ${nombre.toLowerCase()} ${hace}, a ${aDiez(d)} metros.`;
    return { r, titulo: `Aviso de la comunidad: ${nombre}`, cuerpo, texto: `Aviso de la comunidad. ${cuerpo}` };
  }
  return null;
}

// ---- para la tarea en segundo plano (no hay React): descarga reportes con caché de 60 s
let cacheBg = { t: 0, d: [] };
export async function avisoComunidadBg(lat, lon) {
  if (Date.now() - cacheBg.t > 60000) {
    try { cacheBg = { t: Date.now(), d: await cargarRecientes() }; } catch { /* sin internet: se usa lo último */ }
  }
  return avisoCercano({ lat, lon }, cacheBg.d);
}
