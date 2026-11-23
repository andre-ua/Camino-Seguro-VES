const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('db');   // para poder empaquetar delitos_ves.db
module.exports = config;
