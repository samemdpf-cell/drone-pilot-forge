import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ScanSearch, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { analyzeDocument } from "@/lib/document-analysis.functions";
import { compareDocuments, type ReviewedDocument } from "@/lib/document-review";

type InputDoc = { id: string; name: string; type: string; expires?: string | null };
export function DocumentReview({ docs, loadData, onExpiry }: { docs: InputDoc[]; loadData: (id: string) => Promise<string>; onExpiry: (id: string, expiry: string) => Promise<void> }) {
  const analyze = useServerFn(analyzeDocument);
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState<ReviewedDocument[]>([]); const [confirmed, setConfirmed] = useState<string[]>([]);
  const fingerprint = docs.map((d) => d.id).join("|");
  useEffect(() => { setReviewed([]); setConfirmed([]); setMessage(""); }, [fingerprint]);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(!!session));
    return () => data.subscription.unsubscribe();
  }, []);
  const login = async (signup: boolean) => {
    setBusy(true); setMessage("");
    try {
      const result = signup ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
      setMessage(result.error ? result.error.message : signup && !result.data.session ? "Confira seu e-mail para confirmar a conta antes de entrar." : "");
    } finally { setBusy(false); }
  };
  const run = async () => {
    setBusy(true); setReviewed([]); setConfirmed([]); setMessage("");
    const rows: ReviewedDocument[] = [];
    try {
      for (const [i, doc] of docs.entries()) {
        setMessage(`Lendo ${i + 1}/${docs.length}: ${doc.name}`);
        const result = await analyze({ data: { id: doc.id, name: doc.name, type: doc.type, data: await loadData(doc.id) } });
        if (!result.ok) { setMessage(`${doc.name}: ${result.error} Nenhuma comparação concluída.`); return; }
        rows.push({ id: doc.id, name: doc.name, expires: doc.expires, extraction: result.extraction });
      }
      setReviewed(rows); setMessage(`${rows.length} documentos comparados nas pastas Piloto e Drone.`);
    } catch { setMessage("A comparação foi interrompida. Seus documentos não foram alterados."); }
    finally { setBusy(false); }
  };
  const alerts = compareDocuments(reviewed);
  return <section className="border-y border-border py-4 space-y-3" aria-label="Conferência de documentos">
    <h1 className="font-bold text-xl flex gap-2 items-center"><ScanSearch className="size-5 text-primary" />Conferência de documentos</h1>
    {!signedIn ? <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Entre para acessar seus documentos e comparar com IA.</p>
      <form onSubmit={(e) => { e.preventDefault(); void login(false); }} className="grid gap-2 sm:grid-cols-2">
        <input aria-label="E-mail" type="email" required autoComplete="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className="min-w-0 rounded-md border border-input bg-background p-2" />
        <input aria-label="Senha" type="password" minLength={8} required autoComplete="current-password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} className="min-w-0 rounded-md border border-input bg-background p-2" />
        <Button disabled={busy} type="submit">Entrar</Button><Button disabled={busy || !email || password.length < 8} variant="outline" type="button" onClick={() => void login(true)}>Criar conta</Button>
      </form>
      <Button variant="outline" disabled={busy} onClick={async () => { const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/documentos` }); if (result.error) setMessage(result.error.message); }}>Continuar com Google</Button>
    </div> : <Button disabled={busy || docs.length < 2} onClick={() => void run()}><ScanSearch />{busy ? "Comparando…" : "Comparar todos os documentos"}</Button>}
    <p className="text-xs text-muted-foreground">A leitura por IA pode conter erros. Divergências precisam de confirmação manual; os arquivos não são alterados.</p>
    {message && <p role="status" className="text-sm break-words">{message}</p>}
    {reviewed.length > 0 && alerts.length === 0 && <p className="text-success text-sm">Nenhuma divergência nos campos identificados. Confira também os campos ausentes.</p>}
    {alerts.map((a) => <article key={a.id} className={`border rounded-md p-3 space-y-2 ${confirmed.includes(a.id) ? "border-success" : "border-warning"}`}>
      <div className="flex gap-2 text-sm font-medium">{confirmed.includes(a.id) ? <Check className="size-4 shrink-0 text-success" /> : <AlertTriangle className="size-4 shrink-0 text-warning" />}{a.text}</div>
      <ul className="text-xs text-muted-foreground space-y-1 break-words">{a.documents.map((v, i) => <li key={i}>{v}</li>)}</ul>
      <Button size="sm" variant="outline" disabled={confirmed.includes(a.id)} onClick={() => setConfirmed((old) => [...old, a.id])}>{confirmed.includes(a.id) ? "Conferido manualmente" : "Confirmar conferência manual"}</Button>
    </article>)}
    {reviewed.map((d) => <div key={d.id} className="border-t border-border pt-2 text-xs break-words"><strong>{d.name}</strong><div>Piloto: {d.extraction.pilotName ?? "Não identificado"}</div><div>Registros: {d.extraction.registrations.map((r) => `${r.type}: ${r.value}`).join(" · ") || "Não identificados"}</div><div>Validade lida: {d.extraction.expiryDate ?? 'Não identificada'} · Informada: {d.expires ?? 'Não informada'}</div>{d.extraction.expiryDate && <Button variant="outline" size="sm" className="mt-2" onClick={async () => { if (!d.extraction.expiryDate) return; try { await onExpiry(d.id, d.extraction.expiryDate); setMessage('Validade confirmada e salva na sua conta.'); } catch { setMessage('Não foi possível salvar a validade.'); } }}>Confirmar e salvar validade lida</Button>}{d.extraction.note && <div className="text-muted-foreground">{d.extraction.note}</div>}</div>)}
  </section>;
}