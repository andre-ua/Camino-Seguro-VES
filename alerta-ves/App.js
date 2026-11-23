import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, AppState, Linking, Modal, Platform, ScrollView, StatusBar, StyleSheet, Text,
  TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Mapa from './src/Mapa';
import Radar from './src/Radar';
import { PanelAjustes, PanelDetalle, PanelResumen, T } from './src/paneles';
import PanelReportar from './src/PanelReportar';
import Clasificador from './src/Clasificador';
import Politicas, { VERSION_POLITICAS } from './src/Politicas';
import { avisoCercano, cargarRecientes, suscribir, vigente } from './src/reportes';
import { TAREA_GPS } from './src/tarea';
import { CANAL, avisarReporte, config, obtenerMotor, oyentes, procesarPosicion } from './src/alertas';
import { guardarAjuste, leerAjuste } from './src/ajustes';
import { haversine } from './src/motor';
import { hablar, nivelRiesgo, resumenSeguridad } from './src/hermes';
import { referenciaCalle } from './src/referencia';
import { obtenerRuta } from './modules/expo-audio-route';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false,
    shouldShowBanner: true, shouldShowList: true,
  }),
});

const DEMO = { lat: -12.2250, lon: -76.9450 };
const ETIQ_RUTA = { wired: 'Audífonos con cable', bluetooth: 'Audífonos Bluetooth', none: 'Sin audífonos' };
const SQL_RECIENTES = `
  SELECT d.fecha_hora_local AS fecha, d.turno AS turno, m.nombre AS modalidad
    FROM denuncia d
    JOIN denuncia_modalidad dm ON dm.id_dgc = d.id_dgc
    JOIN modalidad_hecho m ON m.id_modalidad = dm.id_modalidad
    JOIN subtipo_categoria sc ON sc.id_subtipo = m.id_subtipo
    JOIN categoria_alerta c ON c.id_categoria = sc.id_categoria
   WHERE d.coord_sospechosa = 0 AND c.es_publicable = 1
     AND d.lat BETWEEN ? AND ? AND d.lon BETWEEN ? AND ?
   ORDER BY d.fecha_hora_local DESC LIMIT 5`;

