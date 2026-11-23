// == MOTOR ESPACIAL Y GEOFENCING ==
const TILE_DEG = 0.005, REF_LAT = -12.30, REF_LON = -77.05;
const MIN_MOVE_M = 15, EXIT_FACTOR = 1.3, COOLDOWN_MS = 6 * 3600 * 1000;
const MAX_ALERTAS = 3, MAX_TILES = 36, M_LAT = 111320, SCORE_MINIMO = 1.5;

function haversine(la1, lo1, la2, lo2) {
  const R = 6371000, rad = (x) => (x * Math.PI) / 180;
  const dp = rad(la2 - la1), dl = rad(lo2 - lo1);
  const a = Math.sin(dp / 2) ** 2 + Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const tileOf = (lat, lon) => [
  Math.floor((lon - REF_LON) / TILE_DEG),
  Math.floor((lat - REF_LAT) / TILE_DEG)
];

const turnoDe = (h) => (h < 6 ? 'madrugada' : h < 12 ? 'mañana' : h < 18 ? 'tarde' : 'noche');

function nivelRiesgo(puntos) {
  const s = puntos.filter((p) => p.dist <= 150).reduce((a, p) => a + p.score, 0);
  if (s < 3) return { txt: 'BAJO', col: '#00E676', s };
  if (s < 12) return { txt: 'MEDIO', col: '#FFA94D', s };
  return { txt: 'ALTO', col: '#FF4D6D', s };
}

class FuenteMemoria {
  constructor(puntos) {
    this.porTile = new Map();
    for (const p of puntos) {
      const k = p.tile_x + ',' + p.tile_y;
      if (!this.porTile.has(k)) this.porTile.set(k, []);
      this.porTile.get(k).push(p);
    }
  }
  async puntosDeTile(tx, ty) {
    return this.porTile.get(tx + ',' + ty) || [];
  }
}

class MotorAlertas {
  constructor(fuente) {
    this.fuente = fuente;
    this.cache = new Map();
    this.ultimo = null;
    this.dentro = new Set();
    this.ultimaAlerta = new Map();
  }

  async cargarTile(tx, ty) {
    const k = tx + ',' + ty;
    if (this.cache.has(k)) return;
    this.cache.set(k, await this.fuente.puntosDeTile(tx, ty));
    while (this.cache.size > MAX_TILES) {
      this.cache.delete(this.cache.keys().next().value);
    }
  }

  async asegurarTiles(lat, lon) {
    const [tx, ty] = tileOf(lat, lon), tareas = [];
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        tareas.push(this.cargarTile(tx + dx, ty + dy));
      }
    }
    await Promise.all(tareas);
  }

  todos() {
    const out = [];
    for (const pts of this.cache.values()) out.push(...pts);
    return out;
  }

  puntosEn(lat, lon, radio) {
    const kx = M_LAT * Math.cos((lat * Math.PI) / 180), out = [];
    for (const pts of this.cache.values()) {
      for (const p of pts) {
        const dx = (p.lon - lon) * kx, dy = (p.lat - lat) * M_LAT;
        if (Math.abs(dx) > radio || Math.abs(dy) > radio) continue;
        const dist = Math.hypot(dx, dy);
        if (dist <= radio) out.push({ ...p, dist });
      }
    }
    return out.sort((a, b) => a.dist - b.dist);
  }

  async onGps(lat, lon, ahora = Date.now(), hora = new Date().getHours()) {
    if (this.ultimo && haversine(this.ultimo[0], this.ultimo[1], lat, lon) < MIN_MOVE_M) return [];
    this.ultimo = [lat, lon];
    await this.asegurarTiles(lat, lon);
    const turno = turnoDe(hora), cand = [];
    for (const pts of this.cache.values()) {
      for (const p of pts) {
        const d = haversine(lat, lon, p.lat, p.lon);
        if (d <= p.radio_m) {
          if (!this.dentro.has(p.id_punto) && ahora - (this.ultimaAlerta.get(p.id_punto) || 0) > COOLDOWN_MS) {
            cand.push({
              ...p,
              distancia: Math.round(d),
              prioridad: p.score * (p.turno_critico === turno ? 1.5 : 1)
            });
          }
        } else if (d > p.radio_m * EXIT_FACTOR) {
          this.dentro.delete(p.id_punto);
        }
      }
    }
    cand.sort((a, b) => b.prioridad - a.prioridad);
    const out = cand.slice(0, MAX_ALERTAS);
    out.forEach((p) => {
      this.dentro.add(p.id_punto);
      this.ultimaAlerta.set(p.id_punto, ahora);
    });
    return out;
  }
}

