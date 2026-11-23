// Configuración de Altoque (Alerta VES). Estas claves son PUBLICAS por diseño: la seguridad real
// está en las reglas RLS de Supabase (supabase/setup.sql). NUNCA pongas aquí la clave service_role / secret.
export const SUPABASE_URL = 'https://jfpgzosemzvmfdqlfqye.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_5E2FwVpluhXAkQoFfs1PGg_AmU7P6ZH';
export const TM_MODEL_URL = 'https://teachablemachine.withgoogle.com/models/c-CCBOyoGy/'; // con "/" al final

export const UMBRAL = 0.85;           // confianza mínima de la IA para aceptar un reporte
export const VIGENCIA_MIN = 30;       // un reporte vive 30 minutos
export const PERMITIR_GALERIA = true; // true = permite elegir foto de la galería (útil para pruebas/demo). Para publicar: false.
