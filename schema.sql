PRAGMA foreign_keys = ON;

-- ============ CATÁLOGOS ============
CREATE TABLE materia (
  id_materia INTEGER PRIMARY KEY,
  nombre     TEXT NOT NULL
);
CREATE TABLE tipo_hecho (
  id_tipo    INTEGER PRIMARY KEY,
  id_materia INTEGER NOT NULL REFERENCES materia(id_materia),
  nombre     TEXT NOT NULL
);
CREATE TABLE subtipo_hecho (
  id_subtipo INTEGER PRIMARY KEY,
  id_tipo    INTEGER NOT NULL REFERENCES tipo_hecho(id_tipo),
  nombre     TEXT NOT NULL
);
CREATE TABLE modalidad_hecho (
  id_modalidad INTEGER PRIMARY KEY,
  id_subtipo   INTEGER NOT NULL REFERENCES subtipo_hecho(id_subtipo),
  nombre       TEXT NOT NULL
);
CREATE TABLE comisaria (
  id_comisaria INTEGER PRIMARY KEY,
  nombre       TEXT NOT NULL,
  direccion    TEXT,
  ubigeo       INTEGER
);

-- Categorías simples para la app (lo que ve el ciudadano)
CREATE TABLE categoria_alerta (
  id_categoria INTEGER PRIMARY KEY,
  codigo       TEXT NOT NULL UNIQUE,   -- ROBO, HURTO, ...
  nombre       TEXT NOT NULL,
  peso_riesgo  REAL NOT NULL,          -- para calcular el score
  radio_m      INTEGER NOT NULL,       -- radio de aviso sugerido
  es_publicable INTEGER NOT NULL DEFAULT 1  -- 0 = NO mostrar en mapa (privacidad)
);
CREATE TABLE subtipo_categoria (
  id_subtipo   INTEGER PRIMARY KEY REFERENCES subtipo_hecho(id_subtipo),
  id_categoria INTEGER NOT NULL REFERENCES categoria_alerta(id_categoria)
);

-- ============ DATOS CRUDOS NORMALIZADOS ============
-- Una fila por denuncia (id_dgc). En el JSON una denuncia puede repetirse
-- varias veces (una fila por modalidad), por eso hay tabla puente.
CREATE TABLE denuncia (
  id_dgc            INTEGER PRIMARY KEY,
  fecha_hora_utc    TEXT NOT NULL,
  fecha_hora_local  TEXT NOT NULL,      -- UTC-5 (Perú)
  anio INTEGER NOT NULL, mes INTEGER NOT NULL, dia INTEGER NOT NULL,
  hora_local        INTEGER NOT NULL,
  turno             TEXT NOT NULL CHECK (turno IN ('madrugada','mañana','tarde','noche')),
  lat               REAL NOT NULL,
  lon               REAL NOT NULL,
  ubigeo_hecho      INTEGER,
  id_comisaria      INTEGER REFERENCES comisaria(id_comisaria),
  estado            INTEGER,
  fecha_actualizacion TEXT,
  coord_sospechosa  INTEGER NOT NULL DEFAULT 0  -- 1 = coordenada repetida masivamente (geocodificación por defecto)
);
CREATE TABLE denuncia_modalidad (
  object_id    INTEGER PRIMARY KEY,     -- OBJECTID original del JSON
  id_dgc       INTEGER NOT NULL REFERENCES denuncia(id_dgc),
  id_modalidad INTEGER NOT NULL REFERENCES modalidad_hecho(id_modalidad)
);
CREATE INDEX idx_dm_dgc ON denuncia_modalidad(id_dgc);
CREATE INDEX idx_dm_mod ON denuncia_modalidad(id_modalidad);
CREATE INDEX idx_den_fecha ON denuncia(fecha_hora_local);
CREATE INDEX idx_den_coord ON denuncia(lat, lon);

-- ============ "POKEPARADAS" (lo que consume la app) ============
-- Denuncias publicables agrupadas en celdas de ~45 m. Es lo ÚNICO que baja al celular.
CREATE TABLE punto_riesgo (
  id_punto       INTEGER PRIMARY KEY,
  lat            REAL NOT NULL,
  lon            REAL NOT NULL,
  tile_x         INTEGER NOT NULL,      -- cuadrícula de descarga (~550 m)
  tile_y         INTEGER NOT NULL,
  total          INTEGER NOT NULL,      -- denuncias en el punto
  score          REAL NOT NULL,         -- riesgo ponderado (peso * recencia)
  id_categoria_principal INTEGER REFERENCES categoria_alerta(id_categoria),
  radio_m        INTEGER NOT NULL,
  turno_critico  TEXT,                  -- turno con más casos
  ultima_fecha   TEXT
);
CREATE INDEX idx_pr_tile ON punto_riesgo(tile_x, tile_y);

-- Detalle por categoría de cada punto (para mostrar "3 robos, 2 hurtos")
CREATE TABLE punto_riesgo_categoria (
  id_punto     INTEGER NOT NULL REFERENCES punto_riesgo(id_punto),
  id_categoria INTEGER NOT NULL REFERENCES categoria_alerta(id_categoria),
  cantidad     INTEGER NOT NULL,
  PRIMARY KEY (id_punto, id_categoria)
);
CREATE TABLE punto_riesgo_turno (
  id_punto INTEGER NOT NULL REFERENCES punto_riesgo(id_punto),
  turno    TEXT NOT NULL,
  cantidad INTEGER NOT NULL,
  PRIMARY KEY (id_punto, turno)
);

-- Índice espacial R-tree (consultas por rectángulo muy rápidas)
CREATE VIRTUAL TABLE punto_riesgo_rtree USING rtree(
  id_punto, min_lon, max_lon, min_lat, max_lat
);

-- ============ APP (usuarios / notificaciones) ============
CREATE TABLE alerta_enviada (
  id_alerta  INTEGER PRIMARY KEY AUTOINCREMENT,
  id_usuario TEXT NOT NULL,
  id_punto   INTEGER NOT NULL REFERENCES punto_riesgo(id_punto),
  fecha_hora TEXT NOT NULL DEFAULT (datetime('now','-5 hours'))
);
CREATE INDEX idx_alerta_user ON alerta_enviada(id_usuario, id_punto, fecha_hora);
