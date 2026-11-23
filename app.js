// == MOTOR ESPACIAL Y GEOFENCING ==
const TILE_DEG = 0.005, REF_LAT = -12.30, REF_LON = -77.05;
const MIN_MOVE_M = 15, EXIT_FACTOR = 1.3, COOLDOWN_MS = 6 * 3600 * 1000;
const MAX_ALERTAS = 3, MAX_TILES = 25, M_LAT = 111320, SCORE_MINIMO = 1.5;

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
  if (s < 3) return { txt: 'Bajo', col: '#00E676', s };
  if (s < 12) return { txt: 'Medio', col: '#FFA94D', s };
  return { txt: 'Alto', col: '#FF4D6D', s };
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
    this.consultas = 0;
  }

  async cargarTile(tx, ty) {
    const k = tx + ',' + ty;
    if (this.cache.has(k)) {
      const v = this.cache.get(k);
      this.cache.delete(k);
      this.cache.set(k, v);
      return;
    }
    this.cache.set(k, await this.fuente.puntosDeTile(tx, ty));
    this.consultas++;
    while (this.cache.size > MAX_TILES) {
      this.cache.delete(this.cache.keys().next().value);
    }
  }

  async asegurarTiles(lat, lon) {
    const [tx, ty] = tileOf(lat, lon), tareas = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
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
        if (dist <= radio) out.push({ ...p, dx, dy, dist });
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

// == CATEGORÍAS Y DATOS DE RESPALDO ==
const COLORES = {
  'Robo': '#FF4D6D',
  'Hurto': '#FFA94D',
  'Extorsión': '#B388FF',
  'Homicidio / lesiones graves': '#FF1744',
  'Venta de drogas': '#00E676',
  'Estafa': '#FFEA00'
};
const color = (cat) => COLORES[cat] || '#90A4AE';

function datosDeEjemplo() {
  const C = { lat: -12.2135, lon: -76.9345 };
  const mk = (id, dx, dy, cat, total, score, turno, radio) => {
    const lat = C.lat + dy / M_LAT;
    const lon = C.lon + dx / (M_LAT * Math.cos((C.lat * Math.PI) / 180));
    const [tile_x, tile_y] = tileOf(lat, lon);
    return { id_punto: id, lat, lon, tile_x, tile_y, total, score, radio_m: radio, turno_critico: turno, cat };
  };
  return [
    mk(1, 120, 80, 'Robo', 18, 12.4, 'noche', 150),
    mk(2, -180, 150, 'Hurto', 9, 5.1, 'tarde', 100),
    mk(3, 260, -120, 'Extorsión', 6, 7.8, 'noche', 150),
    mk(4, -90, -200, 'Venta de drogas', 7, 5.9, 'madrugada', 120),
    mk(5, 40, 330, 'Robo', 22, 16.3, 'mañana', 150),
    mk(6, -310, -40, 'Estafa', 4, 1.2, 'tarde', 80),
    mk(7, 380, 160, 'Homicidio / lesiones graves', 3, 9.5, 'noche', 200),
    mk(8, -250, 300, 'Hurto', 11, 6.4, 'tarde', 100),
    mk(9, 150, -330, 'Robo', 14, 10.2, 'noche', 150),
    mk(10, -40, 20, 'Otros delitos', 3, 1.6, 'tarde', 100),
    mk(11, 330, -280, 'Hurto', 8, 4.3, 'mañana', 100),
    mk(12, -360, -260, 'Robo', 10, 8.1, 'noche', 150),
  ];
}

const REALES = Array.isArray(window.PUNTOS) && window.PUNTOS.length > 0;
const PUNTOS = REALES ? window.PUNTOS : datosDeEjemplo();

// == INTERFAZ Y SIMULADOR ==
const RADIO_VISTA = 300;
const cv = document.getElementById('radar'), ctx = cv.getContext('2d');
let motor, pos, destino = null, rumbo = 0, ocupado = false, ultimoFrame = 0, vozActiva = false;

function inicializarUI() {
  const badgeDatos = document.getElementById('estadoDatos');
  if (REALES) {
    badgeDatos.textContent = `● Conectado a SIDPOL (${PUNTOS.length} nodos reales)`;
    badgeDatos.classList.add('real');
  } else {
    badgeDatos.textContent = `○ Modo simulación (${PUNTOS.length} nodos de prueba VES)`;
  }

  const contLeyenda = document.getElementById('leyenda');
  Object.entries(COLORES).forEach(([nombre, hex]) => {
    const item = document.createElement('div');
    item.className = 'leyenda-item';
    item.innerHTML = `<span class="punto" style="background:${hex}"></span><span>${nombre}</span>`;
    contLeyenda.appendChild(item);
  });
}

function hablarAlerta(texto) {
  if (!vozActiva || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const msg = new SpeechSynthesisUtterance(texto);
  msg.lang = 'es-PE';
  msg.rate = 1.05;
  window.speechSynthesis.speak(msg);
}

function posicionInicial() {
  if (!REALES) return { lat: -12.2135 - 420 / M_LAT, lon: -76.9345 };
  const top = PUNTOS.reduce((a, b) => (b.score > a.score ? b : a));
  return { lat: top.lat - 300 / M_LAT, lon: top.lon };
}

async function reiniciar() {
  motor = new MotorAlertas(new FuenteMemoria(PUNTOS));
  pos = pos || posicionInicial();
  await motor.asegurarTiles(pos.lat, pos.lon);
  document.getElementById('avisos').innerHTML = '<li class="vacio">Aún no hay avisos. Camina hacia una zona marcada.</li>';
  motor.ultimo = null;
}

document.getElementById('reiniciar').onclick = reiniciar;

const btnVoz = document.getElementById('toggleVoz');
btnVoz.onclick = () => {
  vozActiva = !vozActiva;
  btnVoz.textContent = vozActiva ? '🔊 Voz Hermes: ON' : '🔇 Voz Hermes: OFF';
  btnVoz.classList.toggle('primario', vozActiva);
  if (vozActiva) hablarAlerta('Asistente de voz activado para Villa El Salvador.');
};

function mover(dxm, dym) {
  pos = {
    lat: pos.lat + dym / M_LAT,
    lon: pos.lon + dxm / (M_LAT * Math.cos((pos.lat * Math.PI) / 180))
  };
  rumbo = (Math.atan2(dxm, dym) * 180) / Math.PI;
}

function aMetros(ev) {
  const r = cv.getBoundingClientRect(), c = r.width / 2, esc = (c - 8) / RADIO_VISTA;
  return [((ev.clientX - r.left) - c) / esc, -((ev.clientY - r.top) - c) / esc];
}

cv.addEventListener('pointerdown', (ev) => {
  const [dx, dy] = aMetros(ev);
  destino = {
    lat: pos.lat + dy / M_LAT,
    lon: pos.lon + dx / (M_LAT * Math.cos((pos.lat * Math.PI) / 180))
  };
});

cv.addEventListener('keydown', (ev) => {
  const paso = 25;
  const m = { ArrowUp: [0, paso], ArrowDown: [0, -paso], ArrowLeft: [-paso, 0], ArrowRight: [paso, 0] }[ev.key];
  if (m) {
    ev.preventDefault();
    destino = null;
    mover(m[0], m[1]);
  }
});

function agregarAviso(p) {
  const ul = document.getElementById('avisos');
  if (ul.firstChild && ul.firstChild.classList.contains('vacio')) ul.innerHTML = '';
  const li = document.createElement('li');
  li.className = 'aviso-item';
  const hora = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  const textoAviso = `${p.cat}: ${p.total} ${p.total === 1 ? 'denuncia' : 'denuncias'} a ${p.distancia} metros`;
  li.innerHTML = `<span class="punto" style="background:${color(p.cat)}"></span><span>${textoAviso}</span><span class="dist">${hora}</span>`;
  ul.prepend(li);
  cv.classList.add('aviso');
  setTimeout(() => cv.classList.remove('aviso'), 900);
  hablarAlerta(`Precaución. Zona de ${p.cat} a ${p.distancia} metros.`);
}

async function evaluarGps() {
  if (ocupado) return;
  ocupado = true;
  try {
    const horaSimulada = parseInt(document.getElementById('turnoSim').value, 10);
    const nuevos = (await motor.onGps(pos.lat, pos.lon, Date.now(), horaSimulada)).filter((p) => p.score >= SCORE_MINIMO);
    nuevos.forEach(agregarAviso);
  } finally {
    ocupado = false;
  }
}

function dibujar() {
  const dpr = window.devicePixelRatio || 1, ancho = cv.clientWidth;
  if (cv.width !== ancho * dpr) {
    cv.width = ancho * dpr;
    cv.height = ancho * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const c = ancho / 2, esc = (c - 8) / RADIO_VISTA;
  ctx.clearRect(0, 0, ancho, ancho);

  ctx.strokeStyle = '#1D2A47';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#8392B8';
  ctx.font = '12px "Segoe UI", sans-serif';
  for (const r of [100, 200, 300]) {
    ctx.beginPath();
    ctx.arc(c, c, r * esc, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillText(r + ' m', c + 4, c - r * esc + 13);
  }

  const cercanos = motor.puntosEn(pos.lat, pos.lon, RADIO_VISTA);
  for (const p of [...cercanos].reverse()) {
    const x = c + p.dx * esc, y = c - p.dy * esc, col = color(p.cat);
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, p.radio_m * esc, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(x, y, 4 + Math.min(6, p.score / 3), 0, Math.PI * 2);
    ctx.fill();
  }

  if (destino) {
    const kx = M_LAT * Math.cos((pos.lat * Math.PI) / 180);
    const x = c + (destino.lon - pos.lon) * kx * esc;
    const y = c - (destino.lat - pos.lat) * M_LAT * esc;
    ctx.strokeStyle = '#00E5FF';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.save();
  ctx.translate(c, c);
  ctx.rotate((rumbo * Math.PI) / 180);
  ctx.fillStyle = '#00E5FF';
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(8, 9);
  ctx.lineTo(0, 5);
  ctx.lineTo(-8, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  return cercanos;
}

function actualizarPanel(cercanos) {
  const n = nivelRiesgo(cercanos), el = document.getElementById('nivel');
  el.textContent = n.txt;
  el.style.color = n.col;
  document.getElementById('nivelDetalle').textContent = 'puntaje ' + n.s.toFixed(1);

  const ul = document.getElementById('cercanos');
  ul.innerHTML = cercanos.length ? '' : '<li class="vacio">No hay zonas dentro de 300 m.</li>';
  cercanos.slice(0, 5).forEach((p) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="punto" style="background:${color(p.cat)}"></span><span>${p.cat} (${p.total}) · <i>${p.turno_critico}</i></span><span class="dist">${Math.round(p.dist)} m</span>`;
    ul.appendChild(li);
  });

  document.getElementById('fuente').textContent =
    (REALES ? `Fuente: puntos.js (${PUNTOS.length} nodos de delitos_ves.db). ` : `Fuente: datos de prueba (${PUNTOS.length} nodos). Cuando exista delitos_ves.db, corre exportar_puntos.py. `) +
    `Caché espacial: ${motor.cache.size}/${MAX_TILES} cuadrículas · ${motor.todos().length} puntos activos.`;
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
  actualizarPanel(dibujar());
  requestAnimationFrame(bucle);
}

inicializarUI();
reiniciar().then(() => requestAnimationFrame(bucle));