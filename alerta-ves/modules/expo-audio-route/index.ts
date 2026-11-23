import { requireNativeModule } from 'expo';

export type Ruta = 'wired' | 'bluetooth' | 'none';

let Nativo: any = null;
try {
  Nativo = requireNativeModule('ExpoAudioRoute');
} catch {
  Nativo = null; // build sin el módulo: se comporta como "sin audífonos"
}

export function obtenerRuta(): Ruta {
  try {
    return Nativo ? (Nativo.getRoute() as Ruta) : 'none';
  } catch {
    return 'none';
  }
}

export function hayAudifonos(): boolean {
  return obtenerRuta() !== 'none';
}
