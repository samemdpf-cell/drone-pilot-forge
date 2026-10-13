import { useEffect, useRef, useState } from 'react';
import { ExternalLink, LocateFixed, MapPin, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadGoogleMaps } from '@/lib/google-maps';

type Location = { lat: number; lon: number };

export function AirspaceMap({ location, name }: { location: Location | null; name: string | null }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const marker = useRef<google.maps.Marker | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [areas, setAreas] = useState<'loading' | 'ready' | 'error'>('loading');
  const lat = location?.lat;
  const lon = location?.lon;

  useEffect(() => {
    if (lat === undefined || lon === undefined || !container.current) return;
    let disposed = false;
    setState('loading');
    loadGoogleMaps().then((maps) => {
      if (disposed || !container.current) return;
      const position = { lat, lng: lon };
      if (!map.current) {
        map.current = new maps.Map(container.current, {
          center: position, zoom: 12, clickableIcons: false,
          mapTypeId: 'hybrid', streetViewControl: false,
          mapTypeControl: true, fullscreenControl: true,
          gestureHandling: 'cooperative',
        });
        marker.current = new maps.Marker({ map: map.current, position, title: 'Local do voo' });
        const activeMap = map.current;
        const colors = getComputedStyle(document.documentElement);
        const palette: Record<string, string> = { P: colors.getPropertyValue('--airspace-prohibited').trim(), R: colors.getPropertyValue('--airspace-restricted').trim(), D: colors.getPropertyValue('--airspace-danger').trim() };
        activeMap.data.setStyle((feature) => ({ fillColor: palette[String(feature.getProperty('tipo'))] ?? palette['R'] ?? '', strokeColor: palette[String(feature.getProperty('tipo'))] ?? palette['R'] ?? '', fillOpacity: 0.22, strokeWeight: 2 }));
        const info = new maps.InfoWindow();
        activeMap.data.addListener('click', (event: google.maps.Data.MouseEvent) => {
          const content = document.createElement('div');
          content.className = 'airspace-info';
          const labels: Record<string, string> = { P: 'Proibida', R: 'Restrita', D: 'Perigosa' };
          content.textContent = `${event.feature.getProperty('id')} — ${event.feature.getProperty('nome')} · Área ${labels[String(event.feature.getProperty('tipo'))] ?? ''} · Limite inferior: ${event.feature.getProperty('lowerlimit')} ${event.feature.getProperty('uom_llimit')} · Limite superior: ${event.feature.getProperty('upperlimit')} ${event.feature.getProperty('uom_ulimit')}. Confira a publicação vigente no DECEA.`;
          info.setContent(content);
          info.setPosition(event.latLng);
          info.open(activeMap);
        });
        void fetch('/data/decea-airspace.geojson').then(async (response) => {
          if (!response.ok) throw new Error('Áreas indisponíveis');
          const data: unknown = await response.json();
          if (map.current !== activeMap) return;
          activeMap.data.addGeoJson(data as object);
          setAreas('ready');
        }).catch(() => { if (map.current === activeMap) setAreas('error'); });
      } else {
        map.current.setCenter(position);
        marker.current?.setPosition(position);
      }
      setState('ready');
    }).catch((e: unknown) => {
      if (disposed) return;
      setError(e instanceof Error ? e.message : 'Mapa indisponível.');
      setState('error');
    });
    return () => { disposed = true; };
  }, [lat, lon]);

  useEffect(() => () => {
    marker.current?.setMap(null);
    map.current = null;
    marker.current = null;
  }, []);

  return (
    <section className="space-y-3" aria-labelledby="airspace-map-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="airspace-map-title" className="flex items-center gap-2 font-semibold"><MapPin className="size-4 text-primary" />Mapa e restrições de voo</h3>
        <Button variant="outline" size="icon" title="Centralizar no local do voo" aria-label="Centralizar no local do voo" disabled={state !== 'ready'} onClick={() => {
          if (location) { map.current?.setCenter({ lat: location.lat, lng: location.lon }); map.current?.setZoom(12); }
        }}><LocateFixed /></Button>
      </div>
      <p className="break-words text-sm text-muted-foreground">{name ?? 'Local ainda não definido'}{location ? ` · ${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}` : ''}</p>
      <div className="relative h-80 overflow-hidden rounded-md border border-border bg-muted sm:h-96">
        <div ref={container} className="h-full w-full" aria-label="Mapa do local de voo" />
        {state !== 'ready' && <div role="status" className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">{!location ? 'Selecione uma cidade, CEP ou permita o GPS para localizar o voo.' : state === 'error' ? error : 'Carregando mapa…'}</div>}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs" aria-label="Legenda de restrições">
        <span className="flex items-center gap-2"><span className="size-3 bg-destructive" />Proibida (P)</span>
        <span className="flex items-center gap-2"><span className="size-3 bg-warning" />Restrita (R)</span>
        <span className="flex items-center gap-2"><span className="size-3 bg-accent" />Perigosa (D)</span>
      </div>
      <div className="flex items-start gap-2 border-l-2 border-warning pl-3 text-sm">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
        <div><p className="font-semibold text-warning">{areas === 'ready' ? 'Áreas DECEA · consulta informativa' : areas === 'error' ? 'Não foi possível carregar as áreas oficiais' : 'Aguardando carregamento das áreas oficiais'}</p><p className="text-muted-foreground">Fonte: GeoAISWEB / ICA / DECEA, obtida em 13/10/2026. Não inclui todas as zonas para drones, CTR/TMA ou restrições temporárias de NOTAM. Ausência de área colorida não significa voo autorizado; confirme no SARPAS e AISWEB.</p></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild><a href="https://sarpas.decea.mil.br" target="_blank" rel="noreferrer">SARPAS / restrições<ExternalLink /></a></Button>
        <Button variant="outline" asChild><a href="https://aisweb.decea.mil.br" target="_blank" rel="noreferrer">AISWEB / NOTAM<ExternalLink /></a></Button>
      </div>
    </section>
  );
}