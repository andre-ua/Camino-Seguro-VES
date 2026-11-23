-- Reportes de ejemplo a lo largo de la ruta del "Modo demo" (Villa El Salvador).
-- Ejecútalo justo ANTES de la presentación (los reportes duran 30 min).
insert into public.reportes (tipo, lat, lon, confianza, device_id) values
  ('ambulancia', -12.2250, -76.9440, 0.96, 'seed'),
  ('patrulla',   -12.2238, -76.9434, 0.97, 'seed'),
  ('serenazgo',  -12.2228, -76.9424, 0.92, 'seed');
