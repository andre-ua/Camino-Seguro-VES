import * as Speech from 'expo-speech';

const aDiez = (m) => Math.max(10, Math.round(m / 10) * 10);
export const turnoDe = (h) => (h < 6 ? 'madrugada' : h < 12 ? 'mañana' : h < 18 ? 'tarde' : 'noche');

export function nivelRiesgo(puntos) {
  const s = puntos.filter((p) => p.dist <= 150).reduce((a, p) => a + p.score, 0);
  if (s < 3) return { txt: 'BAJO', col: '#00E676', s };
  if (s < 12) return { txt: 'MEDIO', col: '#FFA94D', s };
  return { txt: 'ALTO', col: '#FF4D6D', s };
}

/** Texto de Hermes. Nunca promete que un lugar es "seguro": habla de denuncias registradas. */
export function resumenSeguridad(puntos, hora) {
  const cerca = puntos.filter((p) => p.dist <= 300);
  if (!cerca.length) {
    return 'No hay denuncias registradas a menos de 300 metros de tu ubicación. Eso no garantiza que el lugar sea seguro, así que mantente atento a tu entorno.';
  }
  const nivel = nivelRiesgo(puntos).txt.toLowerCase();
  const top = cerca[0];
  const n = cerca.length;
  const turno = turnoDe(hora);
  let t = `Según las denuncias registradas, estás en una zona de riesgo ${nivel}. `;
  t += n === 1 ? 'Hay una zona con denuncias a menos de 300 metros. ' : `Hay ${n} zonas con denuncias a menos de 300 metros. `;
  t += `La más cercana es de ${top.cat.toLowerCase()}, a ${aDiez(top.dist)} metros. `;
  if (top.turno_critico === turno) t += `Ahora es el turno de ${turno}, cuando más casos se reportan ahí. `;
  t += 'Guarda tu celular y mantente atento.';
  return t;
}

export function hablar(texto) {
  Speech.stop();
  Speech.speak(texto, { language: 'es-US', rate: 0.95 });
}
