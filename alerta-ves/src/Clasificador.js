import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { TM_MODEL_URL } from './config';

// Mini-página que carga TU modelo de Teachable Machine y clasifica la foto que le mandamos.
const html = (url) => `<!doctype html><html><body>
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@teachablemachine/image@0.8/dist/teachablemachine-image.min.js"></script>
<script>
var modelo = null;
function enviar(o){ window.ReactNativeWebView.postMessage(JSON.stringify(o)); }
window.addEventListener('load', async function(){
  try { modelo = await tmImage.load('${url}model.json', '${url}metadata.json'); enviar({tipo:'listo'}); }
  catch(e){ enviar({tipo:'error', msg:String(e)}); }
});
function clasificar(id, b64){
  try {
    if(!modelo) throw new Error('El modelo aún no carga (¿hay internet?)');
    var img = new Image();
    img.onload = async function(){
      var p = await modelo.predict(img);
      enviar({tipo:'resultado', id:id, preds:p.map(function(x){ return {c:x.className, p:x.probability}; })});
    };
    img.onerror = function(){ enviar({tipo:'error', id:id, msg:'Imagen inválida'}); };
    img.src = 'data:image/jpeg;base64,' + b64;
  } catch(e){ enviar({tipo:'error', id:id, msg:String(e)}); }
}
</script></body></html>`;

/**
 * Uso:  const ref = useRef(); <Clasificador ref={ref} />
 *       const preds = await ref.current.clasificar(base64);   // [{c:'Patrulla', p:0.97}, ...]
 */
const Clasificador = forwardRef(function Clasificador({ onEstado }, ref) {
  const wv = useRef(null);
  const listo = useRef(false);
  const pend = useRef(new Map());

  useImperativeHandle(ref, () => ({
    estaListo: () => listo.current,
    clasificar: (b64) => new Promise((resolve, reject) => {
      if (!wv.current) return reject(new Error('Clasificador no disponible'));
      const id = `${Date.now()}-${Math.random()}`;
      const t = setTimeout(() => { pend.current.delete(id); reject(new Error('La IA tardó demasiado')); }, 25000);
      pend.current.set(id, { resolve, reject, t });
      wv.current.injectJavaScript(`clasificar(${JSON.stringify(id)}, ${JSON.stringify(b64)}); true;`);
    }),
  }));

  function onMessage(e) {
    let m; try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m.tipo === 'listo') { listo.current = true; onEstado && onEstado('listo'); return; }
    if (!m.id) { onEstado && onEstado(`error: ${m.msg}`); return; }
    const p = pend.current.get(m.id);
    if (!p) return;
    clearTimeout(p.t); pend.current.delete(m.id);
    if (m.tipo === 'resultado') p.resolve(m.preds); else p.reject(new Error(m.msg));
  }

  return (
    <View style={s.oculto} pointerEvents="none">
      <WebView ref={wv} originWhitelist={['*']} javaScriptEnabled onMessage={onMessage}
        source={{ html: html(TM_MODEL_URL), baseUrl: 'https://localhost' }} />
    </View>
  );
});
export default Clasificador;

const s = StyleSheet.create({ oculto: { position: 'absolute', width: 2, height: 2, opacity: 0, top: 0, left: 0 } });
