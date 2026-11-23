# ALERTA VES · Camino Seguro VES (Project Hermes)

Plataforma de prevención ciudadana y alerta temprana georreferenciada para **Villa El Salvador (Lima, Perú)**, desarrollada para el **HackODS UA 2026**. Combina datos reales de incidencias delictivas (SIDPOL), cartografía interactiva, cálculo de proximidad y riesgo, asistente de voz (**Hermes**), validación visual de evidencias mediante Inteligencia Artificial (**Teachable Machine / TensorFlow.js**) y sincronización en la nube con **Supabase**.

---

## 1. Descripción del proyecto
**ALERTA VES · Camino Seguro VES (Project Hermes)** es un sistema preventivo diseñado para que los ciudadanos se desplacen con mayor información y precaución por las calles de **Villa El Salvador**. A partir de registros georreferenciados de incidencias de la SIDPOL almacenados localmente en SQLite (`delitos_ves.db`) y complementados con puntos de referencia y zonas críticas del distrito, la aplicación evalúa el nivel de riesgo según la cercanía y el contexto del recorrido.

De forma complementaria, incorpora el asistente **Hermes** para alertas auditivas preventivas, un clasificador visual con **Teachable Machine / TensorFlow.js** para respaldar el reporte ciudadano con evidencias fotográficas y sincronización en tiempo real con **Supabase**.

---

## 2. Reto y vinculación con los ODS
El proyecto responde a un reto propio vinculado a los **Objetivos de Desarrollo Sostenible (ODS)** y a **Villa El Salvador**:
* **ODS 3 (Salud y Bienestar):** Reduce la exposición al peligro y la percepción de inseguridad al transitar por la vía pública mediante alertas oportunas.
* **ODS 11 (Ciudades y Comunidades Sostenibles):** Contribuye a construir entornos urbanos más seguros y resilientes en Villa El Salvador mediante prevención basada en datos reales y participación ciudadana.

---

## 3. Equipo y roles
* **Arturo Alberto Garamendi Sanchez** — Extracción y normalización de datos georreferenciados de SIDPOL, creación del dataset y entrenamiento/exportación del modelo de reconocimiento visual en Teachable Machine, pruebas funcionales y control de versiones en Git/GitHub.
* **Renato Andre Torres Cardenas** — Desarrollo del código de la aplicación móvil, ensamblaje de la interfaz, renderizado cartográfico, motor de geocercas y cálculo de riesgo, asistente Hermes, integración con Supabase y configuración de empaquetado móvil.

---

## 4. Tecnologías utilizadas
* **Aplicación móvil:** React Native + Expo (`alerta-ves/`, con perfiles de compilación en `eas.json` y empaquetado de recursos en `metro.config.js`).
* **Datos y base de datos local:** Python, JSON y SQLite (`delitos_ves.db`, `build_db.py`, `agregar_referencias.py`, `alerta_demo.py`).
* **Base de datos en la nube:** Supabase (`schema.sql`, `supabase_setup.sql`, `supabase_demo_seed.sql`).
* **Inteligencia Artificial:** Teachable Machine / TensorFlow.js para clasificación de evidencias visuales.
* **Mapas y alertas:** MapLibre GL, motor geoespacial de proximidad y asistente de voz Hermes.

---

