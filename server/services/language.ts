import type { Language } from "../types.js";

export function detectLanguage(
  text: string,
  fallback = "English",
): { language: Language; confidence: number } {
  if (
    /\b(olage|chennag|hegidd|beku|beda|nanage|nimma|ninna|swalpa|aadre|ideya|irutte|sikkive)\w*/i.test(
      text,
    ) ||
    /[\u0C80-\u0CFF]/.test(text)
  )
    return { language: "Kannada", confidence: 0.94 };
  if (
    /\b(irukk|irukku|eppadi|venum|enna|indha|idhu|konjam|pudikk|maari|unakku|paaru|illa|venda)\w*/i.test(
      text,
    ) ||
    /[\u0B80-\u0BFF]/.test(text)
  )
    return { language: "Tamil", confidence: 0.94 };
  if (
    /\b(please|looking|would|like|want|budget|thank|hello|need|expensive)\b/i.test(
      text,
    )
  )
    return { language: "English", confidence: 0.88 };
  return { language: fallback as Language, confidence: 0.35 };
}
export function detectStyle(text: string) {
  if (/\b(please|kindly|nimma|neevu|nodi|thank you|sir|madam)\b/i.test(text))
    return "Respectful";
  if (/!|\b(hey|super|cool|awesome|chennagide|eppadi|hegiddiya)\b/i.test(text))
    return "Friendly";
  return "Concise";
}
export function retailerTone(messages: { text: string }[]) {
  const text = messages.map((m) => m.text).join(" ");
  return {
    style: detectStyle(text),
    greeting: /\bHey\b/.test(text) ? "Hey" : "Hello",
    confidence: messages.length ? 0.86 : 0.3,
    source: `Rule-based analysis of ${messages.length} historical outgoing messages`,
  };
}
