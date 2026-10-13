import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";

export const Route = createFileRoute("/documentos")({
  head: () => ({
    meta: [
      { title: "Documentos — SkyPilot" },
      { name: "description", content: "Pasta de documentos do piloto e do drone: licenças, seguro, registro e manuais." },
      { property: "og:title", content: "Documentos do piloto e do drone" },
      { property: "og:description", content: "Guarde licenças, seguro e registros do drone." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Docs,
});

type Doc = { id: string; folder: "piloto" | "drone"; name: string; type: string; data: string; expires?: string | undefined; added: string };
const KEY = "skypilot-docs";

function Docs() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [folder, setFolder] = useState<Doc["folder"]>("piloto");
  const [expires, setExpires] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => { try { setDocs(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { /* empty */ } }, []);
  const save = (d: Doc[]) => {
    try { localStorage.setItem(KEY, JSON.stringify(d)); setDocs(d); setMsg(""); }
    catch { setMsg("Espaço cheio: use arquivos menores."); }
  };

  const onFile = (f?: File) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => save([...docs, { id: crypto.randomUUID(), folder, name: f.name, type: f.type, data: String(r.result), expires: expires || undefined, added: new Date().toISOString() }]);
    r.readAsDataURL(f);
  };

  const list = docs.filter((d) => d.folder === folder);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-6 space-y-4">
        <div className="flex gap-2">
          {(["piloto", "drone"] as const).map((f) => (
            <button key={f} onClick={() => setFolder(f)} className={`hud-card flex-1 text-left ${folder === f ? "border-primary" : ""}`}>
              <div className="hud-label">Pasta</div>
              <div className="text-xl font-bold">{f === "piloto" ? "📁 Piloto" : "📁 Drone"}</div>
              <div className="text-xs text-muted-foreground">{docs.filter((d) => d.folder === f).length} documentos</div>
            </button>
          ))}
        </div>

        <div className="hud-card flex flex-col md:flex-row gap-3 md:items-end">
          <label className="flex-1">
            <div className="hud-label mb-1">Adicionar arquivo ({folder === "piloto" ? "licença, CHT, seguro…" : "SISANT, ANATEL, manual…"})</div>
            <input type="file" accept="image/*,application/pdf" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground" />
          </label>
          <label>
            <div className="hud-label mb-1">Validade (opcional)</div>
            <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className="bg-input rounded-md px-2 py-1.5 text-sm" />
          </label>
        </div>
        {msg && <p className="text-destructive text-sm">{msg}</p>}

        <div className="space-y-2">
          {list.length === 0 && <p className="text-muted-foreground text-sm">Nenhum documento nesta pasta.</p>}
          {list.map((d) => {
            const expired = d.expires && d.expires < today;
            return (
              <div key={d.id} className={`hud-card flex items-center justify-between gap-3 ${expired ? "border-destructive" : ""}`}>
                <div className="min-w-0">
                  <div className="font-medium truncate">{d.name}</div>
                  <div className={`text-xs font-mono ${expired ? "text-destructive" : "text-muted-foreground"}`}>
                    {d.expires ? `${expired ? "VENCIDO" : "Válido até"} ${new Date(d.expires + "T12:00").toLocaleDateString("pt-BR")}` : "Sem validade"}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <a href={d.data} download={d.name} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-md bg-secondary text-sm">Abrir</a>
                  <button onClick={() => save(docs.filter((x) => x.id !== d.id))} className="px-3 py-1.5 rounded-md text-destructive text-sm">Excluir</button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
