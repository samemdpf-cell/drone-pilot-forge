import { describe, it, expect } from "vitest";
import { compareDocuments, type ReviewedDocument } from "./document-review";
const doc = (id: string, pilotName: string, type = "CHT", value = "123"): ReviewedDocument => ({ id, name: id, extraction: { pilotName, registrations: [{ type, value, subject: "piloto" }], note: null } });
describe("Manual document review", () => {
  it('compares entered expiry with extracted expiry', () => { const d = doc('a', 'Ana'); d.expires = '2026-11-12'; d.extraction.expiryDate = '2026-11-13'; expect(compareDocuments([d], '2026-10-13').map((a) => a.id)).toContain('expiry-mismatch-a'); });
  it('flags extracted expiry within 30 days', () => { const d = doc('a', 'Ana'); d.extraction.expiryDate = '2026-11-12'; expect(compareDocuments([d], '2026-10-13').map((a) => a.id)).toContain('expiry-a'); });
  it("flags differing pilot names across both folders", () => { expect(compareDocuments([doc("licença", "Ana Silva"), doc("registro drone", "Bruno Souza")]).map((a) => a.id)).toContain("pilot-name"); });
  it("flags differing numbers of the same registration type", () => { expect(compareDocuments([doc("a", "Ana", "CHT", "123"), doc("b", "Ana", "CHT", "456")]).map((a) => a.id)).toContain("registration-piloto:CHT"); });
  it("does not compare different registration types", () => { expect(compareDocuments([doc("a", "Ana", "CHT", "123"), doc("b", "Ana", "ANATEL", "456")])).toEqual([]); });
  it("ignores case, accents and registration formatting", () => { expect(compareDocuments([doc("a", "José Silva", "CHT", "AB-123"), doc("b", "JOSE SILVA", "CHT", "ab 123")])).toEqual([]); });
});