function Pantalla() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [pos, setPos] = useState(null);
  const [heading, setHeading] = useState(0);
  const [cercanos, setCercanos] = useState([]);   // con distancia (≤ 500 m)
  const [todos, setTodos] = useState([]);         // todo lo cargado, para el mapa
  const [vista, setVista] = useState('mapa');
  const [zoom, setZoom] = useState(17);
  const [inclinado, setInclinado] = useState(true);
  const [seguir, setSeguir] = useState(true);
  const [activo, setActivo] = useState(false);
  const [voz, setVoz] = useState(true);
  const [demo, setDemo] = useState(false);
  const [ruta, setRuta] = useState('none');
  const [fase, setFase] = useState(0);
  const [sel, setSel] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [panel, setPanel] = useState(null);   // null | 'ajustes' | 'reportar'
  const [verPoliticas, setVerPoliticas] = useState(false);
  const [reportes, setReportes] = useState([]);   // reportes de la comunidad (Supabase)
  const clasifRef = useRef(null);                // IA (Teachable Machine)
  const [altavoz, setAltavoz] = useState(false);
  const [sheetH, setSheetH] = useState(220);
  const ctxRef = useRef({});

  // ---- arranque: ajustes guardados + canal de notificaciones
  useEffect(() => {
    (async () => {
      const v = (await leerAjuste('voz', '1')) === '1';
      setVoz(v); config.voz = v;
      const alt = (await leerAjuste('altavoz', '0')) === '1';
      setAltavoz(alt); config.altavoz = alt;
      setVista(await leerAjuste('vista', 'mapa'));
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CANAL, {
          name: 'Alertas de precaución', importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250], lightColor: '#FF4D6D',
        });
      }
      setActivo(await Location.hasStartedLocationUpdatesAsync(TAREA_GPS).catch(() => false));
    })();
  }, []);

  // ---- comunidad: carga inicial + tiempo real (Supabase) + caducidad a los 30 min
  useEffect(() => {
    let vivo = true;
    cargarRecientes().then((d) => vivo && setReportes(d)).catch(() => {});   // sin internet: sigue con SQLite
    const off = suscribir((r) => setReportes((prev) => [r, ...prev.filter((x) => x.id !== r.id)]));
    const t = setInterval(() => setReportes((prev) => prev.filter(vigente)), 30000);
    return () => { vivo = false; off(); clearInterval(t); };
  }, []);

  // ---- aviso (notificación + voz con audífonos) si hay un reporte de la comunidad a <=150 m
  useEffect(() => {
    if (!pos) return;
    const a = avisoCercano(pos, reportes);
    if (a) avisarReporte(a).catch(() => {});
  }, [pos, reportes]);

  // ---- estado de audífonos (y animación del radar, solo si se usa)
  useEffect(() => {
    let t1, t2;
    const arrancar = () => {
      t1 = setInterval(() => setRuta(obtenerRuta()), 3000);
      if (vista === 'radar') t2 = setInterval(() => setFase((f) => f + 0.5), 150);
      setRuta(obtenerRuta());
    };
    const parar = () => { clearInterval(t1); clearInterval(t2); };
    arrancar();
    const sub = AppState.addEventListener('change', (st) => { parar(); if (st === 'active') arrancar(); });
    return () => { parar(); sub.remove(); };
  }, [vista]);

  const refrescar = useCallback(async (lat, lon) => {
    const m = await obtenerMotor();
    await m.asegurarTiles(lat, lon);
    setCercanos(m.puntosEn(lat, lon, 500));
    setTodos(m.todos());
  }, []);

  // ---- GPS real (se pausa en modo demo)
  useEffect(() => {
    if (demo) return;
    let subPos, subHead, ultimoRumbo = 0;
    (async () => {
      const p = await Location.requestForegroundPermissionsAsync();
      if (p.status !== 'granted') return;
      subPos = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 2000 },
        ({ coords }) => { setPos({ lat: coords.latitude, lon: coords.longitude }); refrescar(coords.latitude, coords.longitude); });
      subHead = await Location.watchHeadingAsync((h) => {
        const r = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
        if (Math.abs(r - ultimoRumbo) > 6) { ultimoRumbo = r; setHeading(r); }   // evita temblor
      });
    })();
    return () => { subPos && subPos.remove(); subHead && subHead.remove(); };
  }, [demo, refrescar]);

  // ---- modo demo: camina solo por Villa El Salvador
  useEffect(() => {
    if (!demo) return;
    let la = DEMO.lat, lo = DEMO.lon;
    setHeading(49);
    const t = setInterval(async () => {
      la += 0.00012; lo += 0.00014;
      setPos({ lat: la, lon: lo });
      await refrescar(la, lo);
      await procesarPosicion(la, lo, 21);
    }, 1500);
    return () => clearInterval(t);
  }, [demo, refrescar]);

  // ---- detalle de una zona (como una pokeparada)
  async function abrirDetalle(p) {
    setPanel(null);
    const dist = pos ? Math.round(haversine(pos.lat, pos.lon, p.lat, p.lon)) : Math.round(p.dist || 0);
    setSel(p.id_punto);
    setDetalle({ id_punto: p.id_punto, lat: p.lat, lon: p.lon, cat: p.cat, total: p.total, dist, cats: [], turnos: [], recientes: [], ref: undefined });
    const cats = await db.getAllAsync(
      `SELECT c.nombre AS nombre, pc.cantidad AS n FROM punto_riesgo_categoria pc
         JOIN categoria_alerta c ON c.id_categoria = pc.id_categoria
        WHERE pc.id_punto = ? ORDER BY pc.cantidad DESC`, [p.id_punto]);
    const turnos = await db.getAllAsync('SELECT turno, cantidad AS n FROM punto_riesgo_turno WHERE id_punto = ? ORDER BY cantidad DESC', [p.id_punto]);
    const recientes = await db.getAllAsync(SQL_RECIENTES, [p.lat - 0.0003, p.lat + 0.0003, p.lon - 0.0003, p.lon + 0.0003]);
    let refDb = null;
    try { const r = await db.getFirstAsync('SELECT referencia FROM punto_riesgo WHERE id_punto = ?', [p.id_punto]); refDb = r ? r.referencia : null; } catch { /* columna aún no existe */ }
    const mismo = (prev) => prev && prev.id_punto === p.id_punto;
    setDetalle((prev) => (mismo(prev) ? { ...prev, cats, turnos, recientes, ref: refDb || undefined } : prev));
    if (!refDb) {
      const t = await referenciaCalle(p.lat, p.lon);
      setDetalle((prev) => (mismo(prev) ? { ...prev, ref: t } : prev));
    }
  }
  const cerrarDetalle = () => { setDetalle(null); setSel(null); };

  // desglose por modalidad en un radio (para "¿qué tipos de robos hay?")
  async function consultarTipos(lat, lon, radio) {
    const dla = radio / 111320, dlo = radio / (111320 * Math.cos((lat * Math.PI) / 180));
    const base = `
      FROM denuncia d
      JOIN denuncia_modalidad dm ON dm.id_dgc = d.id_dgc
      JOIN modalidad_hecho m ON m.id_modalidad = dm.id_modalidad
      JOIN subtipo_categoria sc ON sc.id_subtipo = m.id_subtipo
      JOIN categoria_alerta c ON c.id_categoria = sc.id_categoria
     WHERE d.coord_sospechosa = 0 AND c.es_publicable = 1
       AND d.lat BETWEEN ? AND ? AND d.lon BETWEEN ? AND ?`;
    const arg = [lat - dla, lat + dla, lon - dlo, lon + dlo];
    const tot = await db.getFirstAsync(`SELECT COUNT(DISTINCT d.id_dgc) AS n ${base}`, arg);
    const tipos = await db.getAllAsync(`SELECT m.nombre AS modalidad, COUNT(*) AS n ${base} GROUP BY m.nombre ORDER BY n DESC LIMIT 4`, arg);
    return { total: tot ? tot.n : 0, tipos };
  }
  ctxRef.current = { cercanos: pos ? cercanos : null, pos, consultarTipos };

  async function activar() {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return Alert.alert('Necesito tu ubicación para avisarte.');
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== 'granted') {
      return Alert.alert('Permiso de ubicación', 'Elige "Permitir todo el tiempo" en los ajustes para recibir avisos con la app minimizada.');
    }
    await Notifications.requestPermissionsAsync();
    await Location.startLocationUpdatesAsync(TAREA_GPS, {
      accuracy: Location.Accuracy.Balanced, distanceInterval: 20, timeInterval: 10000,
      pausesUpdatesAutomatically: true, showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Alerta VES activa',
        notificationBody: 'Te avisaremos si hay zonas con denuncias cerca.',
        notificationColor: '#FF4D6D',
      },
    });
    setActivo(true);
  }
  async function desactivar() { await Location.stopLocationUpdatesAsync(TAREA_GPS); setActivo(false); }

  const riesgo = nivelRiesgo(cercanos);
  const conAudif = ruta !== 'none';
  const radarSize = Math.min(width, 440) - 24;
  const verMapa = vista === 'mapa' && pos;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ---- MAPA / RADAR ---- */}
      <View style={StyleSheet.absoluteFill}>
        {verMapa ? (
          <Mapa pos={pos} heading={heading} puntos={todos} reportes={reportes} zoom={zoom} inclinado={inclinado} seguir={seguir}
            seleccionado={sel} onSelect={abrirDetalle} onVaciar={cerrarDetalle} />
        ) : vista === 'radar' && pos ? (
          <View style={s.centro}>
            <Radar size={radarSize} puntos={cercanos} radio={300} heading={heading} norteArriba={false}
              fase={fase} seleccionado={sel} onSelect={abrirDetalle} />
          </View>
        ) : (
          <View style={s.centro}>
            <Text style={s.espera}>Esperando tu ubicación…{'\n'}Si estás en casa, activa el Modo demo en Ajustes</Text>
          </View>
        )}
      </View>

      {/* IA (Teachable Machine) oculta: se precarga al abrir la app */}
      <Clasificador ref={clasifRef} />

      {/* ---- BARRA SUPERIOR ---- */}
      <View style={[s.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <View style={s.chipMarca}><Text style={s.marca}>ALERTA <Text style={{ color: T.rojo }}>VES</Text></Text></View>
        <View style={[s.chip, { borderColor: riesgo.col }]}><Text style={{ color: riesgo.col, fontWeight: '800', fontSize: 12 }}>RIESGO {pos ? riesgo.txt : '…'}</Text></View>
        <View style={[s.chip, { borderColor: '#4DA3FF' }]}><Text style={{ color: '#4DA3FF', fontSize: 12 }}>Comunidad: {reportes.length}</Text></View>
        <View style={[s.chip, { borderColor: conAudif ? T.cian : '#3A4A70' }]}>
          <Text style={{ color: conAudif ? T.cian : T.gris, fontSize: 12 }}>{ETIQ_RUTA[ruta]}</Text>
        </View>
      </View>

      {/* ---- BOTONES FLOTANTES ---- */}
      <View style={[s.flotantes, { bottom: sheetH + 12 }]} pointerEvents="box-none">
        {vista === 'mapa' && (<>
          <Boton t="GPS" activo={seguir} onPress={() => setSeguir(!seguir)} />
          <Boton t={inclinado ? '3D' : '2D'} onPress={() => setInclinado(!inclinado)} />
          <Boton t="+" onPress={() => setZoom(Math.min(19, zoom + 1))} />
          <Boton t="-" onPress={() => setZoom(Math.max(13, zoom - 1))} />
        </>)}
        <Boton t="Aj." onPress={() => setPanel(panel === 'ajustes' ? null : 'ajustes')} />
      </View>

      {/* ---- REPORTAR ---- */}
      <View style={[s.hermesBox, { bottom: sheetH + 12 }]} pointerEvents="box-none">
        <TouchableOpacity style={s.hermesBtn} onPress={() => { setDetalle(null); setSel(null); setPanel(panel === 'reportar' ? null : 'reportar'); }}>
          <Text style={s.hermesT}>Reportar autoridad</Text>
        </TouchableOpacity>
      </View>

      {/* ---- HOJA INFERIOR ---- */}
      <View style={[s.hoja, { paddingBottom: insets.bottom + 12 }]} onLayout={(e) => setSheetH(e.nativeEvent.layout.height)}>
        <View style={s.asa} />
        <ScrollView style={{ maxHeight: panel === 'reportar' ? 470 : 330 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {panel === 'reportar' ? (
            <PanelReportar pos={pos} clasificador={clasifRef} onCerrar={() => setPanel(null)} />
          ) : panel === 'ajustes' ? (
            <PanelAjustes activo={activo} voz={voz} altavoz={altavoz} demo={demo} vista={vista}
              onActivo={(v) => (v ? activar() : desactivar())}
              onVoz={(v) => { setVoz(v); config.voz = v; guardarAjuste('voz', v ? '1' : '0'); }}
              onAltavoz={(v) => { setAltavoz(v); config.altavoz = v; guardarAjuste('altavoz', v ? '1' : '0'); }}
              onDemo={setDemo}
              onVista={(v) => { setVista(v); guardarAjuste('vista', v); }}
              onPoliticas={() => setVerPoliticas(true)}
              onCerrar={() => setPanel(null)} />
          ) : detalle ? (
            <PanelDetalle d={detalle} onCerrar={cerrarDetalle}
              onMapaExterno={() => Linking.openURL(`geo:${detalle.lat},${detalle.lon}?q=${detalle.lat},${detalle.lon}(Zona%20de%20riesgo)`)} />
          ) : (
            <PanelResumen cercanos={cercanos} onAbrir={abrirDetalle}
              onHablar={() => hablar(resumenSeguridad(cercanos, new Date().getHours()))} />
          )}
        </ScrollView>
      </View>

      <Modal visible={verPoliticas} animationType="slide" onRequestClose={() => setVerPoliticas(false)}>
        <Politicas modo="ver" onCerrar={() => setVerPoliticas(false)} />
      </Modal>
    </View>
  );
}

const Boton = ({ t, onPress, activo }) => (
  <TouchableOpacity style={[s.fbtn, activo && { borderColor: T.cian }]} onPress={onPress}>
    <Text style={{ color: activo ? T.cian : '#FFFFFF', fontSize: 16, fontWeight: '700' }}>{t}</Text>
  </TouchableOpacity>
);

// Puerta: nadie usa la ubicación ni las alertas hasta aceptar las políticas (aviso sobre estrés incluido)
function Puerta() {
  const [ok, setOk] = useState(null);   // null = cargando
  useEffect(() => { leerAjuste('politicas', '').then((v) => setOk(v === VERSION_POLITICAS)); }, []);
  if (ok === null) return <View style={{ flex: 1, backgroundColor: T.fondo }} />;
  if (!ok) return <Politicas modo="inicio" onAceptar={async () => { await guardarAjuste('politicas', VERSION_POLITICAS); setOk(true); }} />;
  return (
    <SQLiteProvider databaseName="delitos_ves.db" assetSource={{ assetId: require('./assets/delitos_ves.db'), forceOverwrite: true }}>
      <Pantalla />
    </SQLiteProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Puerta />
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.fondo },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  espera: { color: T.gris, textAlign: 'center', lineHeight: 22 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', gap: 8, paddingHorizontal: 12, alignItems: 'center' },
  chipMarca: { backgroundColor: '#0E1526EE', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  marca: { color: '#FFFFFF', fontWeight: '800', letterSpacing: 1.5 },
  chip: { backgroundColor: '#0E1526EE', borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  flotantes: { position: 'absolute', right: 12, gap: 8 },
  fbtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#0E1526EE', borderWidth: 1, borderColor: T.borde, alignItems: 'center', justifyContent: 'center' },
  hermesBox: { position: 'absolute', left: 12, right: 70 },
  hermesBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0E1526EE', borderColor: T.cian, borderWidth: 1.5, borderRadius: 30, paddingHorizontal: 16, paddingVertical: 10 },
  hermesT: { color: T.cian, fontWeight: '800' },
  burbuja: { marginTop: 8, backgroundColor: '#0E1526F2', borderColor: T.cian, borderWidth: 1, borderRadius: 14, padding: 12 },
  burbujaT: { color: T.texto, fontSize: 13, lineHeight: 19 },
  hoja: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#0E1526F7', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 8, borderTopWidth: 1, borderColor: T.borde },
  asa: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#2A3A5C', marginBottom: 10 },
});