// == CATEGORÍAS Y DATOS ==
const COLORES = {
  'Robo': '#FF4D6D',
  'Hurto': '#FFA94D',
  'Extorsión': '#B388FF',
  'Homicidio / lesiones graves': '#FF1744',
  'Venta de drogas': '#00E676',
  'Estafa': '#FFEA00',
  'Otros delitos': '#90A4AE'
};
const color = (cat) => COLORES[cat] || '#90A4AE';

const REALES = Array.isArray(window.PUNTOS) && window.PUNTOS.length > 0;
const PUNTOS = REALES ? window.PUNTOS : [];

// == MAPA OPENFREEMAP (2D + EDIFICIOS 3D REALES SIN API KEY) ==
let mapa, marcadorUsuario, mapaListo = false, modo3D = false;
let motor, pos, destino = null, ocupado = false, ultimoFrame = 0, vozActiva = false;
let reportesComunidad = 0, ultimosCercanos = [];

function hablar(texto, forzar = false) {
  if (!vozActiva && !forzar) return;
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const msg = new SpeechSynthesisUtterance(texto);
  msg.lang = 'es-PE';
  msg.rate = 1.04;
  window.speechSynthesis.speak(msg);
}

function geoJsonCirculo(lon, lat, radioM = 150, pasos = 64) {
  const coords = [];
  const kx = M_LAT * Math.cos((lat * Math.PI) / 180);
  for (let i = 0; i <= pasos; i++) {
    const ang = (i / pasos) * Math.PI * 2;
    coords.push([
      lon + (Math.cos(ang) * radioM) / kx,
      lat + (Math.sin(ang) * radioM) / M_LAT
    ]);
  }
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } }]
  };
}

function geoJsonNodos(lista) {
  return {
    type: 'FeatureCollection',
    features: lista.map((p) => ({
      type: 'Feature',
      properties: {
        cat: p.cat,
        total: p.total,
        turno_critico: p.turno_critico,
        color: color(p.cat)
      },
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] }
    }))
  };
}

function agregarEdificios3D() {
  const estilo = mapa.getStyle();
  if (!estilo || !estilo.layers) return;

  // Buscar la fuente vectorial de OpenFreeMap (usualmente 'openmaptiles')
  const capaEdificios = estilo.layers.find(
    (l) => l['source-layer'] === 'building' && l.source
  );
  if (!capaEdificios || mapa.getLayer('edificios-3d')) return;

  const capaTexto = estilo.layers.find((l) => l.type === 'symbol');

  mapa.addLayer(
    {
      id: 'edificios-3d',
      source: capaEdificios.source,
      'source-layer': 'building',
      type: 'fill-extrusion',
      minzoom: 14.5,
      paint: {
        'fill-extrusion-color': '#18243E',
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.82
      }
    },
    capaTexto ? capaTexto.id : undefined
  );
}

