import { z } from "zod";

export const extractionSchema = z.object({ pilotName: z.string().nullable(), registrations: z.array(z.object({ type: z.string(), value: z.string(), subject: z.enum(["piloto", "drone", "desconhecido"]) })), note: z.string().nullable() });
export type Extraction = z.infer<typeof extractionSchema>;
export type ReviewedDocument = { id: string; name: string; extraction: Extraction };
export type ReviewAlert = { id: string; text: string; documents: string[] };
const normalize = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export function compareDocuments(docs: ReviewedDocument[]): ReviewAlert[] {
  const alerts: ReviewAlert[] = [];
  const named = docs.filter((d) => d.extraction.pilotName);
  if (new Set(named.map((d) => normalize(d.extraction.pilotName ?? ""))).size > 1) alerts.push({ id: "pilot-name", text: "Nomes do piloto diferentes encontrados.", documents: named.map((d) => `${d.name}: ${d.extraction.pilotName}`) });
  const groups = new Map<string, { value: string; label: string }[]>();
  for (const d of docs) {
    if (!d.extraction.pilotName && !d.extraction.registrations.length) alerts.push({ id: `unreadable-${d.id}`, text: "Nome e registro não identificados; confira o documento manualmente.", documents: [d.name] });
    for (const r of d.extraction.registrations) {
      const key = `${r.subject}:${normalize(r.type)}`;
      groups.set(key, [...(groups.get(key) ?? []), { value: normalize(r.value), label: `${d.name}: ${r.type} ${r.value} (${r.subject})` }]);
    }
  }
  for (const [key, rows] of groups) if (new Set(rows.map((r) => r.value)).size > 1) alerts.push({ id: `registration-${key}`, text: "Números diferentes para o mesmo tipo de registro. Podem pertencer a drones ou pilotos distintos.", documents: rows.map((r) => r.label) });
  return alerts;
}