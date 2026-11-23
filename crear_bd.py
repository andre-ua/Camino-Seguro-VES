import json
import sqlite3

with open("data/delitos_ves.json", "r", encoding="utf-8") as f:
    datos = json.load(f)

conn = sqlite3.connect("data/delitos.db")
cur = conn.cursor()

cur.execute("""
CREATE TABLE IF NOT EXISTS delitos (
    objectid INTEGER,
    lat REAL,
    lon REAL,
    tipo_hecho TEXT,
    subtipo_hecho TEXT,
    modalidad_hecho TEXT,
    fecha_hora TEXT,
    turno TEXT,
    comisaria TEXT
)
""")

cur.execute("DELETE FROM delitos")

filas = [
    (
        r.get("OBJECTID"),
        r.get("lat") if r.get("lat") is not None else r.get("lat_hecho"),
        r.get("lon") if r.get("lon") is not None else r.get("long_hecho"),
        r.get("tipo_hecho"),
        r.get("subtipo_hecho"),
        r.get("modalidad_hecho"),
        r.get("fecha_hora_registro_hecho"),
        r.get("turno_hecho"),
        r.get("comisaria_registro"),
    )
    for r in datos
]

cur.executemany("INSERT INTO delitos VALUES (?,?,?,?,?,?,?,?,?)", filas)
conn.commit()
conn.close()

print("Base de datos creada en data/delitos.db. Total registros:", len(filas))