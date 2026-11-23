const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Asegurar que Metro reconozca la base de datos SQLite (.db) y archivos binarios
config.resolver.assetExts.push('db', 'bin');

// Evitar que los módulos nativos de Android rompan la vista previa en navegador (--web)
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    if (
      moduleName === '@maplibre/maplibre-react-native' ||
      moduleName === 'expo-sqlite'
    ) {
      return {
        filePath: path.resolve(__dirname, 'src/web-mock.js'),
        type: 'sourceFile',
      };
    }
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;