import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from './paneles';

export const VERSION_POLITICAS = 'v1';

const SECCIONES = [
  ['Qué es Altoque',
   'Altoque es una herramienta de prevención. Te avisa cuando estás cerca de zonas con denuncias registradas y muestra reportes de la comunidad sobre presencia de patrullas, serenazgo o ambulancias. Es un prototipo desarrollado para una hackathon.'],
  ['Aviso sobre el estrés y la preocupación',
   'Al usar la aplicación aceptas que recibirás alertas que te indican que el lugar por donde pasas tiene denuncias registradas o puede ser peligroso. Esas alertas pueden generar preocupación o estrés. Su objetivo es que estés atento, no alarmarte. Puedes silenciar las alertas habladas, desactivar la protección en segundo plano o dejar de usar la aplicación cuando quieras desde Ajustes.'],
  ['No garantiza tu seguridad',
   'La información se basa en denuncias históricas y en reportes de otros usuarios, y puede estar incompleta, desactualizada o equivocada. Que no haya alerta no significa que un lugar sea seguro. Altoque no reemplaza a la Policía ni a otros servicios de emergencia. En una emergencia llama al 105.'],
  ['Atención a tu entorno',
   'No mires el celular mientras caminas por zonas de riesgo, cruzas una pista o conduces. Las alertas por voz con audífonos son para que no tengas que mirar la pantalla; mantén un volumen que te permita escuchar tu entorno.'],
  ['Tu ubicación',
   'Usamos tu ubicación para avisarte cuando estás cerca de una zona con denuncias, incluso con la aplicación cerrada si activas la protección en segundo plano. El análisis de zonas ocurre en tu celular. Solo se envía una ubicación a internet cuando tú publicas un reporte.'],
  ['Reportes de la comunidad',
   'Los reportes son anónimos. Al reportar, la foto se analiza con inteligencia artificial y no se guarda ni se envía: solo se publica el tipo de vehículo, la ubicación y la hora. Cada reporte desaparece a los 30 minutos. La inteligencia artificial puede equivocarse.'],
  ['Uso responsable',
   'Reporta solo lo que realmente ves. No fotografíes personas, rostros, menores de edad ni placas de vehículos particulares: solo patrullas, unidades de serenazgo y ambulancias. Los reportes falsos o los intentos de saturar el sistema están prohibidos, y se limita la cantidad de reportes por celular.'],
  ['Responsabilidad',
   'Altoque se ofrece tal como está, sin garantías. Las decisiones que tomes con base en la información de la aplicación son tu responsabilidad.'],
];

/**
 * modo "inicio": pantalla obligatoria la primera vez (hay que aceptar para entrar).
 * modo "ver": se abre desde Ajustes, solo lectura.
 */
export default function Politicas({ modo = 'inicio', onAceptar, onCerrar }) {
  const insets = useSafeAreaInsets();
  const [ok, setOk] = useState(false);
  const inicio = modo === 'inicio';

  return (
    <View style={[s.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <Text style={s.marca}>ALTOQUE</Text>
      <Text style={s.titulo}>Políticas de uso y aviso importante</Text>
      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 12 }}>
        {SECCIONES.map(([t, c]) => (
          <View key={t} style={s.bloque}>
            <Text style={s.sub}>{t}</Text>
            <Text style={s.txt}>{c}</Text>
          </View>
        ))}
      </ScrollView>

      {inicio ? (
        <View>
          <View style={s.sw}>
            <Text style={[s.txt, { flex: 1 }]}>He leído las políticas y acepto recibir alertas sobre zonas con denuncias.</Text>
            <Switch value={ok} onValueChange={setOk} trackColor={{ true: T.cian }} />
          </View>
          <TouchableOpacity style={[s.btn, !ok && { opacity: 0.35 }]} disabled={!ok} onPress={onAceptar}>
            <Text style={s.btnT}>Aceptar y continuar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={s.btn} onPress={onCerrar}><Text style={s.btnT}>Cerrar</Text></TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.fondo, paddingHorizontal: 18 },
  marca: { color: T.rojo, fontWeight: '800', letterSpacing: 3, fontSize: 13 },
  titulo: { color: '#FFFFFF', fontWeight: '800', fontSize: 21, marginTop: 4, marginBottom: 10 },
  scroll: { flex: 1 },
  bloque: { marginBottom: 14 },
  sub: { color: T.cian, fontWeight: '700', marginBottom: 3 },
  txt: { color: T.texto, fontSize: 14, lineHeight: 20 },
  sw: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  btn: { backgroundColor: '#B3203E', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnT: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