function inicializarMapa() {
  const centroInicial = REALES
    ? { lat: PUNTOS[0].lat, lon: PUNTOS[0].lon }
    : { lat: -12.2135, lon: -76.9345 };

  pos = { ...centroInicial };

  mapa = new maplibregl.Map({
    container: 'mapa',
    style: 'https://tiles.openfreemap.org/styles/dark',
    center: [pos.lon, pos.lat],
    zoom: 16,
    pitch: 0,
    bearing: 0,
    attributionControl: false
  });

  mapa.on('load', () => {
    agregarEdificios3D();

    mapa.addSource('radio-150', {
      type: 'geojson',
      data: geoJsonCirculo(pos.lon, pos.lat, 150)
    });

    mapa.addLayer({
      id: 'radio-150-relleno',
      type: 'fill',
      source: 'radio-150',
      paint: { 'fill-color': '#00E5FF', 'fill-opacity': 0.12 }
    });

    mapa.addLayer({
      id: 'radio-150-borde',
      type: 'line',
      source: 'radio-150',
      paint: { 'line-color': '#00E5FF', 'line-width': 1.8, 'line-opacity': 0.65 }
    });

    mapa.addSource('nodos-delitos', {
      type: 'geojson',
      data: geoJsonNodos(motor ? motor.todos() : [])
    });

    mapa.addLayer({
      id: 'nodos-capa',
      type: 'circle',
      source: 'nodos-delitos',
      paint: {
        'circle-radius': 7.5,
        'circle-color': ['get', 'color'],
        'circle-stroke-width': 2.2,
        'circle-stroke-color': '#FFFFFF',
        'circle-pitch-alignment': 'viewport'
      }
    });

    mapa.on('click', 'nodos-capa', (e) => {
      e.originalEvent.cancelBubble = true;
      const props = e.features[0].properties;
      new maplibregl.Popup()
        .setLngLat(e.features[0].geometry.coordinates)
        .setHTML(`<b>${props.cat}</b><br>${props.total} denuncia(s) registradas<br>Turno crítico: <i>${props.turno_critico}</i>`)
        .addTo(mapa);
    });

    mapa.on('mouseenter', 'nodos-capa', () => { mapa.getCanvas().style.cursor = 'pointer'; });
    mapa.on('mouseleave', 'nodos-capa', () => { mapa.getCanvas().style.cursor = ''; });

    mapaListo = true;
    renderizarNodosVisibles();
  });

  const elPin = document.createElement('div');
  elPin.className = 'usuario-pin';
  marcadorUsuario = new maplibregl.Marker({ element: elPin })
    .setLngLat([pos.lon, pos.lat])
    .addTo(mapa);

  mapa.on('click', (e) => {
    if (e.originalEvent.cancelBubble) return;
    destino = { lat: e.lngLat.lat, lon: e.lngLat.lng };
  });

  document.getElementById('btnGps').onclick = () => {
    mapa.easeTo({ center: [pos.lon, pos.lat], zoom: 16.3, duration: 600 });
  };

  const btn3d = document.getElementById('btn3d');
  if (btn3d) {
    btn3d.onclick = () => {
      modo3D = !modo3D;
      btn3d.textContent = modo3D ? '2D' : '3D';
      btn3d.classList.toggle('activo', modo3D);
      mapa.easeTo({
        pitch: modo3D ? 55 : 0,
        bearing: modo3D ? -18 : 0,
        duration: 650
      });
    };
  }

  document.getElementById('btnZoomIn').onclick = () => mapa.zoomIn();
  document.getElementById('btnZoomOut').onclick = () => mapa.zoomOut();
}

function renderizarNodosVisibles() {
  if (!mapaListo || !motor) return;
  const fuente = mapa.getSource('nodos-delitos');
  if (fuente) fuente.setData(geoJsonNodos(motor.todos()));
}

function inicializarUI() {
  const badgeDatos = document.getElementById('estadoDatos');
  if (REALES) {
    badgeDatos.textContent = `● SIDPOL (${PUNTOS.length} nodos)`;
    badgeDatos.classList.add('real');
  } else {
    badgeDatos.textContent = '○ Sin puntos.js (corre exportar_puntos.py)';
  }

  const contLeyenda = document.getElementById('leyenda');
  Object.entries(COLORES).forEach(([nombre, hex]) => {
    const item = document.createElement('div');
    item.className = 'leyenda-item';
    item.innerHTML = `<span class="punto" style="background:${hex}"></span><span>${nombre}</span>`;
    contLeyenda.appendChild(item);
  });

  document.getElementById('btnReportar').onclick = () => {
    reportesComunidad++;
    document.getElementById('pillComunidad').textContent = `Comunidad: ${reportesComunidad}`;
    const nuevo = {
      id_punto: Date.now(),
      lat: pos.lat,
      lon: pos.lon,
      tile_x: tileOf(pos.lat, pos.lon)[0],
      tile_y: tileOf(pos.lat, pos.lon)[1],
      total: 1,
      score: 4.5,
      radio_m: 150,
      turno_critico: turnoDe(new Date().getHours()),
      cat: 'Robo'
    };
    PUNTOS.push(nuevo);
    motor = new MotorAlertas(new FuenteMemoria(PUNTOS));
    motor.asegurarTiles(pos.lat, pos.lon).then(renderizarNodosVisibles);
    hablar('Reporte ciudadano registrado en tu ubicación actual.', true);
  };

  document.getElementById('btnResumen').onclick = () => {
    const n = nivelRiesgo(ultimosCercanos);
    if (!ultimosCercanos.length) {
      hablar('Nivel de riesgo bajo. No se registran denuncias a menos de 300 metros.', true);
      return;
    }
    const top = ultimosCercanos.slice(0, 3)
      .map((p) => `${p.cat}, ${p.total} denuncias a ${Math.round(p.dist)} metros`)
      .join('. ');
    hablar(`Riesgo en tu zona: ${n.txt}. Lo más cercano: ${top}.`, true);
  };
}

async function reiniciar() {
  motor = new MotorAlertas(new FuenteMemoria(PUNTOS));
  await motor.asegurarTiles(pos.lat, pos.lon);
  renderizarNodosVisibles();
  document.getElementById('avisos').innerHTML = '<li class="vacio">Haz clic en cualquier calle del mapa para caminar.</li>';
  motor.ultimo = null;
}

document.getElementById('reiniciar').onclick = reiniciar;

