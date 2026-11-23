"""
Motor de alertas por proximidad (idea tipo Pokémon GO) sobre delitos_ves.db
Se puede portar casi línea por línea a Kotlin / Dart / JS.

Ideas de optimización:
 1. TILES: el mundo se parte en cuadrículas de ~550 m. El celular solo tiene en memoria
    el tile donde está + los 8 vecinos (3x3). Al cruzar de tile se descarga el nuevo
    borde y se descarta lo lejano (LRU).
 2. PREFETCH: si el usuario se acerca al borde del tile, se pide el siguiente antes de llegar.
 3. THROTTLE: el GPS no se evalúa en cada lectura; solo si se movió >= MIN_MOVE_M.
 4. PRE-FILTRO: primero caja (R-tree / bbox, barato), después Haversine solo a los pocos que pasan.
 5. HISTÉRESIS + COOLDOWN: aviso al entrar al radio; no se repite hasta salir (radio*1.3)
    y pasado un tiempo, para no spamear ni gastar batería/notificaciones.
 6. PRIORIDAD: máximo MAX_ALERTAS por aviso, ordenados por score (y boost si coincide el turno).
"""
import sqlite3, math, time
from collections import OrderedDict

TILE_DEG, TILE_REF_LAT, TILE_REF_LON = 0.005, -12.30, -77.05
MIN_MOVE_M, EXIT_FACTOR, COOLDOWN_S, MAX_ALERTAS, MAX_TILES_CACHE = 15, 1.3, 6*3600, 3, 25
M_LAT = 111_320.0

def haversine(la1, lo1, la2, lo2):
    R = 6371000.0
    p1, p2 = math.radians(la1), math.radians(la2)
    dp, dl = p2-p1, math.radians(lo2-lo1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(a))

def tile_of(lat, lon):
    return int((lon-TILE_REF_LON)//TILE_DEG), int((lat-TILE_REF_LAT)//TILE_DEG)

def turno_de(hora):
    return "madrugada" if hora < 6 else "mañana" if hora < 12 else "tarde" if hora < 18 else "noche"

class MotorAlertas:
    def __init__(self, db_path):
        self.con = sqlite3.connect(db_path)     # en el celular: la BD local o la API del servidor
        self.cache = OrderedDict()               # (tx,ty) -> lista de puntos
        self.ultimo = None                       # última posición evaluada
        self.dentro = set()                      # puntos en los que ya "entró" (histéresis)
        self.ultima_alerta = {}                  # id_punto -> timestamp (cooldown)
        self.tiles_descargados = 0

    # ---- 1) carga de tiles
    def _cargar_tile(self, tx, ty):
        if (tx, ty) in self.cache:
            self.cache.move_to_end((tx, ty)); return
        filas = self.con.execute("""SELECT id_punto,lat,lon,total,score,radio_m,turno_critico,
              (SELECT nombre FROM categoria_alerta WHERE id_categoria=id_categoria_principal)
              FROM punto_riesgo WHERE tile_x=? AND tile_y=?""", (tx, ty)).fetchall()
        self.cache[(tx, ty)] = filas
        self.tiles_descargados += 1
        while len(self.cache) > MAX_TILES_CACHE:
            self.cache.popitem(last=False)

    def _asegurar_tiles(self, lat, lon):
        tx, ty = tile_of(lat, lon)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                self._cargar_tile(tx+dx, ty+dy)
        # prefetch anticipado si estoy en el 20% del borde (cubre el anillo siguiente)
        fx = ((lon-TILE_REF_LON) % TILE_DEG)/TILE_DEG
        fy = ((lat-TILE_REF_LAT) % TILE_DEG)/TILE_DEG
        if fx < .2: [self._cargar_tile(tx-2, ty+d) for d in (-1,0,1)]
        if fx > .8: [self._cargar_tile(tx+2, ty+d) for d in (-1,0,1)]
        if fy < .2: [self._cargar_tile(tx+d, ty-2) for d in (-1,0,1)]
        if fy > .8: [self._cargar_tile(tx+d, ty+2) for d in (-1,0,1)]

    # ---- 2) evaluación de una lectura GPS
    def on_gps(self, lat, lon, ahora=None, hora_local=None):
        ahora = ahora or time.time()
        if self.ultimo and haversine(*self.ultimo, lat, lon) < MIN_MOVE_M:
            return []                                    # throttle: casi no me moví
        self.ultimo = (lat, lon)
        self._asegurar_tiles(lat, lon)

        turno = turno_de(hora_local if hora_local is not None else time.localtime().tm_hour)
        candidatos, dlat = [], 300/M_LAT                 # caja de 300 m (máx radio 200 m * 1.3)
        dlon = 300/(M_LAT*math.cos(math.radians(lat)))
        for pts in self.cache.values():
            for (pid, pla, plo, total, score, radio, tcrit, cat) in pts:
                if abs(pla-lat) > dlat or abs(plo-lon) > dlon:   # pre-filtro barato
                    continue
                d = haversine(lat, lon, pla, plo)
                if d <= radio:
                    if pid not in self.dentro and ahora - self.ultima_alerta.get(pid, 0) > COOLDOWN_S:
                        prioridad = score * (1.5 if tcrit == turno else 1.0)
                        candidatos.append((prioridad, round(d), pid, cat, total, tcrit))
                elif d > radio*EXIT_FACTOR:
                    self.dentro.discard(pid)             # salió: puede volver a avisar luego
        candidatos.sort(reverse=True)
        out = candidatos[:MAX_ALERTAS]
        for _, d, pid, *_ in out:
            self.dentro.add(pid); self.ultima_alerta[pid] = ahora
        return out

if __name__ == "__main__":
    m = MotorAlertas("delitos_ves.db")
    # simulación: caminata de ~2 km cruzando VES (un punto cada ~20 m)
    lat, lon, t0, avisos, lecturas = -12.2250, -76.9450, 1_800_000_000, 0, 0
    for i in range(100):
        lat += 0.00012; lon += 0.00014; lecturas += 1
        r = m.on_gps(lat, lon, ahora=t0+i*15, hora_local=21)
        for prio, d, pid, cat, total, tc in r:
            avisos += 1
            print(f"[{i:03d}] ⚠ {cat} a {d} m ({total} denuncias, turno crítico: {tc}) prioridad={prio:.1f}")
    print(f"\nlecturas GPS: {lecturas} | avisos: {avisos} | tiles descargados: {m.tiles_descargados} | en memoria: {len(m.cache)}")
