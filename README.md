# 🛡️ ALERTA VES · Camino-Seguro-VES

Sistema preventivo de alerta ciudadana georreferenciada para **Villa El Salvador (Lima, Perú)**. Combina datos reales normalizados de la **SIDPOL** (`data/delitos.db` con 2,264 nodos georreferenciados) con cartografía vectorial interactiva **2D y 3D** (**MapLibre GL + OpenFreeMap**, sin necesidad de API Key) y el asistente de voz **Hermes**.

---

## 🚀 Características principales

* **Mapa interactivo 2D y 3D en tiempo real:** Visualiza las calles y manzanas reales de Villa El Salvador en modo oscuro usando **OpenFreeMap**, con alternancia instantánea entre vista plana (**2D**) y perspectiva con edificios extruidos (**3D**).
* **Base de datos real SIDPOL VES:** Procesa y agrupa espacialmente los registros de `data/delitos.db` mediante `exportar_puntos.py` para proyectar 2,264 nodos de riesgo clasificados por categoría delictiva.
* **Geofencing y cálculo geodésico (Haversine):** Evalúa el nivel de riesgo (*BAJO, MEDIO, ALTO*) dentro de un radio dinámico de **150 metros** alrededor del ciudadano mediante cuadrículas espaciales (`0.005°`) con caché LRU.
* **Asistente de voz Hermes y reporte ciudadano:** Emite alertas auditivas preventivas al ingresar a zonas críticas según el horario (*mañana, tarde, noche o madrugada*), permite escuchar un resumen completo del entorno y registrar reportes comunitarios en vivo.

---

## 📂 Estructura del repositorio

```text
Camino-Seguro-VES/
├── data/
│   ├── delitos.db           # Base de datos SQLite normalizada (SIDPOL Villa El Salvador)
│   └── delitos_ves.json     # Respaldo estructurado en formato JSON
├── crear_bd.py              # Script de construcción de la base de datos SQLite
├── normalizar_bd.py         # Limpieza y normalización geoespacial de registros
├── exportar_puntos.py       # Exportador de 2,264 nodos reales desde data/delitos.db hacia puntos.js
├── puntos.js                # Nodos georreferenciados listos para el mapa web
├── index.html               # Interfaz principal ALERTA VES (controles GPS, 2D/3D, reporte y resumen)
├── styles.css               # Diseño oscuro de alto contraste estilo móvil
├── app.js                   # Motor espacial, geofencing, renderizado MapLibre 2D/3D y voz Hermes
└── README.md                # Documentación del proyecto