const btnVoz = document.getElementById('toggleVoz');
btnVoz.onclick = () => {
  vozActiva = !vozActiva;
  btnVoz.textContent = vozActiva ? '🔊 Hermes: ON' : '🔇 Hermes: OFF';
  btnVoz.classList.toggle('primario', vozActiva);
  if (vozActiva) hablar('Asistente Hermes activado.');
};

window.addEventListener('keydown', (ev) => {
  const paso = 25;
  const m = { ArrowUp: [0, paso], ArrowDown: [0, -paso], ArrowLeft: [-paso, 0], ArrowRight: [paso, 0] }[ev.key];
  if (m) {
    ev.preventDefault();
    destino = null;
    mover(m[0], m[1]);
  }
});

function mover(dxm, dym) {
  pos = {
    lat: pos.lat + dym / M_LAT,
    lon: pos.lon + dxm / (M_LAT * Math.cos((pos.lat * Math.PI) / 180))
  };
  marcadorUsuario.setLngLat([pos.lon, pos.lat]);
  if (mapaListo) {
    const f = mapa.getSource('radio-150');
    if (f) f.setData(geoJsonCirculo(pos.lon, pos.lat, 150));
  }
}

function agregarAviso(p) {
  const ul = document.getElementById('avisos');
  if (ul.firstChild && ul.firstChild.classList.contains('vacio')) ul.innerHTML = '';
  const li = document.createElement('li');
  li.className = 'aviso-item';
  const hora = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  const textoAviso = `${p.cat} · ${p.total} denuncia(s) · ${p.distancia} m`;
  li.innerHTML = `<span class="punto" style="background:${color(p.cat)}"></span><span>${textoAviso}</span><span class="dist">${hora}</span>`;
  ul.prepend(li);
  const caja = document.getElementById('cajaMapa');
  caja.classList.add('aviso');
  setTimeout(() => caja.classList.remove('aviso'), 900);
  hablar(`Precaución. ${p.cat} a ${p.distancia} metros.`);
}

async function evaluarGps() {
  if (ocupado) return;
  ocupado = true;
  try {
    const horaSimulada = parseInt(document.getElementById('turnoSim').value, 10);
    const antes = motor.cache.size;
    const nuevos = (await motor.onGps(pos.lat, pos.lon, Date.now(), horaSimulada)).filter((p) => p.score >= SCORE_MINIMO);
    if (motor.cache.size !== antes) renderizarNodosVisibles();
    nuevos.forEach(agregarAviso);
  } finally {
    ocupado = false;
  }
}

function actualizarPanel() {
  const cercanos = motor.puntosEn(pos.lat, pos.lon, 300);
  ultimosCercanos = cercanos;
  const n = nivelRiesgo(cercanos);

  const el = document.getElementById('nivel');
  el.textContent = n.txt;
  el.style.color = n.col;
  document.getElementById('nivelDetalle').textContent = `(puntaje ${n.s.toFixed(1)})`;

  const pillRiesgo = document.getElementById('pillRiesgo');
  pillRiesgo.textContent = `RIESGO ${n.txt}`;
  pillRiesgo.style.color = n.col;
  pillRiesgo.style.borderColor = n.col;

  const ul = document.getElementById('cercanos');
  ul.innerHTML = cercanos.length ? '' : '<li class="vacio">Sin denuncias registradas en 300 m.</li>';
  cercanos.slice(0, 3).forEach((p) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="punto" style="background:${color(p.cat)}"></span><span>${p.cat} · ${p.total} denuncia(s) · ${Math.round(p.dist)} m</span>`;
    ul.appendChild(li);
  });

  document.getElementById('fuente').textContent =
    `Base SIDPOL VES: ${PUNTOS.length} nodos cargados · ${motor.todos().length} visibles en cuadrículas activas.`;
}

function bucle(t) {
  const dt = Math.min(0.1, (t - ultimoFrame) / 1000 || 0);
  ultimoFrame = t;
  if (destino) {
    const v = parseFloat(document.getElementById('vel').value);
    const kx = M_LAT * Math.cos((pos.lat * Math.PI) / 180);
    const dx = (destino.lon - pos.lon) * kx, dy = (destino.lat - pos.lat) * M_LAT, d = Math.hypot(dx, dy);
    if (d < 3) {
      destino = null;
    } else {
      const paso = Math.min(d, v * dt);
      mover((dx / d) * paso, (dy / d) * paso);
    }
  }
  evaluarGps();
  actualizarPanel();
  requestAnimationFrame(bucle);
}

inicializarMapa();
inicializarUI();
reiniciar().then(() => requestAnimationFrame(bucle));