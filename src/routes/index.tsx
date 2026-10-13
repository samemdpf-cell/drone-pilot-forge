import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Nav } from "@/components/Nav";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SkyPilot — Painel de voo para pilotos de drone" },
      { name: "description", content: "Clima, ventos, rajadas, índice KP, GPS, satélites, aurora e nascer/pôr do sol para pilotos de drone." },
      { property: "og:title", content: "SkyPilot — Painel de voo" },
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
    if (r && typeof r === "object") { const o = r as Record<string, unknown>; const kp = Number(o.Kp ?? o.kp ?? o.kp_index); return isNaN(kp) ? [] : [{ time: String(o.time_tag), kp }]; }
    return [];
  });
}

const dirs = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"];

function Dashboard() {
  const { pos, err } = useGps();
  const lat = pos ? pos.lat.toFixed(2) : null, lon = pos ? pos.lon.toFixed(2) : null;

  const wx = useQuery({
    queryKey: ["wx", lat, lon],
    enabled: !!lat,
    refetchInterval: 600_000,
    queryFn: async () => {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility,cloud_cover&daily=sunrise,sunset,precipitation_probability_max&timezone=auto&wind_speed_unit=kmh`);
      return r.json();
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
  const kpNow = kp.data?.at(-1)?.kp;
  const kpMax = kpF.data?.length ? Math.max(...kpF.data.map((x) => x.kp)) : undefined;
  const gpsQ = !pos ? 0 : pos.acc <= 5 ? 4 : pos.acc <= 15 ? 3 : pos.acc <= 50 ? 2 : 1;
  const sats = !pos ? 0 : Math.max(4, Math.round(22 - Math.log2(pos.acc + 1) * 2.5));
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
        <div className={`hud-card border-${status} flex flex-col md:flex-row md:items-center justify-between gap-2`}>
          <div>
            <div className="hud-label">Status de voo</div>
            <div className={`text-3xl font-bold text-${status}`}>{statusText}</div>
            {issues.length > 0 && <div className="text-sm text-muted-foreground">{issues.join(" · ")}</div>}
          </div>
          <div className="font-mono text-sm text-muted-foreground">{err ? `GPS: ${err}` : pos ? `${pos.lat.toFixed(5)}, ${pos.lon.toFixed(5)}` : "Obtendo posição…"}</div>
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

        <h2 className="hud-label pt-2">GPS & clima espacial</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="hud-card">
            <div className="hud-label">Sinal GPS</div>
            <div className="flex items-end gap-1 h-10 mt-2">
              {[1, 2, 3, 4].map((i) => <div key={i} className={`w-3 rounded-sm ${i <= gpsQ ? "bg-primary" : "bg-muted"}`} style={{ height: `${i * 25}%` }} />)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Precisão ±{pos ? pos.acc.toFixed(0) : "--"} m</div>
          </div>
          <Stat label="Satélites (estimado)" v={pos ? sats : undefined} u="" sub="baseado na precisão" />
          <Stat label="Altitude GPS" v={pos?.alt != null ? pos.alt.toFixed(0) : undefined} u="m" sub={pos?.speed != null ? `Vel. ${(pos.speed * 3.6).toFixed(1)} km/h` : undefined} />
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
        <p className="text-xs text-muted-foreground">Dados: Open-Meteo e NOAA SWPC. Atualização automática.</p>
      </main>
    </div>
  );
}

function Stat({ label, v, u, sub, warn }: { label: string; v?: number | string; u: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`hud-card ${warn ? "border-warning" : ""}`}>
      <div className="hud-label">{label}</div>
      <div className={`font-mono text-3xl font-bold mt-1 ${warn ? "text-warning" : ""}`}>{v ?? "--"}<span className="text-sm text-muted-foreground ml-1">{u}</span></div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
