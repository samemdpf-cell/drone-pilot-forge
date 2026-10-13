import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Nav } from "@/components/Nav";
import { Button } from "@/components/ui/button";
import { FlightChecklist } from "@/components/FlightChecklist";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Checklist Pilotos Profissional — Painel de voo para pilotos de drone" },

      { name: "description", content: "Clima, ventos, rajadas, índice KP, GPS, satélites, aurora e nascer/pôr do sol para pilotos de drone." },
      { property: "og:title", content: "Checklist Pilotos Profissional — Painel de voo" },
      { property: "og:description", content: "Condições de voo em tempo real para pilotos de drone." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

type Pos = { lat: number; lon: number; alt: number | null; acc: number; speed: number | null };

function useGps() {
  const [pos, setPos] = useState<Pos | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!navigator.geolocation) { setErr("GPS indisponível"); return; }
    const id = navigator.geolocation.watchPosition(
      (p) => setPos({ lat: p.coords.latitude, lon: p.coords.longitude, alt: p.coords.altitude, acc: p.coords.accuracy, speed: p.coords.speed }),
      (e) => setErr(e.message),
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);
  return { pos, err };
}

function parseKp(rows: unknown): { time: string; kp: number }[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((r) => {
    if (Array.isArray(r)) { const kp = Number(r[1]); return isNaN(kp) ? [] : [{ time: String(r[0]), kp }]; }
    if (r && typeof r === "object") { const o = r as Record<string, unknown>; const kp = Number(o["Kp"] ?? o["kp"] ?? o["kp_index"]); return isNaN(kp) ? [] : [{ time: String(o["time_tag"]), kp }]; }
    return [];
  });
}

const dirs = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];

type Place = { lat: number; lon: number; name: string };

async function searchPlace(q: string): Promise<Place> {
  const cep = q.replace(/\D/g, "");
  let query = q.trim();
  if (/^\d{8}$/.test(cep)) {
    const v = await (await fetch(`https://viacep.com.br/ws/${cep}/json/`)).json();
    if (v.erro) throw new Error("CEP não encontrado");
    query = v.localidade;
    const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=pt&countryCode=BR`)).json();
    const hit = g.results?.find((r: { admin1?: string }) => r.admin1 && v.estado && r.admin1 === v.estado) ?? g.results?.[0];
    if (!hit) throw new Error("Cidade do CEP não encontrada");
    return { lat: hit.latitude, lon: hit.longitude, name: `${v.localidade} - ${v.uf} (CEP ${v.cep})` };
  }
  const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=pt`)).json();
  const hit = g.results?.[0];
  if (!hit) throw new Error("Cidade não encontrada");
  return { lat: hit.latitude, lon: hit.longitude, name: [hit.name, hit.admin1, hit.country].filter(Boolean).join(", ") };
}

