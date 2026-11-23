"""
Convierte data/delitos.db (SQLite de SIDPOL VES) en puntos.js
para que index.html muestre los registros reales agrupados por nodo.
"""
import json, math, os, sqlite3, sys

DB_PATH = sys.argv[1] if len(sys.argv) > 1 else os.path.join("data", "delitos.db")
OUT = sys.argv[2] if len(sys.argv) > 2 else "puntos.js"

TILE_DEG = 0.005
REF_LAT = -12.30
REF_LON = -77.05

def tile_of(lat, lon):
    return math.floor((lon - REF_LON) / TILE_DEG), math.floor((lat - REF_LAT) / TILE_DEG)

def normalizar_categoria(texto):
    t = str(texto or "").upper()
    if "EXTORSI" in t:
        return "Extorsión"
    if "ROBO" in t:
        return "Robo"
    if "HURTO" in t:
        return "Hurto"
    if "HOMICIDIO" in t or "LESION" in t or "SICARIATO" in t:
        return "Homicidio / lesiones graves"
    if "DROGA" in t or "MICROCOMERCIALIZACI" in t or "TID" in t:
        return "Venta de drogas"
    if "ESTAFA" in t or "DEFRAUDACI" in t:
        return "Estafa"
    return "Otros delitos"

if not os.path.exists(DB_PATH):
    sys.exit(f"No encuentro {DB_PATH}. Verifica que exista la carpeta data/delitos.db")

con = sqlite3.connect(DB_PATH)
tablas = [r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")]

puntos = []
for tabla in tablas:
    cols = [r[1].lower() for r in con.execute(f"PRAGMA table_info({tabla})")]
    if "lat" in cols and "lon" in cols:
        c_cat = "subtipo_hecho" if "subtipo_hecho" in cols else ("tipo_hecho" if "tipo_hecho" in cols else None)
        c_turno = next((c for c in ["turno", "turno_critico", "horario", "rango_horario"] if c in cols), None)

        sel_cat = c_cat if c_cat else "'ROBO'"
        sel_turno = c_turno if c_turno else "'noche'"

        filas = con.execute(f"""
            SELECT ROUND(lat, 4), ROUND(lon, 4), {sel_cat}, {sel_turno}, COUNT(*)
              FROM {tabla}
             WHERE lat IS NOT NULL AND lon IS NOT NULL
             GROUP BY ROUND(lat, 4), ROUND(lon, 4), {sel_cat}
        """).fetchall()

        for idx, (la, lo, cat_raw, turno, total) in enumerate(filas, start=1):
            tx, ty = tile_of(la, lo)
            cat = normalizar_categoria(cat_raw)
            score = round(min(25.0, total * 2.2), 2)
            radio = 150 if total >= 3 else 100
            puntos.append(dict(
                id_punto=idx,
                lat=la,
                lon=lo,
                tile_x=tx,
                tile_y=ty,
                total=total,
                score=score,
                radio_m=radio,
                turno_critico=str(turno or "noche").lower(),
                cat=cat
            ))
        break

if not puntos:
    sys.exit("No se encontraron filas con lat/lon en data/delitos.db.")

with open(OUT, "w", encoding="utf-8") as f:
    f.write("// Generado automaticamente por exportar_puntos.py desde data/delitos.db\n")
    f.write("window.PUNTOS = " + json.dumps(puntos, ensure_ascii=False) + ";\n")

print(f"Exito: {len(puntos)} nodos reales exportados a {OUT}")