# Camino Seguro VES — Project Hermes

Plataforma integral de prevención ciudadana y alerta temprana georreferenciada para **Villa El Salvador (Lima, Perú)**. Combina una **aplicación móvil nativa (ALERTA VES)** con monitoreo GPS en tiempo real, base de datos local offline (**SQLite**), validación automática de evidencias mediante **Inteligencia Artificial (Teachable Machine / TensorFlow.js)** y sincronización colaborativa en la nube con **Supabase**.

---

## Arquitectura del Proyecto

```text
PROJEC-HERMES/
├── alerta-ves/                   # Aplicación móvil nativa (React Native + Expo)
│   ├── assets/                   # Íconos, splash screen y base SQLite local (delitos_ves.db)
│   ├── modules/                  # Módulos nativos personalizados (Audio / Alertas Android)
│   ├── src/
│   │   ├── Mapa.js               # Renderizado cartográfico con MapLibre GL
│   │   ├── Radar.js              # Motor de proximidad y detección de zonas de riesgo
│   │   ├── motor.js              # Cálculo de distancias, geocercas y evaluación de riesgo
│   │   ├── Clasificador.js       # Clasificación de evidencias fotográficas con IA
│   │   ├── PanelReportar.js      # Interfaz de reporte ciudadano con validación IA
│   │   ├── supabase.js           # Cliente y sincronización en tiempo real con Supabase
│   │   ├── config.js             # Credenciales públicas, umbrales y URL del modelo IA
│   │   ├── alertas.js            # Gestión de notificaciones y alertas tempranas
│   │   ├── hermes.js             # Orquestación principal del sistema Hermes
│   │   ├── Politicas.js          # Términos de uso y privacidad ciudadana
│   │   └── ajustes.js            # Preferencias y configuración local del usuario
│   ├── App.js                    # Punto de entrada y proveedor de base de datos SQLite
│   ├── metro.config.js           # Configuración de empaquetado de recursos (.db)
│   └── eas.json                  # Perfiles de compilación APK (EAS Build)
├── build_db.py                   # Construcción y poblamiento de la base SQLite (delitos_ves.db)
├── agregar_referencias.py        # Carga de puntos de referencia y zonas críticas de VES
├── alerta_demo.py                # Script de simulación y pruebas de alertas geoespaciales
├── delitos_ves.db                # Base de datos geoespacial offline de incidencias
├── schema.sql                    # Estructura de tablas geoespaciales para Supabase
├── supabase_setup.sql            # Políticas de seguridad RLS y funciones en Supabase
├── supabase_demo_seed.sql        # Datos iniciales de demostración en la nube
└── README.md                     # Documentación oficial del proyecto