import React, { createContext, useContext } from 'react';
import { View, Text } from 'react-native';

export const MapView = ({ children, style }) => (
  <View
    style={[
      {
        flex: 1,
        backgroundColor: '#0f172a',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      },
      style,
    ]}
  >
    <Text style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: 16 }}>
      Mapa Nativo MapLibre (Vista Previa Web)
    </Text>
    <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 6, textAlign: 'center' }}>
      El mapa 3D y SQLite local corren nativamente en Android / Emulador. Aquí puedes probar los paneles, radar y diseño.
    </Text>
    {children}
  </View>
);

const EmptyComponent = ({ children }) => <>{children}</>;

export const Camera = EmptyComponent;
export const PointAnnotation = EmptyComponent;
export const MarkerView = EmptyComponent;
export const ShapeSource = EmptyComponent;
export const CircleLayer = EmptyComponent;
export const SymbolLayer = EmptyComponent;
export const LineLayer = EmptyComponent;
export const FillLayer = EmptyComponent;
export const UserLocation = EmptyComponent;
export const Images = EmptyComponent;
export const setAccessToken = () => {};
export const Logger = { setLogCallback: () => {} };

// Base de datos simulada para vista previa web
const mockDb = {
  getAllAsync: async () => [],
  getFirstAsync: async () => null,
  runAsync: async () => ({ lastInsertRowId: 1, changes: 1 }),
  execAsync: async () => {},
  getAllSync: () => [],
  getFirstSync: () => null,
  runSync: () => ({ lastInsertRowId: 1, changes: 1 }),
  execSync: () => {},
  withTransactionAsync: async (fn) => await fn(),
};

const SQLiteContext = createContext(mockDb);

export const SQLiteProvider = ({ children }) => (
  <SQLiteContext.Provider value={mockDb}>{children}</SQLiteContext.Provider>
);

export const useSQLiteContext = () => useContext(SQLiteContext);
export const openDatabaseAsync = async () => mockDb;
export const openDatabaseSync = () => mockDb;

export default {
  MapView,
  Camera,
  PointAnnotation,
  MarkerView,
  ShapeSource,
  CircleLayer,
  SymbolLayer,
  LineLayer,
  FillLayer,
  UserLocation,
  Images,
  setAccessToken,
  Logger,
};