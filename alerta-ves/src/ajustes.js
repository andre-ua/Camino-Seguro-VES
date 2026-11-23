import * as SQLite from 'expo-sqlite';

let dbPromise = null;
function abrir() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('ajustes.db').then(async (d) => {
      await d.execAsync('CREATE TABLE IF NOT EXISTS ajuste (clave TEXT PRIMARY KEY, valor TEXT)');
      return d;
    });
  }
  return dbPromise;
}
export async function leerAjuste(clave, def) {
  const db = await abrir();
  const r = await db.getFirstAsync('SELECT valor FROM ajuste WHERE clave = ?', [clave]);
  return r ? r.valor : def;
}
export async function guardarAjuste(clave, valor) {
  const db = await abrir();
  await db.runAsync('INSERT OR REPLACE INTO ajuste (clave, valor) VALUES (?, ?)', [clave, String(valor)]);
}
