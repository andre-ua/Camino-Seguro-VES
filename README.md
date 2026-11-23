# Camino-Seguro-VES
HEMOS REALIZADO UN SISTEMA DE PREVENCION DE DELITOS PARA LOS CIUDADANOS EN VILLA SALVADOR, UTILIZAMOS UNA BASE DE DATOS DE LA SIDPOL PARA CREAR LOS PUNTOS (NODOS) DE LOS DELITOS EN LAS CALLES Y VER COMO ES LA PERCEPCION DE LA SEGURIDAD DE LAS PERSONAS LLAMADA ALERTA VES 



#  Camino Seguro VES · Alerta Ciudadana

Sistema preventivo de alerta ciudadana georreferenciada para **Villa El Salvador (Lima, Perú)**, diseñado para informar en tiempo real sobre zonas con incidencia delictiva mediante análisis espacial y asistencia por voz (**Hermes**).

---

## Características principales

* **Motor espacial por cuadrículas (Tiles + Geofencing):** Divide el mapa en celdas de `0.005°` con caché LRU en memoria y cálculo geodésico (fórmula de Haversine) para evaluar riesgos en tiempo real sin saturar el dispositivo[cite: 4].
* **Alertas inteligentes por horario:** Prioriza dinámicamente las zonas según el turno del día (*mañana, tarde, noche o madrugada*) y evita notificaciones repetitivas mediante histéresis de salida y tiempos de espera (*cooldown*)[cite: 4].
* **Asistente de voz Hermes:** Notifica auditivamente al peatón cuando ingresa a un radio de riesgo, permitiendo caminar con atención en la vía pública sin necesidad de mirar constantemente la pantalla[cite: 11].
* **Privacidad desde el origen:** El script de exportación filtra estrictamente los registros (`es_publicable = 1`) para excluir denuncias sensibles (violencia familiar o menores de edad) antes de visualizarlos.

---

##  Estructura actual del repositorio

```text
Camino-Seguro-VES/
├── index.html           # Interfaz principal del radar y panel de monitoreo
├── styles.css           # Estilos visuales (tema oscuro de alto contraste)
├── app.js               # Motor espacial, geofencing, simulador y síntesis de voz Hermes
├── exportar_puntos.py   # Validador de esquema SQLite y exportador hacia puntos.js
├── prototipo.html       # Prototipo inicial (Miniavance 1)
└── README.md            # Documentación del proyecto




# Camino-Seguro-VES (Alerta VES)

Sistema preventivo de alerta ciudadana georreferenciada para **Villa El Salvador (Lima, Perú)**. Utiliza una base de datos normalizada de la **SIDPOL** (`data/delitos.db` con más de 4,000 registros georreferenciados) para generar nodos de incidencia delictiva en las calles, evaluar el nivel de riesgo en tiempo real y emitir alertas auditivas mediante el asistente de voz **Hermes**.

---

## Características principales

* **Conexión con base de datos real (SIDPOL VES):** Procesa y agrupa espacialmente los registros reales de `data/delitos.db` (`lat`, `lon`, `tipo_hecho`, `subtipo_hecho`) para construir nodos de riesgo en todo Villa El Salvador.
* **Motor espacial por cuadrículas (Tiles + Geofencing):** Divide el mapa en celdas de `0.005°` con caché LRU en memoria y cálculo geodésico (fórmula de Haversine) para detectar proximidad en tiempo real sin saturar el dispositivo.
* **Alertas inteligentes por horario:** Prioriza dinámicamente las zonas según el turno del día (*mañana, tarde, noche o madrugada*) y evita notificaciones repetitivas mediante histéresis de salida y tiempos de espera (*cooldown*).
* **Asistente de voz Hermes:** Notifica por voz al ciudadano cuando ingresa a un radio de riesgo, permitiendo caminar con atención en la vía pública sin necesidad de mirar constantemente la pantalla.

---

## Estructura del repositorio

```text
Camino-Seguro-VES/
├── data/
│   ├── delitos.db           # Base de datos SQLite normalizada (SIDPOL Villa El Salvador)
│   └── delitos_ves.json     # Respaldo estructurado en formato JSON
├── crear_bd.py              # Script de construcción de la base de datos SQLite
├── normalizar_bd.py         # Limpieza y normalización geoespacial de registros
├── exportar_puntos.py       # Exportador de nodos reales desde data/delitos.db hacia puntos.js
├── puntos.js                # Nodos georreferenciados exportados para el radar web
├── index.html               # Interfaz principal del radar y panel de monitoreo
├── styles.css               # Estilos visuales (tema oscuro de alto contraste)
├── app.js                   # Motor espacial, geofencing, simulador y síntesis de voz Hermes
└── README.md                # Documentación del proyecto