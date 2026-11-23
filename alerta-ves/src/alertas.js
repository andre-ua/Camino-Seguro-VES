import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import * as SQLite from 'expo-sqlite';
import { MotorAlertas } from './motor';
import { hayAudifonos } from '../modules/expo-audio-route';
import { avisoComunidadBg } from './reportes';

export const CANAL = 'alertas';
export const SCORE_MINIMO = 1.5;        // ignora puntos de muy bajo riesgo
export const config = { voz: true, altavoz: false };   // la voz SOLO suena con audífonos (o con altavoz=true, para pruebas)
export const oyentes = new Set();       // la pantalla se suscribe para listar avisos

let motor = null;
export async function obtenerMotor() {
  if (!motor) {
    const db = await SQLite.openDatabaseAsync('delitos_ves.db');
    motor = new MotorAlertas(db);
  }
  return motor;
}

const aDiez = (m) => Math.max(10, Math.round(m / 10) * 10);

function textoVoz(top, n) {
  const cat = top.cat.toLowerCase();
  if (n > 1) return `Atención. Hay ${n} zonas con denuncias a tu alrededor. La más cercana es de ${cat}, a ${aDiez(top.distancia)} metros. Guarda tu celular y mantente atento.`;
  return `Atención. Estás a ${aDiez(top.distancia)} metros de una zona de ${cat}, con ${top.total} denuncias reportadas. Guarda tu celular y mantente atento.`;
}

export async function notificarYHablar(nuevos) {
  const top = nuevos[0];
  const detalle = nuevos.length > 1
    ? `${nuevos.length} zonas con denuncias a tu alrededor`
    : `${top.total} denuncia(s) de ${top.cat.toLowerCase()} reportadas a ${top.distancia} m`;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `Precaución: zona de ${top.cat.toLowerCase()}`,
      body: `${detalle}. Guarda tu celular y mantente atento.`,
      sound: true,
      color: '#FF4D6D',
      data: { id_punto: top.id_punto },
    },
    trigger: { channelId: CANAL },   // usa el canal de alta prioridad (Android)
  });
  // Voz: solo si hay audífonos (cable o Bluetooth) conectados en este instante
  if (config.voz && (hayAudifonos() || config.altavoz)) {
    Speech.stop();
    Speech.speak(textoVoz(top, nuevos.length), { language: 'es-US', rate: 0.95 });
  }
}

/** Aviso de un reporte de la comunidad (patrulla, serenazgo, ambulancia cerca). a = salida de avisoCercano(). */
export async function avisarReporte(a) {
  await Notifications.scheduleNotificationAsync({
    content: { title: a.titulo, body: a.cuerpo, sound: true, color: '#4DA3FF', data: { id_reporte: a.r.id } },
    trigger: { channelId: CANAL },
  });
  if (config.voz && (hayAudifonos() || config.altavoz)) {
    Speech.stop();
    Speech.speak(a.texto, { language: 'es-US', rate: 0.95 });
  }
}

/** Evalúa una posición, avisa si corresponde y devuelve los avisos nuevos (zonas con denuncias + comunidad). */
export async function procesarPosicion(lat, lon, hora) {
  const m = await obtenerMotor();
  const nuevos = (await m.onGps(lat, lon, Date.now(), hora)).filter((p) => p.score >= SCORE_MINIMO);
  if (nuevos.length) {
    oyentes.forEach((fn) => fn(nuevos));
    await notificarYHablar(nuevos);
  }
  const com = await avisoComunidadBg(lat, lon);   // reportes de otros usuarios (Supabase)
  if (com) await avisarReporte(com);
  return nuevos;
}
