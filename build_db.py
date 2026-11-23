import json, sqlite3, math, collections, os, sys
from datetime import datetime, timedelta

SRC = sys.argv[1] if len(sys.argv) > 1 else "delitos_ves.json"
DB  = sys.argv[2] if len(sys.argv) > 2 else "delitos_ves.db"
SNAP_DEG   = 0.0004     # ~44 m: celda de agrupación de "pokeparadas"
TILE_DEG   = 0.005      # ~550 m: cuadrícula de descarga
SUSP_MIN   = 50         # coordenada (4 decimales) repetida >= 50 veces = sospechosa
TILE_REF_LAT, TILE_REF_LON = -12.30, -77.05   # origen de la cuadrícula

CATEGORIAS = [  # codigo, nombre, peso, radio_m, publicable
 ("ROBO","Robo",3.0,150,1), ("HURTO","Hurto",1.5,100,1),
 ("EXTORSION","Extorsión",3.0,150,1), ("ESTAFA","Estafa",0.5,80,1),
 ("HOMICIDIO","Homicidio / lesiones graves",5.0,200,1),
 ("DROGAS","Venta de drogas",2.0,120,1),
 ("OTROS_DELITOS","Otros delitos",1.0,100,1),
 ("VIOLENCIA_FAMILIAR","Violencia familiar",0.0,0,0),   # privacidad: NO se muestra
 ("MENORES","Adolescentes infractores",1.0,100,0),
]
SUB2CAT = {10502:"ROBO",10501:"HURTO",10508:"EXTORSION",10506:"ESTAFA",10101:"HOMICIDIO",
 50701:"DROGAS",11203:"DROGAS",50402:"VIOLENCIA_FAMILIAR",50401:"VIOLENCIA_FAMILIAR",40101:"MENORES"}

