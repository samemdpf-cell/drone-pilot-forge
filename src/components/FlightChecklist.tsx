import { useEffect, useState } from "react";
import { RotateCcw, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const items = ["Documentos do piloto e drone conferidos", "Espaço aéreo e autorização de voo conferidos", "Vento, rajadas, visibilidade e umidade conferidos", "Baterias do drone e controle carregadas", "Hélices, motores e estrutura inspecionados", "GPS e ponto de retorno confirmados no drone", "Área de decolagem livre e voo em linha de visada"];

export function FlightChecklist({ location }: { location: string | null }) {
  const [checked, setChecked] = useState<string[]>([]);
  useEffect(() => { setChecked([]); }, [location]);
  return <section className="space-y-3 border-y border-border py-4" aria-label="Checklist de voo">
    <div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-bold"><ClipboardCheck className="size-5 text-primary" />Checklist de voo</h2><Button variant="ghost" size="icon" aria-label="Reiniciar checklist" title="Reiniciar checklist" onClick={() => setChecked([])}><RotateCcw /></Button></div>
    <p className="text-sm text-muted-foreground">{checked.length}/{items.length} conferidos · {location ?? "Local ainda não definido"}</p>
    <div className="grid gap-3 sm:grid-cols-2">{items.map((item, i) => <label key={item} htmlFor={`flight-${i}`} className="flex items-start gap-3 text-sm"><Checkbox id={`flight-${i}`} checked={checked.includes(item)} onCheckedChange={(value) => setChecked((old) => value === true ? [...old, item] : old.filter((x) => x !== item))} className="mt-0.5" /><span>{item}</span></label>)}</div>
    {checked.length === items.length && <p className="text-sm text-success">Checklist conferido. A decisão de voo continua sendo do piloto.</p>}
  </section>;
}