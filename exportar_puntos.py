
import json, sqlite3, sys, os

DB  = sys.argv[1] if len(sys.argv) > 1 else "delitos_ves.db"
OUT = sys.argv[2] if len(sys.argv) > 2 else "puntos.js"

CONTRATO = {
    "punto_riesgo": ["id_punto", "lat", "lon", "tile_x", "tile_y", "total", "score",
                     "id_categoria_principal", "radio_m", "turno_critico"],
    "categoria_alerta": ["id_categoria", "nombre", "es_publicable"],
}

if not os.path.exists(DB):
    sys.exit(f"No encuentro {DB}. Pasa la ruta: python exportar_puntos.py ruta/delitos_ves.db")

con = sqlite3.connect(DB)
errores = []
for tabla, columnas in CONTRATO.items():
    existentes = [r[1] for r in con.execute(f"PRAGMA table_info({tabla})")]
    if not existentes:
        errores.append(f"falta la tabla {tabla}")
        continue
    faltan = [c for c in columnas if c not in existentes]
    if faltan:
        errores.append(f"a la tabla {tabla} le faltan las columnas: {', '.join(faltan)}")
if errores:
    sys.exit("La base no cumple el contrato:\n - " + "\n - ".join(errores))

filas = con.execute("""
    SELECT p.id_punto, p.lat, p.lon, p.tile_x, p.tile_y, p.total, p.score,
           p.radio_m, p.turno_critico, c.nombre
      FROM punto_riesgo p
      JOIN categoria_alerta c ON c.id_categoria = p.id_categoria_principal
     WHERE c.es_publicable = 1          -- privacidad: no se exporta violencia familiar ni menores
""").fetchall()

puntos = [dict(id_punto=i, lat=round(la, 6), lon=round(lo, 6), tile_x=tx, tile_y=ty,
               total=t, score=round(s, 2), radio_m=r, turno_critico=tc, cat=cat)
          for i, la, lo, tx, ty, t, s, r, tc, cat in filas]

with open(OUT, "w", encoding="utf-8") as f:
    f.write("// Generado por exportar_puntos.py. No editar a mano.\n")
    f.write("window.PUNTOS = " + json.dumps(puntos, ensure_ascii=False) + ";\n")

print(f"Listo: {len(puntos)} puntos de riesgo exportados a {OUT}")