"""
OPCIONAL: agrega la columna `referencia` (calle / sector) a cada punto de riesgo
usando OpenStreetMap (Nominatim). Se ejecuta UNA vez en tu PC (necesita internet).
Respeta el límite de 1 consulta por segundo (~30 min para 1,560 puntos) y se puede
detener y reanudar. Luego copia el delitos_ves.db actualizado a alerta-ves/assets
y vuelve a compilar: la referencia saldrá incluso sin internet.

Uso:  python agregar_referencias.py delitos_ves.db
"""
import json, sqlite3, sys, time, urllib.request, urllib.parse

DB = sys.argv[1] if len(sys.argv) > 1 else "delitos_ves.db"
UA = "AlertaVES/1.0 (proyecto universitario)"
con = sqlite3.connect(DB)
cols = [r[1] for r in con.execute("PRAGMA table_info(punto_riesgo)")]
if "referencia" not in cols:
    con.execute("ALTER TABLE punto_riesgo ADD COLUMN referencia TEXT")
    con.commit()

pend = con.execute("SELECT id_punto, lat, lon FROM punto_riesgo WHERE referencia IS NULL ORDER BY score DESC").fetchall()
print(f"{len(pend)} puntos por procesar")
for i, (pid, lat, lon) in enumerate(pend, 1):
    q = urllib.parse.urlencode({"format": "jsonv2", "zoom": 18, "accept-language": "es", "lat": lat, "lon": lon})
    req = urllib.request.Request(f"https://nominatim.openstreetmap.org/reverse?{q}", headers={"User-Agent": UA})
    try:
        j = json.load(urllib.request.urlopen(req, timeout=15))
        a = j.get("address", {})
        calle = a.get("road") or a.get("pedestrian") or a.get("path") or a.get("footway") or ""
        zona = a.get("neighbourhood") or a.get("suburb") or a.get("quarter") or a.get("city_district") or ""
        txt = ", ".join(x for x in (calle, zona) if x) or ", ".join(j.get("display_name", "").split(",")[:3]).strip() or "Sin dato"
        con.execute("UPDATE punto_riesgo SET referencia = ? WHERE id_punto = ?", (txt, pid))
    except Exception as e:
        print("  error en", pid, e)
    if i % 20 == 0:
        con.commit(); print(f"  {i}/{len(pend)}")
    time.sleep(1.1)
con.commit(); con.close(); print("Listo")