function Dashboard() {
  const { pos, err } = useGps();
  const [place, setPlace] = useState<Place | null>(null);
  const [q, setQ] = useState("");
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const src = place ?? (pos ? { lat: pos.lat, lon: pos.lon } : null);
  const lat = src ? src.lat.toFixed(2) : null, lon = src ? src.lon.toFixed(2) : null;
  const gpsCity = useQuery({
    queryKey: ["rev", pos?.lat.toFixed(2), pos?.lon.toFixed(2)],
    enabled: !!pos && !place,
    queryFn: async () => {
      if (!pos) return null;
      const r = await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.lat}&lon=${pos.lon}&zoom=10&accept-language=pt-BR`)).json();
      const a = r.address ?? {};
      return [a.city ?? a.town ?? a.village ?? a.municipality, a.state].filter(Boolean).join(" - ") || null;
    },
  });
  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true); setSearchErr(null);
    try { setPlace(await searchPlace(q)); } catch (x) { setSearchErr((x as Error).message); } finally { setBusy(false); }
  };
  const locName = place ? place.name : gpsCity.data ? `${gpsCity.data} (GPS)` : pos ? "Sua posição (GPS)" : null;

  const wx = useQuery({
    queryKey: ["wx", lat, lon],
    enabled: !!lat,
    refetchInterval: 600_000,
    queryFn: async () => {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility,cloud_cover&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,wind_speed_80m,wind_speed_120m,wind_speed_180m,wind_direction_120m&forecast_hours=24&daily=sunrise,sunset,precipitation_probability_max&timezone=auto&wind_speed_unit=kmh`);
      return r.json();
    },
  });
  const aq = useQuery({
    queryKey: ["aq", lat, lon], enabled: !!lat, refetchInterval: 1_800_000,
    queryFn: async () => (await (await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5,pm10,ozone,carbon_monoxide`)).json()).current,
  });
  const clim = useQuery({
    queryKey: ["clim", lat, lon], enabled: !!lat, staleTime: Infinity,
    queryFn: async () => {
      const end = new Date(Date.now() - 7 * 864e5), start = new Date(end); start.setFullYear(end.getFullYear() - 5);
      const f = (x: Date) => x.toISOString().slice(0, 10);
      const j = await (await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${f(start)}&end_date=${f(end)}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max&timezone=auto`)).json();
      const m = new Date().getMonth(), idx: number[] = [];
      (j.daily?.time ?? []).forEach((t: string, i: number) => { if (new Date(t + "T12:00").getMonth() === m) idx.push(i); });
      const avg = (k: string) => { const v = idx.map((i) => j.daily[k][i]).filter((x: number | null) => x != null); return v.length ? v.reduce((a: number, b: number) => a + b, 0) / v.length : undefined; };
      const rainDays = idx.filter((i) => (j.daily.precipitation_sum[i] ?? 0) >= 1).length;
      const years = new Set(idx.map((i) => j.daily.time[i].slice(0, 4))).size || 1;
      return { tmax: avg("temperature_2m_max"), tmin: avg("temperature_2m_min"), rain: (avg("precipitation_sum") ?? 0) * 30, rainDays: Math.round(rainDays / years), wind: avg("wind_speed_10m_max"), gust: avg("wind_gusts_10m_max") };
    },
  });
  const kp = useQuery({
    queryKey: ["kp"], refetchInterval: 900_000,
    queryFn: async () => parseKp(await (await fetch("https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json")).json()),
  });
  const kpF = useQuery({
    queryKey: ["kpf"], refetchInterval: 1_800_000,
    queryFn: async () => parseKp(await (await fetch("https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json")).json()),
  });

  const c = wx.data?.current;
  const d = wx.data?.daily;
  const h = wx.data?.hourly;
  const dirName = (g?: number) => (g == null ? "--" : dirs[Math.round(g / 45) % 8]);
  const aqi = aq.data?.us_aqi as number | undefined;
  const aqiTxt = aqi == null ? "" : aqi <= 50 ? "Boa" : aqi <= 100 ? "Moderada" : aqi <= 150 ? "Ruim p/ sensíveis" : aqi <= 200 ? "Ruim" : "Muito ruim";
  const monthName = new Date().toLocaleDateString("pt-BR", { month: "long" });
  const kpNow = kp.data?.at(-1)?.kp;
  const kpMax = kpF.data?.length ? Math.max(...kpF.data.map((x) => x.kp)) : undefined;
  const gpsQ = !pos ? 0 : pos.acc <= 5 ? 4 : pos.acc <= 15 ? 3 : pos.acc <= 50 ? 2 : 1;
  const sats = !pos ? 0 : Math.max(4, Math.round(22 - Math.log2(pos.acc + 1) * 2.5));
  const isSearched = !!place;
  // Estimativa para o local buscado: constelação visível conforme a latitude, reduzida por nuvens e tempestade geomagnética (KP)
  const baseSats = src ? 12 - (Math.abs(src.lat) > 55 ? 3 : Math.abs(src.lat) > 35 ? 1 : 0) : 10;
  const cloudAdj = c?.cloud_cover != null ? (c.cloud_cover > 80 ? 2 : c.cloud_cover > 50 ? 1 : 0) : 0;
  const kpAdj = (kpNow ?? 0) >= 8 ? 3 : (kpNow ?? 0) >= 5 ? 2 : 0;
  const estSats = Math.max(3, baseSats - cloudAdj - kpAdj);
  const estQ = estSats >= 9 ? 4 : estSats >= 7 ? 3 : estSats >= 5 ? 2 : 1;
  const shownQ = isSearched ? estQ : gpsQ;
  const shownSats = isSearched ? estSats : sats;
  const fmtT = (s?: string) => (s ? new Date(s).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--");

  const gust = c?.wind_gusts_10m ?? 0, wind = c?.wind_speed_10m ?? 0;
  const issues = [
    wind > 30 && "vento médio alto", gust > 38 && "rajadas fortes", (c?.precipitation ?? 0) > 0 && "precipitação",
    (c?.visibility ?? 99999) < 3000 && "visibilidade baixa", (kpNow ?? 0) >= 5 && "KP elevado (GPS instável)",
  ].filter(Boolean) as string[];
  const status = !c ? "warning" : issues.length === 0 ? "success" : issues.length < 2 ? "warning" : "destructive";
  const statusText = !c ? "Aguardando dados" : issues.length === 0 ? "APTO PARA VOO" : issues.length < 2 ? "VOO COM CAUTELA" : "NÃO RECOMENDADO";

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-4">
        <div className="hud-card space-y-2">
          <div className="hud-label">Local</div>
          <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0 break-words text-xl font-bold text-primary">{locName ?? (err ? `GPS: ${err}` : "Obtendo posição…")}</div>
            {locName && <span className={`w-fit shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${isSearched ? "border-primary text-primary" : "border-success text-success"}`}>{isSearched ? "Local buscado" : "GPS do aparelho"}</span>}
          </div>
          {locName && <div className="text-xs text-muted-foreground">Todos os dados abaixo se referem a este local.</div>}
          <form onSubmit={onSearch} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex">
            <input aria-label="Cidade ou CEP" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cidade ou CEP" className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-base" />
            <Button type="submit" disabled={busy} className="h-11">{busy ? "Buscando…" : "Buscar"}</Button>
            {place && <Button variant="outline" type="button" onClick={() => { setPlace(null); setQ(""); }} className="col-span-2 h-11">Usar GPS</Button>}
          </form>
          {searchErr && <div className="text-sm text-destructive">{searchErr}</div>}
        </div>
        <div className={`hud-card ${({success:"border-success",warning:"border-warning",destructive:"border-destructive"})[status]} flex flex-col md:flex-row md:items-center justify-between gap-2`}>
          <div>
            <div className="hud-label">Condição de voo</div>
            <div className={`text-2xl sm:text-3xl font-bold ${({success:"text-success",warning:"text-warning",destructive:"text-destructive"})[status]}`}>{statusText}</div>
            {issues.length > 0 && <div className="text-sm text-muted-foreground">{issues.join(" · ")}</div>}
            {issues.length === 0 && c && <div className="text-sm text-muted-foreground">Todos os parâmetros dentro do limite</div>}
          </div>
          <div className="min-w-0 break-words font-mono text-sm text-muted-foreground">{locName ? `Exibindo: ${locName}` : err ? `GPS: ${err}` : "Obtendo posição…"}</div>
        </div>

        <h2 className="hud-label pt-2">Clima</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Temperatura" v={c?.temperature_2m} u="°C" />
          <Stat label="Vento médio" v={c?.wind_speed_10m} u="km/h" sub={c ? `Direção ${dirs[Math.round(c.wind_direction_10m / 45) % 8]} ${c.wind_direction_10m}°` : undefined} warn={wind > 30} />
          <Stat label="Rajadas" v={c?.wind_gusts_10m} u="km/h" warn={gust > 38} />
          <Stat label="Precipitação" v={c?.precipitation} u="mm" sub={d ? `Prob. hoje ${d.precipitation_probability_max?.[0] ?? "--"}%` : undefined} warn={(c?.precipitation ?? 0) > 0} />
          <Stat label="Visibilidade" v={c ? (c.visibility / 1000).toFixed(1) : undefined} u="km" warn={(c?.visibility ?? 99999) < 3000} />
          <Stat label="Umidade relativa" v={c?.relative_humidity_2m} u="%" />
          <Stat label="Nebulosidade" v={c?.cloud_cover} u="%" />
          <div className="hud-card">
            <div className="hud-label">Sol</div>
            <div className="font-mono text-lg mt-1">☀ {fmtT(d?.sunrise?.[0])}</div>
            <div className="font-mono text-lg">☾ {fmtT(d?.sunset?.[0])}</div>
            <div className="text-xs text-muted-foreground">nascer · pôr do sol</div>
          </div>
        </div>

        <FlightChecklist location={locName} />
        <h2 className="hud-label pt-2">GPS & clima espacial</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="hud-card">
            <div className="hud-label">Sinal GPS{isSearched ? " (local)" : ""}</div>
            <div className="flex items-end gap-1 h-10 mt-2">
              {[1, 2, 3, 4].map((i) => <div key={i} className={`w-3 rounded-sm ${i <= shownQ ? "bg-primary" : "bg-muted"}`} style={{ height: `${i * 25}%` }} />)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{isSearched ? "Estimativa para o local buscado" : `Precisão ±${pos ? pos.acc.toFixed(0) : "--"} m`}</div>
          </div>
          <Stat label="Latitude" v={src ? src.lat.toFixed(4) : undefined} u="°" sub={place ? "Do local buscado" : "GPS do aparelho"} />
          <Stat label="Longitude" v={src ? src.lon.toFixed(4) : undefined} u="°" sub={place ? "Do local buscado" : "GPS do aparelho"} />
          <Stat label="Satélites (estimado)" v={src ? shownSats : undefined} u="" sub={isSearched ? "Estimativa para o local: latitude, nuvens e KP" : "baseado na precisão do aparelho"} />
          <Stat label="Altitude GPS" v={isSearched ? undefined : pos?.alt != null ? pos.alt.toFixed(0) : undefined} u="m" sub={isSearched ? "Só disponível pelo GPS do aparelho" : pos?.speed != null ? `Vel. ${(pos.speed * 3.6).toFixed(1)} km/h` : undefined} />
          <Stat label="Índice KP atual" v={kpNow?.toFixed(1)} u="" warn={(kpNow ?? 0) >= 5} sub={(kpNow ?? 0) >= 5 ? "Tempestade geomagnética" : "Estável"} />
        </div>

        <div className={`hud-card ${(kpMax ?? 0) >= 8 ? "border-destructive" : ""}`}>
          <div className="flex justify-between items-start">
            <div>
              <div className="hud-label">Alerta aurora · KP8</div>
              <div className={`text-2xl font-bold ${(kpMax ?? 0) >= 8 ? "text-destructive" : "text-success"}`}>
                {kpMax === undefined ? "--" : kpMax >= 8 ? "KP8+ PREVISTO" : "Sem KP8 previsto"}
              </div>
              <div className="text-sm text-muted-foreground">Máximo previsto (3 dias): KP {kpMax?.toFixed(1) ?? "--"}. Com KP ≥ 8 o GPS pode perder precisão e auroras podem ser visíveis em latitudes baixas.</div>
            </div>
          </div>
          <div className="flex items-end gap-0.5 h-20 mt-3">
            {kpF.data?.slice(-24).map((x, i) => (
              <div key={i} title={`${x.time}: ${x.kp}`} className={`flex-1 rounded-t-sm ${x.kp >= 8 ? "bg-destructive" : x.kp >= 5 ? "bg-warning" : "bg-primary"}`} style={{ height: `${(x.kp / 9) * 100}%` }} />
            ))}
          </div>
        </div>

        <h2 className="hud-label pt-2">Vento: direção, velocidade e altitude</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="hud-card flex flex-col items-center">
            <div className="hud-label self-start">Direção do vento</div>
            <div className="relative h-20 w-20 rounded-full border border-border mt-2">
              <div className="absolute inset-0 flex items-start justify-center text-[10px] text-muted-foreground">N</div>
              <div className="absolute inset-0 flex items-center justify-center text-2xl text-primary" style={{ transform: `rotate(${(c?.wind_direction_10m ?? 0) + 180}deg)` }}>↑</div>
            </div>
            <div className="font-mono text-sm mt-1">{dirName(c?.wind_direction_10m)} {c?.wind_direction_10m ?? "--"}°</div>
          </div>
          <Stat label="Velocidade (10 m)" v={c?.wind_speed_10m} u="km/h" warn={wind > 30} sub={`Rajadas ${c?.wind_gusts_10m ?? "--"} km/h`} />
          <Stat label="Vento a 80 m" v={h?.wind_speed_80m?.[0]} u="km/h" warn={(h?.wind_speed_80m?.[0] ?? 0) > 30} />
          <Stat label="Vento a 120 m" v={h?.wind_speed_120m?.[0]} u="km/h" warn={(h?.wind_speed_120m?.[0] ?? 0) > 30} sub={`Direção ${dirName(h?.wind_direction_120m?.[0])} · 180 m: ${h?.wind_speed_180m?.[0] ?? "--"} km/h`} />
        </div>

        <div className="hud-card overflow-x-auto">
          <div className="hud-label mb-2">Previsão de ventos e visibilidade · próximas 24 h</div>
          <table className="w-full font-mono text-xs">
            <thead className="text-muted-foreground"><tr><th className="text-left p-1">Hora</th><th className="p-1">Dir.</th><th className="p-1">10 m</th><th className="p-1">Rajada</th><th className="p-1">120 m</th><th className="p-1">Visib.</th></tr></thead>
            <tbody>
              {h?.time?.filter((_: string, i: number) => i % 2 === 0).map((t: string, k: number) => { const i = k * 2; const g = h.wind_gusts_10m[i]; return (
                <tr key={t} className="border-t border-border text-center">
                  <td className="text-left p-1">{fmtT(t)}</td>
                  <td className="p-1"><span className="inline-block text-primary" style={{ transform: `rotate(${h.wind_direction_10m[i] + 180}deg)` }}>↑</span> {dirName(h.wind_direction_10m[i])}</td>
                  <td className={`p-1 ${h.wind_speed_10m[i] > 30 ? "text-warning" : ""}`}>{h.wind_speed_10m[i]}</td>
                  <td className={`p-1 ${g > 38 ? "text-warning" : ""}`}>{g}</td>
                  <td className="p-1">{h.wind_speed_120m[i]}</td>
                  <td className={`p-1 ${h.visibility[i] < 3000 ? "text-warning" : ""}`}>{(h.visibility[i] / 1000).toFixed(1)} km</td>
                </tr>); })}
            </tbody>
          </table>
          <div className="text-xs text-muted-foreground mt-1">Velocidades em km/h.</div>
        </div>

        <h2 className="hud-label pt-2">Qualidade do ar</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Índice (AQI)" v={aqi} u="" sub={aqiTxt} warn={(aqi ?? 0) > 100} />
          <Stat label="PM2.5" v={aq.data?.pm2_5} u="µg/m³" />
          <Stat label="PM10" v={aq.data?.pm10} u="µg/m³" />
          <Stat label="Ozônio" v={aq.data?.ozone} u="µg/m³" />
        </div>

        <h2 className="hud-label pt-2">Climatologia do local · {monthName}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Máx. média" v={clim.data?.tmax?.toFixed(1)} u="°C" sub={`Mín. média ${clim.data?.tmin?.toFixed(1) ?? "--"} °C`} />
          <Stat label="Chuva no mês" v={clim.data?.rain.toFixed(0)} u="mm" sub={`~${clim.data?.rainDays ?? "--"} dias com chuva`} />
          <Stat label="Vento máx. médio" v={clim.data?.wind?.toFixed(0)} u="km/h" />
          <Stat label="Rajada máx. média" v={clim.data?.gust?.toFixed(0)} u="km/h" />
        </div>
        <div className="text-xs text-muted-foreground">{clim.isLoading ? "Calculando climatologia…" : "Médias dos últimos 5 anos para este mês."}</div>

        <h2 className="hud-label pt-2">Espaço aéreo</h2>
        <div className="hud-card space-y-2 text-sm">
          <div>Antes de voar, consulte as restrições oficiais do DECEA para {locName ?? "o local"} ({src ? `${src.lat.toFixed(4)}, ${src.lon.toFixed(4)}` : "--"}).</div>
          <ul className="list-disc pl-5 text-muted-foreground space-y-1">
            <li>Altura máxima padrão: 120 m (400 ft) acima do solo.</li>
            <li>Distância de aeródromos e helipontos conforme ICA 100-40 / zonas de aproximação.</li>
            <li>Voo em linha de visada (VLOS) e afastado de pessoas não envolvidas.</li>
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            <a href="https://sarpas.decea.mil.br" target="_blank" rel="noreferrer" className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground">SARPAS (solicitar voo)</a>
            <a href="https://aisweb.decea.mil.br" target="_blank" rel="noreferrer" className="rounded-md border border-input px-3 py-1.5">AISWEB / NOTAM</a>
            {src && <a href={`https://www.openaip.net/map#10/${src.lat}/${src.lon}`} target="_blank" rel="noreferrer" className="rounded-md border border-input px-3 py-1.5">Mapa do espaço aéreo</a>}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Dados: Open-Meteo e NOAA SWPC. Atualização automática.</p>
      </main>
    </div>
  );
}

function Stat({ label, v, u, sub, warn }: { label: string; v?: number | string | undefined; u: string; sub?: string | undefined; warn?: boolean | undefined }) {
  return (
    <div className={`hud-card min-w-0 ${warn ? "border-warning" : ""}`}>
      <div className="hud-label">{label}</div>
      <div className={`flex flex-wrap items-baseline gap-x-1 font-mono ${label === "Latitude" || label === "Longitude" ? "text-xl" : "text-2xl"} sm:text-3xl font-bold mt-1 ${warn ? "text-warning" : ""}`}><span>{v ?? "--"}</span><span className="text-xs sm:text-sm text-muted-foreground">{u}</span></div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
