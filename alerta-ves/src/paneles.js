import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { color } from './Radar';
import { nivelRiesgo } from './hermes';

export const T = { fondo: '#070B14', panel: '#0E1526', borde: '#1D2A47', texto: '#E3E9FA', gris: '#8392B8', cian: '#00E5FF', rojo: '#FF4D6D' };

const fmtFecha = (f) => (f ? `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}` : '');

export function PanelResumen({ cercanos, onAbrir, onHablar }) {
  const r = nivelRiesgo(cercanos);
  const lista = cercanos.slice(0, 3);
  return (
    <View>
      <Text style={s.etiqueta}>RIESGO EN TU ZONA (150 m)</Text>
      <Text style={[s.grande, { color: r.col }]}>{r.txt}</Text>
      <Text style={s.sub}>Lo más cercano</Text>
      {lista.map((p) => (
        <TouchableOpacity key={p.id_punto} style={s.item} onPress={() => onAbrir(p)}>
          <View style={[s.dot, { backgroundColor: color(p.cat) }]} />
          <Text style={s.txt}>{p.cat} · {p.total} denuncia(s) · {Math.round(p.dist)} m</Text>
        </TouchableOpacity>
      ))}
      {!lista.length && <Text style={s.gris}>Sin denuncias registradas cerca.</Text>}
      <Text style={[s.gris, { marginTop: 6 }]}>Toca una zona en el mapa para ver el detalle. Información basada en denuncias; no garantiza tu seguridad.</Text>
      <TouchableOpacity style={[s.btn, { marginTop: 10 }]} onPress={onHablar}><Text style={s.btnT}>Escuchar resumen de seguridad</Text></TouchableOpacity>
    </View>
  );
}

export function PanelDetalle({ d, onCerrar, onMapaExterno }) {
  const c = color(d.cat);
  const ref = d.ref === undefined ? 'Buscando referencia…' : d.ref === null ? 'Sin referencia de calle (sin conexión)' : d.ref;
  return (
    <View>
      <View style={s.fila}>
        <View style={[s.dot, { backgroundColor: c, width: 14, height: 14, borderRadius: 7 }]} />
        <Text style={[s.titulo, { color: c }]}>Zona de {d.cat.toLowerCase()}</Text>
      </View>
      <Text style={s.gris}>A {d.dist} m de ti · {d.total} denuncia(s) registradas</Text>
      <Text style={[s.txt, { marginTop: 8 }]}>Referencia: {ref}</Text>

      {d.cats.length > 0 && <Text style={s.sub}>Tipos de delito</Text>}
      {d.cats.map((x) => <Text key={x.nombre} style={s.gris}>• {x.nombre}: {x.n}</Text>)}

      {d.turnos.length > 0 && <Text style={s.sub}>Horarios más frecuentes</Text>}
      {d.turnos.length > 0 && <Text style={s.gris}>{d.turnos.map((t) => `${t.turno} (${t.n})`).join(' · ')}</Text>}

      {d.recientes.length > 0 && <Text style={s.sub}>Últimas denuncias</Text>}
      {d.recientes.map((r, i) => (
        <Text key={i} style={s.gris}>• {fmtFecha(r.fecha)} · {r.turno} · {r.modalidad}</Text>
      ))}

      <View style={[s.fila, { marginTop: 12, gap: 10 }]}>
        <TouchableOpacity style={s.btn} onPress={onMapaExterno}><Text style={s.btnT}>Ver en otro mapa</Text></TouchableOpacity>
        <TouchableOpacity style={s.btn} onPress={onCerrar}><Text style={s.btnT}>Cerrar</Text></TouchableOpacity>
      </View>
    </View>
  );
}

export function PanelAjustes({ activo, voz, altavoz, demo, vista, onActivo, onVoz, onAltavoz, onDemo, onVista, onPoliticas, onCerrar }) {
  return (
    <View>
      <Text style={s.titulo}>Ajustes</Text>
      <Fila txt="Protección en segundo plano" v={activo} on={onActivo} col={T.rojo} />
      <Fila txt="Alertas habladas (solo con audífonos)" v={voz} on={onVoz} col={T.cian} />
      <Fila txt="Voz por altavoz (solo para pruebas en casa)" v={altavoz} on={onAltavoz} col="#FFD54F" />
      <Fila txt="Vista de radar (sin internet)" v={vista === 'radar'} on={(v) => onVista(v ? 'radar' : 'mapa')} col="#FFA94D" />
      <Fila txt="Modo demo (simula caminar en VES)" v={demo} on={onDemo} col="#B388FF" />
      <View style={[s.fila, { marginTop: 10, gap: 10 }]}>
        <TouchableOpacity style={s.btn} onPress={onPoliticas}><Text style={s.btnT}>Políticas de uso</Text></TouchableOpacity>
        <TouchableOpacity style={s.btn} onPress={onCerrar}><Text style={s.btnT}>Listo</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const Fila = ({ txt, v, on, col }) => (
  <View style={s.sw}><Text style={[s.txt, { flex: 1 }]}>{txt}</Text><Switch value={v} onValueChange={on} trackColor={{ true: col }} /></View>
);

export const s = StyleSheet.create({
  etiqueta: { color: T.gris, fontSize: 11, letterSpacing: 1 },
  grande: { fontSize: 30, fontWeight: '800' },
  titulo: { color: '#FFFFFF', fontWeight: '800', fontSize: 18, marginLeft: 8 },
  sub: { color: '#FFFFFF', fontWeight: '700', marginTop: 12, marginBottom: 4 },
  txt: { color: T.texto, fontSize: 14 },
  gris: { color: T.gris, fontSize: 13, marginTop: 2 },
  fila: { flexDirection: 'row', alignItems: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  sw: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, gap: 10 },
  btn: { flex: 1, backgroundColor: '#16223F', borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  btnT: { color: '#FFFFFF', fontWeight: '600' },
});
