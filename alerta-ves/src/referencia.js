// Referencia de calle con internet (OpenStreetMap / Nominatim). Una consulta por toque, con caché.
const cache = new globalThis.Map();

export async function referenciaCalle(lat, lon) {
  const k = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (cache.has(k)) return cache.get(k);
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 7000);
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=es&lat=${lat}&lon=${lon}`,
      { headers: { 'User-Agent': 'AlertaVES/1.0 (proyecto universitario)' }, signal: ctl.signal });
    clearTimeout(t);
    const j = await r.json();
    const a = j.address || {};
    const calle = a.road || a.pedestrian || a.path || a.footway || '';
    const zona = a.neighbourhood || a.suburb || a.quarter || a.city_district || '';
    const txt = [calle, zona].filter(Boolean).join(', ')
      || (j.display_name ? j.display_name.split(',').slice(0, 3).join(',').trim() : null);
    cache.set(k, txt);
    return txt;
  } catch {
    return null;   // sin internet o sin respuesta
  }
}
