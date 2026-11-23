// Port a JavaScript de alerta_demo.py (mismo algoritmo de tiles + geofence)
const TILE_DEG = 0.005, REF_LAT = -12.30, REF_LON = -77.05;
const MIN_MOVE_M = 15, EXIT_FACTOR = 1.3, COOLDOWN_MS = 6 * 3600 * 1000;
const MAX_ALERTAS = 3, MAX_TILES = 25, M_LAT = 111320;

export function haversine(la1, lo1, la2, lo2) {
  const R = 6371000, rad = (x) => (x * Math.PI) / 180;
  const dp = rad(la2 - la1), dl = rad(lo2 - lo1);
  const a = Math.sin(dp / 2) ** 2 +
    Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
const tileOf = (lat, lon) => [
  Math.floor((lon - REF_LON) / TILE_DEG),
  Math.floor((lat - REF_LAT) / TILE_DEG),
];
const turnoDe = (h) => (h < 6 ? 'madrugada' : h < 12 ? 'mañana' : h < 18 ? 'tarde' : 'noche');

export class MotorAlertas {
  constructor(db) {
    this.db = db;                 // instancia de expo-sqlite
    this.cache = new Map();       // "tx,ty" -> puntos (Map conserva orden = LRU simple)
    this.ultimo = null;
    this.dentro = new Set();
    this.ultimaAlerta = new Map();
    this.tilesDescargados = 0;
  }

  async cargarTile(tx, ty) {
    const k = `${tx},${ty}`;
    if (this.cache.has(k)) {
      const v = this.cache.get(k); this.cache.delete(k); this.cache.set(k, v); return;
    }
    const filas = await this.db.getAllAsync(
      `SELECT p.id_punto, p.lat, p.lon, p.total, p.score, p.radio_m, p.turno_critico, c.nombre AS cat
         FROM punto_riesgo p JOIN categoria_alerta c ON c.id_categoria = p.id_categoria_principal
        WHERE p.tile_x = ? AND p.tile_y = ?`, [tx, ty]);
    this.cache.set(k, filas);
    this.tilesDescargados++;
    while (this.cache.size > MAX_TILES) this.cache.delete(this.cache.keys().next().value);
  }

  async asegurarTiles(lat, lon) {
    const [tx, ty] = tileOf(lat, lon);
    const tareas = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) tareas.push(this.cargarTile(tx + dx, ty + dy));
    // prefetch cerca del borde
    const fx = ((lon - REF_LON) % TILE_DEG) / TILE_DEG, fy = ((lat - REF_LAT) % TILE_DEG) / TILE_DEG;
    for (const d of [-1, 0, 1]) {
      if (fx < 0.2) tareas.push(this.cargarTile(tx - 2, ty + d));
      if (fx > 0.8) tareas.push(this.cargarTile(tx + 2, ty + d));
      if (fy < 0.2) tareas.push(this.cargarTile(tx + d, ty - 2));
      if (fy > 0.8) tareas.push(this.cargarTile(tx + d, ty + 2));
    }
    await Promise.all(tareas);
  }

  /** Todos los puntos cargados en memoria (para dibujarlos en el mapa). */
  todos() {
    const out = [];
    for (const pts of this.cache.values()) out.push(...pts);
    return out;
  }

  /** Puntos de riesgo dentro de `radio` metros (para dibujar el radar). Requiere asegurarTiles() antes. */
  puntosEn(lat, lon, radio) {
    const kx = M_LAT * Math.cos((lat * Math.PI) / 180);
    const out = [];
    for (const pts of this.cache.values()) {
      for (const p of pts) {
        const dx = (p.lon - lon) * kx, dy = (p.lat - lat) * M_LAT;
        if (Math.abs(dx) > radio || Math.abs(dy) > radio) continue;
        const dist = Math.hypot(dx, dy);
        if (dist <= radio) out.push({ ...p, dx, dy, dist });
      }
    }
    return out.sort((a, b) => a.dist - b.dist);
  }

  /** Llamar con cada lectura de GPS. Devuelve los avisos nuevos (máx. 3). */
  async onGps(lat, lon, ahora = Date.now(), hora = new Date().getHours()) {
    if (this.ultimo && haversine(this.ultimo[0], this.ultimo[1], lat, lon) < MIN_MOVE_M) return [];
    this.ultimo = [lat, lon];
    await this.asegurarTiles(lat, lon);

    const turno = turnoDe(hora);
    const dlat = 300 / M_LAT, dlon = 300 / (M_LAT * Math.cos((lat * Math.PI) / 180));
    const candidatos = [];
    for (const pts of this.cache.values()) {
      for (const p of pts) {
        if (Math.abs(p.lat - lat) > dlat || Math.abs(p.lon - lon) > dlon) continue; // pre-filtro
        const d = haversine(lat, lon, p.lat, p.lon);
        if (d <= p.radio_m) {
          if (!this.dentro.has(p.id_punto) && ahora - (this.ultimaAlerta.get(p.id_punto) || 0) > COOLDOWN_MS) {
            candidatos.push({ ...p, distancia: Math.round(d),
              prioridad: p.score * (p.turno_critico === turno ? 1.5 : 1) });
          }
        } else if (d > p.radio_m * EXIT_FACTOR) this.dentro.delete(p.id_punto);
      }
    }
    candidatos.sort((a, b) => b.prioridad - a.prioridad);
    const out = candidatos.slice(0, MAX_ALERTAS);
    out.forEach((p) => { this.dentro.add(p.id_punto); this.ultimaAlerta.set(p.id_punto, ahora); });
    return out;
  }
}
