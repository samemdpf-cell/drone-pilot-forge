import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const analyzeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ name: z.string().max(300), type: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]), data: z.string().max(7_000_000).regex(/^data:(application\/pdf|image\/(jpeg|png|webp));base64,[A-Za-z0-9+/=]+$/) }).refine((d) => d.data.startsWith(`data:${d.type};base64,`), "Formato do arquivo inconsistente").parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false as const, error: "A análise de documentos não está configurada." };
    try {
      const { extractDocument } = await import("./document-analysis.server");
      return { ok: true as const, extraction: await extractDocument(data, key) };
    } catch (e) {
      const status = e && typeof e === "object" && "statusCode" in e ? Number(e.statusCode) : 0;
      return { ok: false as const, error: status === 402 ? "Créditos de IA insuficientes. Consulte Configurações → Planos e créditos." : status === 403 ? "Acesso à IA bloqueado. Um administrador precisa verificar as permissões de IA." : status === 429 ? "Muitas análises em andamento. Tente novamente mais tarde." : "Não foi possível ler o documento. Confira o arquivo e tente novamente.", status };
    }
  });