/// <reference types="google.maps" />

let loading: Promise<typeof google.maps> | undefined;

declare global {
  interface Window {
    initFlightMap?: () => void;
  }
}

export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const key = import.meta.env['VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY'];
    const channel = import.meta.env['VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID'];
    if (!key) { reject(new Error('Conexão do Google Maps indisponível.')); return; }
    if (window.google?.maps?.Map) { resolve(window.google.maps); return; }
    window.initFlightMap = () => {
      resolve(window.google.maps);
      delete window.initFlightMap;
    };
    const script = document.createElement('script');
    const params = new URLSearchParams({ key, loading: 'async', callback: 'initFlightMap', language: 'pt-BR', region: 'BR', channel: channel ?? '' });
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => { reject(new Error('Não foi possível carregar o mapa.')); };
    document.head.appendChild(script);
  });
  return loading;
}