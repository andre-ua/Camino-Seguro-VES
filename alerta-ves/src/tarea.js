// Tarea en segundo plano (se registra al arrancar: import './src/tarea' en index.js)
import * as TaskManager from 'expo-task-manager';
import { procesarPosicion } from './alertas';

export const TAREA_GPS = 'alerta-ves-gps';

TaskManager.defineTask(TAREA_GPS, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const { latitude, longitude } = data.locations[data.locations.length - 1].coords;
  await procesarPosicion(latitude, longitude);
});
