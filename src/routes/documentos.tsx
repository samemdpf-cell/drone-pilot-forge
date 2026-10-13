import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listAccountDocuments, uploadAccountDocument, downloadDocument, documentData, deleteAccountDocument, type AccountDocument } from "@/lib/account-documents";
import { expiryStatus, localToday } from "@/lib/document-expiry";
import { Nav } from "@/components/Nav";
import { DocumentReview } from "@/components/DocumentReview";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/documentos")({
  head: () => ({
    meta: [
      { title: "Documentos — Checklist Pilotos Profissional" },
      { name: "description", content: "Pasta de documentos do piloto e do drone: licenças, seguro, registro e manuais." },
      { property: "og:title", content: "Documentos do piloto e do drone" },
      { property: "og:description", content: "Guarde licenças, seguro e registros do drone." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Docs,
});

type LegacyDoc = { id: string; folder: "piloto" | "drone"; name: string; type: string; data: string; expires?: string };
const KEY = "skypilot-docs";

function Docs() {
  const [userId, setUserId] = useState<string | null>(null);
  const [folder, setFolder] = useState<"piloto" | "drone">("piloto");
  const [expires, setExpires] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [legacy, setLegacy] = useState<LegacyDoc[]>([]);
  const queryClient = useQueryClient();
  const queryKey = ["account-documents", userId];
  const documents = useQuery({ queryKey, enabled: !!userId, queryFn: () => userId ? listAccountDocuments(userId) : Promise.resolve([]) });
  const docs = userId ? documents.data ?? [] : [];
  const today = localToday();
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setMsg("");
      if (!session) queryClient.removeQueries({ queryKey: ["account-documents"] });
    });
    try { const saved: unknown = JSON.parse(localStorage.getItem(KEY) || "[]"); if (Array.isArray(saved)) setLegacy(saved.filter((d): d is LegacyDoc => !!d && typeof d.id === 'string' && typeof d.data === 'string' && typeof d.name === 'string' && (d.folder === 'piloto' || d.folder === 'drone'))); } catch { /* Keep legacy files untouched. */ }
    return () => data.subscription.unsubscribe();
  }, [queryClient]);
  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const upload = async (file?: File) => {
    if (!file || !userId) return;
    setBusy(true); setMsg("");
    try { await uploadAccountDocument(userId, file, { name: file.name, folder, expires }); await refresh(); setMsg("Documento salvo na sua conta."); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Não foi possível salvar o documento. Tente novamente."); }
    finally { setBusy(false); }
  };
  const migrate = async () => {
    if (!userId) return;
    setBusy(true); setMsg("");
    try {
      for (const doc of legacy) {
        const blob = await (await fetch(doc.data)).blob();
        await uploadAccountDocument(userId, blob, { id: doc.id, name: doc.name, folder: doc.folder, expires: doc.expires });
      }
      await refresh();
      localStorage.removeItem(KEY); setLegacy([]); setMsg("Todos os documentos deste aparelho foram salvos na sua conta.");
    } catch { setMsg("A transferência não foi concluída. Os originais continuam neste aparelho; tente novamente."); await refresh(); }
    finally { setBusy(false); }
  };
  const open = async (doc: AccountDocument) => {
    setBusy(true); setMsg("");
    try {
      const blob = await downloadDocument(doc);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = doc.name; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { setMsg("Não foi possível baixar o arquivo. Tente novamente."); }
    finally { setBusy(false); }
  };
  const remove = async (doc: AccountDocument) => {
    if (!window.confirm(`Excluir ${doc.name} da sua conta em todos os aparelhos?`)) return;
    setBusy(true); setMsg("");
    try { await deleteAccountDocument(doc); await refresh(); }
    catch { setMsg("Não foi possível excluir o documento. Tente novamente."); }
    finally { setBusy(false); }
  };
  const saveExpiry = async (id: string, expiry: string) => {
    if (!userId) throw new Error('Entre na sua conta.');
    if (expiryStatus(expiry, today) === 'unknown') throw new Error('Data inválida.');
    const { error } = await supabase.from('pilot_documents').update({ expires_on: expiry }).eq('id', id).eq('user_id', userId);
    if (error) throw error;
    await refresh();
  };
  const alerts = docs.filter((d) => ['soon', 'expired'].includes(expiryStatus(d.expires_on, today)));
  const list = docs.filter((d) => d.folder === folder);
  return <div className="min-h-screen"><Nav /><main className="mx-auto max-w-4xl px-4 py-6 space-y-4">
    {userId && <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm text-success">Documentos privados da sua conta</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={busy} onClick={() => void refresh()}>Atualizar</Button><Button variant="ghost" size="sm" disabled={busy} onClick={() => void supabase.auth.signOut()}>Sair</Button></div></div>}
    <DocumentReview key={userId ?? 'signed-out'} docs={docs.map((d) => ({ id: d.id, name: d.name, type: d.mime_type, expires: d.expires_on }))} loadData={async (id) => { const doc = docs.find((d) => d.id === id); if (!doc) throw new Error('Documento indisponível.'); return documentData(doc); }} onExpiry={saveExpiry} />
    {userId && legacy.length > 0 && <section className="border-l-2 border-warning pl-3 space-y-2"><p className="text-sm">{legacy.length} documentos salvos somente neste aparelho.</p><Button disabled={busy} onClick={() => void migrate()}>Salvar documentos deste aparelho na minha conta</Button></section>}
    {userId && alerts.length > 0 && <section className="border-y border-warning py-3 space-y-2" aria-label="Alertas de validade"><h2 className="font-semibold text-warning">Validade dos documentos</h2>{alerts.map((d) => <div key={d.id} className="text-sm break-words"><strong className={expiryStatus(d.expires_on, today) === 'expired' ? 'text-destructive' : 'text-warning'}>{expiryStatus(d.expires_on, today) === 'expired' ? 'Vencido' : 'Vence em até 30 dias'}</strong> · {d.name} · {d.expires_on} · {d.folder === 'piloto' ? 'Piloto' : 'Drone'}</div>)}</section>}
    <div className="flex gap-2">{(["piloto", "drone"] as const).map((f) => <Button variant="outline" key={f} onClick={() => setFolder(f)} className={`hud-card h-auto flex-1 flex-col items-start text-left ${folder === f ? "border-primary" : ""}`}><div className="hud-label">Pasta</div><div className="text-xl font-bold">{f === "piloto" ? "📁 Piloto" : "📁 Drone"}</div><div className="text-xs text-muted-foreground">{docs.filter((d) => d.folder === f).length} documentos</div></Button>)}</div>
    <div className="flex flex-col md:flex-row gap-3 md:items-end border-y border-border py-4"><label className="min-w-0 flex-1"><div className="hud-label mb-1">Adicionar arquivo ({folder === "piloto" ? "licença, CHT, seguro…" : "SISANT, ANATEL, manual…"})</div><input disabled={!userId || busy} aria-label="Adicionar documento" type="file" accept="image/*,application/pdf" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} className="w-full min-w-0 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground disabled:opacity-50" /></label><label><div className="hud-label mb-1">Validade (opcional)</div><input aria-label="Validade" disabled={!userId || busy} type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className="bg-input rounded-md px-2 py-1.5 text-sm" /></label></div>
    {busy && <p role="status" className="text-sm text-muted-foreground">Aguarde…</p>}{msg && <p role="status" className="text-sm break-words">{msg}</p>}{documents.error && <p role="alert" className="text-destructive text-sm">Não foi possível carregar os documentos. Tente atualizar.</p>}
    <div className="space-y-2">{documents.isLoading && userId ? <p className="text-sm text-muted-foreground">Carregando documentos…</p> : list.length === 0 && <p className="text-muted-foreground text-sm">{userId ? 'Nenhum documento nesta pasta.' : 'Entre na sua conta para ver e enviar documentos.'}</p>}{list.map((d) => { const status = expiryStatus(d.expires_on, today); return <article key={d.id} className={`hud-card flex flex-wrap items-center justify-between gap-3 ${status === 'expired' ? 'border-destructive' : status === 'soon' ? 'border-warning' : ''}`}><div className="min-w-0 flex-1"><div className="font-medium break-words">{d.name}</div><div className={`text-xs font-mono ${status === 'expired' ? 'text-destructive' : status === 'soon' ? 'text-warning' : 'text-muted-foreground'}`}>{d.expires_on ? `${status === 'expired' ? 'VENCIDO' : status === 'soon' ? 'Vence em até 30 dias' : 'Válido até'} ${new Date(d.expires_on + 'T12:00').toLocaleDateString('pt-BR')}` : 'Sem validade informada'}</div><input aria-label={`Validade de ${d.name}`} type="date" value={d.expires_on ?? ''} disabled={busy} className="mt-2 rounded-md border border-input bg-background px-2 py-1 text-xs" onChange={async (e) => { const value = e.target.value; if (!value) return; try { await saveExpiry(d.id, value); } catch { setMsg('Não foi possível salvar a validade.'); } }} /></div><div className="flex gap-2 shrink-0"><Button variant="secondary" disabled={busy} onClick={() => void open(d)}>Baixar</Button><Button variant="ghost" disabled={busy} onClick={() => void remove(d)} className="text-destructive">Excluir</Button></div></article>; })}</div>
  </main></div>;
}
