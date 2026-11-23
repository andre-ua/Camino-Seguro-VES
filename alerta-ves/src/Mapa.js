import React, { useMemo, useRef } from 'react';
import { Camera, GeoJSONSource, Layer, Map as MapaBase } from '@maplibre/maplibre-react-native';
import { color } from './Radar';

// Estilo oscuro gratuito (CARTO Dark Matter). Para cambiarlo, solo cambia esta URL.
// Alternativa clara de OpenFreeMap: 'https://tiles.openfreemap.org/styles/liberty'
export const ESTILO_MAPA = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// píxeles que ocupan `metros` a zoom z (teselas de 512 px)
const px = (metros, lat, z) => (metros * Math.pow(2, z)) / (78271.517 * Math.cos((lat * Math.PI) / 180));

export default function Mapa({ pos, heading, puntos, reportes = [], zoom, inclinado, seguir, seleccionado, radioAviso = 150, onSelect, onVaciar }) {
  const ignorar = useRef(false);

  const dangers = useMemo(() => ({
    type: 'FeatureCollection',
    features: puntos.map((p) => ({
      type: 'Feature',
      id: p.id_punto,
      properties: { id_punto: p.id_punto, color: color(p.cat), total: p.total, sel: p.id_punto === seleccionado ? 1 : 0 },
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
    })),
  }), [puntos, seleccionado]);

  const reps = useMemo(() => ({
    type: 'FeatureCollection',
    features: reportes.map((r) => ({
      type: 'Feature',
      properties: { tipo: r.tipo },
      geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
    })),
  }), [reportes]);

  const yo = useMemo(() => ({
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [pos.lon, pos.lat] } }],
  }), [pos.lat, pos.lon]);

  const camara = seguir
    ? { center: [pos.lon, pos.lat], zoom, pitch: inclinado ? 60 : 0, bearing: heading, duration: 600, easing: 'ease' }
    : {};

  function tocarPunto(e) {
    const f = e?.nativeEvent?.features?.[0];
    if (!f) return;
    ignorar.current = true;
    setTimeout(() => { ignorar.current = false; }, 400);
    if (e.stopPropagation) e.stopPropagation();
    const id = f.properties?.id_punto;
    const p = puntos.find((x) => x.id_punto === id);
    if (p) onSelect(p);
  }

  return (
    <MapaBase
      style={{ flex: 1 }}
      mapStyle={ESTILO_MAPA}
      logo={false}
      compass={false}
      onPress={() => { if (!ignorar.current) onVaciar(); }}
    >
      <Camera initialViewState={{ center: [pos.lon, pos.lat], zoom, pitch: inclinado ? 60 : 0, bearing: heading }} {...camara} />

      {/* zonas de riesgo: "pokeparadas" */}
      <GeoJSONSource id="peligros" data={dangers} onPress={tocarPunto}
        hitbox={{ top: 22, right: 22, bottom: 22, left: 22 }}>
        <Layer id="peligros-halo" type="circle" paint={{
          'circle-radius': ['+', 16, ['*', 3, ['sqrt', ['get', 'total']]]],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.25,
          'circle-blur': 0.8,
          'circle-pitch-alignment': 'map',
        }} />
        <Layer id="peligros-nucleo" type="circle" paint={{
          'circle-radius': ['+', 7, ['*', 1.6, ['sqrt', ['get', 'total']]]],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.95,
          'circle-stroke-width': ['case', ['==', ['get', 'sel'], 1], 4, 2],
          'circle-stroke-color': '#FFFFFF',
        }} />
      </GeoJSONSource>

      {/* reportes de la comunidad (Supabase, tiempo real): azul=patrulla, verde=serenazgo, blanco=ambulancia */}
      <GeoJSONSource id="reportes" data={reps}>
        <Layer id="reportes-halo" type="circle" paint={{
          'circle-radius': 22,
          'circle-color': ['match', ['get', 'tipo'], 'patrulla', '#4DA3FF', 'serenazgo', '#00E676', '#FFFFFF'],
          'circle-opacity': 0.22,
          'circle-blur': 0.6,
          'circle-pitch-alignment': 'map',
        }} />
        <Layer id="reportes-nucleo" type="circle" paint={{
          'circle-radius': 9,
          'circle-color': ['match', ['get', 'tipo'], 'patrulla', '#4DA3FF', 'serenazgo', '#00E676', '#FFFFFF'],
          'circle-stroke-width': 3,
          'circle-stroke-color': '#0E1526',
        }} />
      </GeoJSONSource>

      {/* tú + radio de aviso */}
      <GeoJSONSource id="yo" data={yo}>
        <Layer id="yo-radio" type="circle" paint={{
          'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 12, px(radioAviso, pos.lat, 12), 20, px(radioAviso, pos.lat, 20)],
          'circle-color': '#00E5FF',
          'circle-opacity': 0.08,
          'circle-stroke-color': '#00E5FF',
          'circle-stroke-width': 1.5,
          'circle-stroke-opacity': 0.5,
          'circle-pitch-alignment': 'map',
        }} />
        <Layer id="yo-punto" type="circle" paint={{
          'circle-radius': 8,
          'circle-color': '#00E5FF',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#FFFFFF',
        }} />
      </GeoJSONSource>
    </MapaBase>
  );
}