## 5. Arquitectura del proyecto

    Camino-Seguro-VES/
    ├── alerta-ves/                   # Aplicación móvil (React Native + Expo)
    │   ├── assets/                   # Íconos, splash screen y base SQLite offline (delitos_ves.db)
    │   ├── modules/
    │   │   └── expo-audio-route/     # Módulo nativo de audio y enrutamiento de salida
    │   ├── src/
    │   │   ├── ajustes.js            # Preferencias y configuración local del usuario
    │   │   ├── alertas.js            # Gestión de notificaciones y alertas tempranas
    │   │   ├── Clasificador.js       # Clasificación de evidencias fotográficas con IA
    │   │   ├── config.js             # Credenciales públicas, umbrales y parámetros
    │   │   ├── hermes.js             # Orquestación principal del asistente Hermes
    │   │   ├── Mapa.js               # Renderizado cartográfico con MapLibre GL
    │   │   ├── motor.js              # Cálculo de distancias, geocercas y nivel de riesgo
    │   │   ├── paneles.js            # Componentes visuales y paneles de información
    │   │   ├── PanelReportar.js      # Interfaz de reporte ciudadano con validación visual
    │   │   ├── Politicas.js          # Términos de uso y privacidad ciudadana
    │   │   ├── Radar.js              # Motor de proximidad y detección de zonas críticas
    │   │   ├── referencia.js         # Puntos de referencia y sectores de VES
    │   │   ├── reportes.js           # Gestión y envío de reportes ciudadanos
    │   │   ├── supabase.js           # Cliente y sincronización en tiempo real con Supabase
    │   │   └── tarea.js              # Procesos y tareas en segundo plano
    │   ├── AGENTS.md                 # Guía técnica de desarrollo del proyecto
    │   ├── App.js                    # Punto de entrada y proveedor de SQLite
    │   ├── app.json                  # Configuración general de Expo
    │   ├── eas.json                  # Perfiles de compilación APK (EAS Build)
    │   ├── index.js                  # Registro raíz de la aplicación
    │   ├── metro.config.js           # Configuración de Metro bundler (assets .db)
    │   ├── package.json              # Dependencias y scripts de la app móvil
    │   ├── package-lock.json         # Versiones exactas de dependencias móviles
    │   └── tsconfig.json             # Configuración de TypeScript
    ├── agregar_referencias.py        # Carga de puntos de referencia y zonas críticas de VES
    ├── alerta_demo.py                # Script de simulación y pruebas de alertas
    ├── build_db.py                   # Construcción y poblamiento de la base SQLite
    ├── delitos_ves.db                # Base de datos SQLite offline de incidencias de VES
    ├── schema.sql                    # Estructura de tablas geoespaciales para Supabase
    ├── supabase_demo_seed.sql        # Datos iniciales de demostración en Supabase
    ├── supabase_setup.sql            # Políticas de seguridad (RLS) y funciones en Supabase
    ├── package.json                  # Dependencias y scripts del repositorio raíz
    ├── package-lock.json             # Bloqueo de dependencias de la raíz
    └── README.md                     # Documentación oficial del proyecto

---

## 6. Instalación y ejecución

### Requisitos previos
* **Git** instalado para clonar y actualizar el repositorio.
* **Python 3.10+** (con `sqlite3`) para ejecutar los scripts de generación de base de datos y simulación.
* **Node.js (v18 o superior) y npm** para instalar las dependencias y ejecutar Expo.
* **Expo Go** en un dispositivo Android/iOS (o un emulador Android configurado) para visualizar la aplicación móvil.
* *(Opcional)* Cuenta en **Supabase** si se desea desplegar una instancia propia de sincronización en la nube.

### Paso 1: Clonar el repositorio e instalar dependencias

    git clone https://github.com/andre-ua/Camino-Seguro-VES.git
    cd Camino-Seguro-VES
    git pull --rebase

    # Instalar dependencias de la raíz
    npm install

    # Instalar dependencias de la aplicación móvil
    cd alerta-ves
    npm install
    cd ..

### Paso 2: Generar la base de datos local y probar la simulación (Python)
Ejecuta los scripts desde la carpeta raíz para construir `delitos_ves.db`, cargar referencias de Villa El Salvador y probar la simulación de alertas:

    python build_db.py
    python agregar_referencias.py
    python alerta_demo.py

### Paso 3: Configurar la base de datos en la nube (Supabase - Opcional)
Si deseas replicar el entorno colaborativo en tu propio proyecto de Supabase, ejecuta los scripts en el **SQL Editor** en este orden:
1. `schema.sql` — Crea las tablas geoespaciales de incidencias y reportes.
2. `supabase_setup.sql` — Configura las políticas de seguridad (RLS) y funciones.
3. `supabase_demo_seed.sql` — Inserta datos iniciales de demostración.
4. Verifica los parámetros de conexión en `alerta-ves/src/config.js`.

### Paso 4: Iniciar la aplicación móvil (Expo / React Native)

    cd alerta-ves
    npx expo start

* Escanea el código QR con **Expo Go** desde tu celular en la misma red Wi-Fi (o presiona **`a`** en la terminal para abrirlo en un emulador Android).
* Si necesitas conectar dispositivos en redes distintas mediante túnel externo:

      npx expo start --tunnel