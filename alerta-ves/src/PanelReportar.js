import React, { useState } from 'react';
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { T, s } from './paneles';
import { aTipo, enviarReporte, TIPOS } from './reportes';
import { PERMITIR_GALERIA, UMBRAL } from './config';

export default function PanelReportar({ pos, clasificador, onCerrar }) {
  const [estado, setEstado] = useState('idle');   // idle | analizando | ok | rechazado | error
  const [msg, setMsg] = useState('');
  const [foto, setFoto] = useState(null);

  async function procesar(resultado) {
    if (resultado.canceled || !resultado.assets?.length) return;
    const a = resultado.assets[0];
    setFoto(a.uri); setEstado('analizando'); setMsg('');
    try {
      const preds = await clasificador.current.clasificar(a.base64);
      const top = preds.reduce((x, y) => (y.p > x.p ? y : x));
      const pct = Math.round(top.p * 100);
      const tipo = aTipo(top.c);
      if (!tipo || top.p < UMBRAL) {
        setEstado('rechazado');
        setMsg(`La IA no reconoció una patrulla, serenazgo o ambulancia (vio "${top.c}" con ${pct}%). Intenta con una foto más clara.`);
        return;
      }
      await enviarReporte({ tipo, lat: pos.lat, lon: pos.lon, confianza: top.p });
      setEstado('ok'); setMsg(`${TIPOS[tipo].nombre} validada por IA (${pct}%). Ya aparece en el mapa de todos.`);
    } catch (e) {
      setEstado('error'); setMsg(String(e.message || e));
    }
  }

  async function camara() {
    if (!pos) { setEstado('error'); setMsg('Esperando tu ubicación...'); return; }
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) { setEstado('error'); setMsg('Necesito permiso de cámara.'); return; }
    procesar(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], base64: true, quality: 0.25 }));
  }
  async function galeria() {
    if (!pos) { setEstado('error'); setMsg('Esperando tu ubicación...'); return; }
    procesar(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.25 }));
  }

  return (
    <View>
      <Text style={s.titulo}>Reportar autoridad</Text>
      <Text style={s.gris}>Toma una foto de una patrulla, serenazgo o ambulancia. La IA la valida y se publica para todos. La foto no se guarda: solo se envía el tipo y la ubicación. No fotografíes personas.</Text>

      <View style={[s.fila, { marginTop: 10, gap: 10 }]}>
        <TouchableOpacity style={[s.btn, { backgroundColor: '#B3203E' }]} onPress={camara} disabled={estado === 'analizando'}>
          <Text style={s.btnT}>Tomar foto</Text>
        </TouchableOpacity>
        {PERMITIR_GALERIA && (
          <TouchableOpacity style={s.btn} onPress={galeria} disabled={estado === 'analizando'}>
            <Text style={s.btnT}>Elegir de galería</Text>
          </TouchableOpacity>
        )}
      </View>

      {foto && <Image source={{ uri: foto }} style={{ width: '100%', height: 120, borderRadius: 10, marginTop: 10 }} resizeMode="cover" />}
      {estado === 'analizando' && <View style={[s.fila, { marginTop: 10 }]}><ActivityIndicator color={T.cian} /><Text style={[s.txt, { marginLeft: 8 }]}>La IA está analizando la imagen...</Text></View>}
      {estado === 'ok' && <Text style={[s.txt, { marginTop: 10, color: '#00E676' }]}>Reporte publicado. {msg}</Text>}
      {estado === 'rechazado' && <Text style={[s.txt, { marginTop: 10, color: '#FFA94D' }]}>No se publicó. {msg}</Text>}
      {estado === 'error' && <Text style={[s.txt, { marginTop: 10, color: T.rojo }]}>Error: {msg}</Text>}

      <View style={[s.fila, { marginTop: 10, gap: 12 }]}>
        {Object.entries(TIPOS).map(([k, v]) => (
          <View key={k} style={s.fila}><View style={[s.dot, { backgroundColor: v.color }]} /><Text style={s.gris}>{v.nombre}</Text></View>
        ))}
      </View>
      <TouchableOpacity style={[s.btn, { marginTop: 12 }]} onPress={onCerrar}><Text style={s.btnT}>Cerrar</Text></TouchableOpacity>
    </View>
  );
}
