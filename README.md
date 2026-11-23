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