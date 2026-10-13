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
      <div className="flex items-start gap-2 border-l-2 border-warning pl-3 text-sm">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
        <div><p className="font-semibold text-warning">Restrições oficiais ainda não carregadas</p><p className="text-muted-foreground">Este mapa identifica o local, mas não indica autorização de voo. Confira áreas restritas, aeródromos, helipontos e NOTAM no DECEA antes de decolar.</p></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild><a href="https://sarpas.decea.mil.br" target="_blank" rel="noreferrer">SARPAS / restrições<ExternalLink /></a></Button>
        <Button variant="outline" asChild><a href="https://aisweb.decea.mil.br" target="_blank" rel="noreferrer">AISWEB / NOTAM<ExternalLink /></a></Button>
      </div>
    </section>
  );
}