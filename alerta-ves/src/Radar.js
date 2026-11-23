import React from 'react';
import Svg, { Circle, Defs, G, Line, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';

const COLORES = {
  'Robo': '#FF4D6D', 'Hurto': '#FFA94D', 'Extorsión': '#B388FF',
  'Homicidio / lesiones graves': '#FF1744', 'Venta de drogas': '#00E676', 'Estafa': '#FFEA00',
};
export const color = (cat) => COLORES[cat] || '#90A4AE';

export default function Radar({ size, puntos, radio, heading, norteArriba, fase, seleccionado, onSelect }) {
  const c = size / 2;
  const escala = (c - 8) / radio;
  const rot = norteArriba ? 0 : -heading;           // "adelante" siempre arriba (como Waze)
  const flecha = norteArriba ? heading : 0;
  const cercanos = new Set(puntos.slice(0, 5).map((p) => p.id_punto));
  const pulso = 0.5 + 0.5 * Math.sin(fase);

  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="fondo" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#16223F" />
          <Stop offset="100%" stopColor="#070B14" />
        </RadialGradient>
      </Defs>
      <Circle cx={c} cy={c} r={c - 2} fill="url(#fondo)" stroke="#2A3A5C" strokeWidth={2} />
      {[0.33, 0.66, 1].map((f) => (
        <Circle key={f} cx={c} cy={c} r={(c - 8) * f} fill="none" stroke="#2A3A5C" strokeWidth={1} strokeDasharray="4 6" />
      ))}
      {[0.33, 0.66, 1].map((f) => (
        <SvgText key={`t${f}`} x={c + 4} y={c - (c - 8) * f + 12} fill="#5C6F99" fontSize="10">
          {Math.round(radio * f)} m
        </SvgText>
      ))}

      <G rotation={rot} origin={`${c}, ${c}`}>
        <Line x1={c} y1={8} x2={c} y2={size - 8} stroke="#1D2A47" strokeWidth={1} />
        <Line x1={8} y1={c} x2={size - 8} y2={c} stroke="#1D2A47" strokeWidth={1} />
        <SvgText x={c} y={22} fill="#7CE2FF" fontSize="12" fontWeight="bold" textAnchor="middle">N</SvgText>
        {puntos.map((p) => {
          const x = c + p.dx * escala;
          const y = c - p.dy * escala;
          const r = 5 + Math.sqrt(p.total) * 1.8;
          const col = color(p.cat);
          const sel = seleccionado === p.id_punto;
          return (
            <G key={p.id_punto} onPress={() => onSelect(p)}>
              <Circle cx={x} cy={y} r={r * 2.8} fill={col} opacity={0.10} />
              <Circle cx={x} cy={y} r={r * 1.7} fill={col} opacity={0.22} />
              <Circle cx={x} cy={y} r={r} fill={col} opacity={0.95} />
              {cercanos.has(p.id_punto) && (
                <Circle cx={x} cy={y} r={r + 4 + pulso * 8} fill="none" stroke={col} strokeWidth={2} opacity={0.6 - pulso * 0.4} />
              )}
              {sel && <Circle cx={x} cy={y} r={r + 6} fill="none" stroke="#FFFFFF" strokeWidth={2} />}
            </G>
          );
        })}
      </G>

      <G rotation={flecha} origin={`${c}, ${c}`}>
        <Circle cx={c} cy={c} r={20} fill="#00E5FF" opacity={0.12 + pulso * 0.1} />
        <Path d={`M ${c} ${c - 14} L ${c + 9} ${c + 10} L ${c} ${c + 5} L ${c - 9} ${c + 10} Z`}
          fill="#00E5FF" stroke="#FFFFFF" strokeWidth={1.5} />
      </G>
    </Svg>
  );
}