def tile(lat, lon):
    return (int((lon-TILE_REF_LON)//TILE_DEG), int((lat-TILE_REF_LAT)//TILE_DEG))

data = json.load(open(SRC, encoding="utf-8"))
if os.path.exists(DB): os.remove(DB)
con = sqlite3.connect(DB)
con.executescript(open("schema.sql", encoding="utf-8").read())

# ---- catálogos
mat, tip, sub, mod, com = {}, {}, {}, {}, {}
for r in data:
    mat[r["id_materia_hecho"]] = r["materia_hecho"]
    tip[r["id_tipo_hecho"]] = (r["id_materia_hecho"], r["tipo_hecho"])
    sub[r["id_subtipo_hecho"]] = (r["id_tipo_hecho"], r["subtipo_hecho"].strip())
    mod[r["id_modalidad_hecho"]] = (r["id_subtipo_hecho"], r["modalidad_hecho"].strip())
    c = com.setdefault(r["id_comisaria_registro"], (r["comisaria_registro"].strip(), r["ubic_comisaria_registro"], r["ubigeo_cia_registro"]))
con.executemany("INSERT INTO materia VALUES (?,?)", mat.items())
con.executemany("INSERT INTO tipo_hecho VALUES (?,?,?)", [(k,*v) for k,v in tip.items()])
con.executemany("INSERT INTO subtipo_hecho VALUES (?,?,?)", [(k,*v) for k,v in sub.items()])
con.executemany("INSERT INTO modalidad_hecho VALUES (?,?,?)", [(k,*v) for k,v in mod.items()])
con.executemany("INSERT INTO comisaria VALUES (?,?,?,?)", [(k,*v) for k,v in com.items()])
con.executemany("INSERT INTO categoria_alerta(codigo,nombre,peso_riesgo,radio_m,es_publicable) VALUES (?,?,?,?,?)", CATEGORIAS)
cat_id = dict(con.execute("SELECT codigo,id_categoria FROM categoria_alerta"))
for s in sub:
    con.execute("INSERT INTO subtipo_categoria VALUES (?,?)", (s, cat_id[SUB2CAT.get(s,"OTROS_DELITOS")]))

# ---- coordenadas sospechosas
cc = collections.Counter((round(r["lat"],4), round(r["lon"],4)) for r in data)
susp = {k for k,v in cc.items() if v >= SUSP_MIN}

# ---- denuncias (1 fila por id_dgc) + puente
seen = set()
for r in data:
    if r["id_dgc"] not in seen:
        seen.add(r["id_dgc"])
        utc = datetime.fromisoformat(r["fecha_hora_registro_hecho"])
        loc = utc - timedelta(hours=5)
        con.execute("INSERT INTO denuncia VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (
            r["id_dgc"], utc.strftime("%Y-%m-%d %H:%M:%S"), loc.strftime("%Y-%m-%d %H:%M:%S"),
            loc.year, loc.month, loc.day, loc.hour, r["turno_hecho"],
            r["lat"], r["lon"], r["ubigeo_hecho_delito"], r["id_comisaria_registro"],
            r["estado"], r["fecha_actualizacion"],
            1 if (round(r["lat"],4), round(r["lon"],4)) in susp else 0))
    con.execute("INSERT INTO denuncia_modalidad VALUES (?,?,?)", (r["OBJECTID"], r["id_dgc"], r["id_modalidad_hecho"]))

# ---- puntos de riesgo (solo publicables y con coordenada confiable)
rows = con.execute("""
 SELECT d.id_dgc, d.lat, d.lon, d.turno, d.fecha_hora_local, sc.id_categoria
 FROM denuncia d
 JOIN denuncia_modalidad dm ON dm.id_dgc = d.id_dgc
 JOIN modalidad_hecho m ON m.id_modalidad = dm.id_modalidad
 JOIN subtipo_categoria sc ON sc.id_subtipo = m.id_subtipo
 JOIN categoria_alerta c ON c.id_categoria = sc.id_categoria
 WHERE c.es_publicable = 1 AND d.coord_sospechosa = 0
 GROUP BY d.id_dgc, sc.id_categoria
""").fetchall()
peso = dict(con.execute("SELECT id_categoria,peso_riesgo FROM categoria_alerta"))
radio = dict(con.execute("SELECT id_categoria,radio_m FROM categoria_alerta"))
hoy = datetime(2026,10,31)
cells = collections.defaultdict(list)
for dg, lat, lon, turno, f, ct in rows:
    cells[(round(lat/SNAP_DEG), round(lon/SNAP_DEG))].append((lat,lon,turno,f,ct))
pid = 0
for _, items in cells.items():
    pid += 1
    la = sum(i[0] for i in items)/len(items); lo = sum(i[1] for i in items)/len(items)
    cats = collections.Counter(i[4] for i in items)
    turnos = collections.Counter(i[2] for i in items)
    score = 0.0
    for _,_,_,f,ct in items:
        dias = (hoy - datetime.fromisoformat(f)).days
        score += peso[ct] * math.exp(-dias/180)    # recencia: pierde la mitad en ~125 días
    principal = max(cats, key=lambda c: (peso[c]*cats[c]))
    tx, ty = tile(la, lo)
    con.execute("INSERT INTO punto_riesgo VALUES (?,?,?,?,?,?,?,?,?,?,?)", (
        pid, la, lo, tx, ty, len(items), round(score,3), principal,
        max(radio[c] for c in cats), turnos.most_common(1)[0][0], max(i[3] for i in items)))
    con.executemany("INSERT INTO punto_riesgo_categoria VALUES (?,?,?)", [(pid,c,n) for c,n in cats.items()])
    con.executemany("INSERT INTO punto_riesgo_turno VALUES (?,?,?)", [(pid,t,n) for t,n in turnos.items()])
    con.execute("INSERT INTO punto_riesgo_rtree VALUES (?,?,?,?,?)", (pid, lo, lo, la, la))
con.commit()
for t in ["denuncia","denuncia_modalidad","punto_riesgo"]:
    print(t, con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0])
print("sospechosas:", con.execute("SELECT COUNT(*) FROM denuncia WHERE coord_sospechosa=1").fetchone()[0])
con.execute("VACUUM"); con.close()
print("OK", os.path.getsize(DB)//1024, "KB")
