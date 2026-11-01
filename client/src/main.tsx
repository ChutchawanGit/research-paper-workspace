import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Polyfill Map.prototype.getOrInsertComputed for mobile browsers (Samsung Internet / Chrome Android / Safari)
interface EmplaceMap<K, V> {
  getOrInsertComputed?: (key: K, callbackfn: (key: K) => V) => V;
}

const mapProto = Map.prototype as unknown as EmplaceMap<unknown, unknown>;
if (!mapProto.getOrInsertComputed) {
  mapProto.getOrInsertComputed = function (key: unknown, callbackfn: (k: unknown) => unknown) {
    const map = this as unknown as Map<unknown, unknown>;
    if (map.has(key)) {
      return map.get(key);
    }
    const value = callbackfn(key);
    map.set(key, value);
    return value;
  };
}

const weakMapProto = WeakMap.prototype as unknown as EmplaceMap<object, unknown>;
if (!weakMapProto.getOrInsertComputed) {
  weakMapProto.getOrInsertComputed = function (key: object, callbackfn: (k: object) => unknown) {
    const wmap = this as unknown as WeakMap<object, unknown>;
    if (wmap.has(key)) {
      return wmap.get(key);
    }
    const value = callbackfn(key);
    wmap.set(key, value);
    return value;
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
