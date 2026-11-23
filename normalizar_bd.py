import sqlite3
import unicodedata


def limpiar_texto(valor):
    if not valor:
        return ""
    sin_tilde = "".join(
        c
        for c in unicodedata.normalize("NFD", str(valor).lower())
        if unicodedata.category(c) != "Mn"
    )
    return " ".join(sin_tilde.split())


def clasificar_delito(tipo_hecho, subtipo_hecho, modalidad_hecho):
    subtipo = limpiar_texto(subtipo_hecho)
    texto_completo = (
        f"{limpiar_texto(tipo_hecho)} {subtipo} {limpiar_texto(modalidad_hecho)}"
    )

    if "extorsion" in subtipo or "extorsion" in texto_completo:
        return "extorsion", "morado"
    if "estafa" in subtipo or "estafa" in texto_completo:
        return "estafa", "amarillo"
    if (
        "robo" in subtipo
        or "robo" in texto_completo
        or "homicidio" in subtipo
        or "homicidio" in texto_completo
    ):
        return "robo", "rojo"
    if "hurto" in subtipo or "hurto" in texto_completo:
        return "hurto", "naranja"
    return None, None


conn = sqlite3.connect("data/delitos.db")
cur = conn.cursor()

columnas = [
    col[1] for col in cur.execute("PRAGMA table_info(delitos)").fetchall()
]
if "categoria_delito" not in columnas:
    cur.execute("ALTER TABLE delitos ADD COLUMN categoria_delito TEXT")
if "color_mapa" not in columnas:
    cur.execute("ALTER TABLE delitos ADD COLUMN color_mapa TEXT")

registros = cur.execute("""
    SELECT rowid, tipo_hecho, subtipo_hecho, modalidad_hecho
    FROM delitos
""").fetchall()

ids_validos = []
for rowid, tipo_h, subtipo_h, mod_h in registros:
    categoria, color = clasificar_delito(tipo_h, subtipo_h, mod_h)
    if categoria:
        cur.execute(
            """
            UPDATE delitos
            SET categoria_delito = ?, color_mapa = ?
            WHERE rowid = ?
            """,
            (categoria, color, rowid),
        )
        ids_validos.append(rowid)

if ids_validos:
    placeholders = ",".join("?" for _ in ids_validos)
    cur.execute(
        f"DELETE FROM delitos WHERE rowid NOT IN ({placeholders})", ids_validos
    )
else:
    cur.execute("DELETE FROM delitos")

conn.commit()

print("--- RESUMEN NORMALIZADO ---")
for fila in cur.execute("""
    SELECT categoria_delito, color_mapa, COUNT(*)
    FROM delitos
    GROUP BY categoria_delito, color_mapa
    ORDER BY COUNT(*) DESC
"""):
    print(fila)

total = cur.execute("SELECT COUNT(*) FROM delitos").fetchone()[0]
print("Total registros finales en delitos.db:", total)

conn.close()