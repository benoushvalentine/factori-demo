import type { Fact, Profile } from "../types.js";

export const fact = (
  value: Fact["value"],
  source: string,
  explicit = true,
  confidence = 1,
): Fact => ({ value, source, explicit, confidence });
export function interpret(text: string, previous: Profile) {
  const updates: Profile = {};
  const set = (
    key: string,
    value: Fact["value"],
    explicit = true,
    confidence = 0.96,
  ) => {
    if (!explicit && previous[key]?.explicit) return;
    updates[key] = fact(value, "Customer message", explicit, confidence);
  };
  const merge = (key: string, additions: string[]) => [
    ...new Set([
      ...(Array.isArray(previous[key]?.value)
        ? (previous[key].value as string[])
        : []),
      ...additions,
    ]),
  ];
  let intent = "Unclear";
  const optout =
    /\b(stop|unsubscribe|opt out|do not message|don't message|no more messages)\b/i.test(
      text,
    );
  const deletion =
    /\b(forget me|delete my (data|information|profile|history))\b/i.test(text);
  const budgetMatch =
    text.match(
      /(?:₹|rs\.?\s*|under\s*|below\s*|within\s*|budget(?:\s*(?:is|of))?\s*|maximum\s*|max\s*)(\d[\d,]*)/i,
    ) ||
    text.match(
      /(\d[\d,]*)\s*(?:(?:rupayi|rooba)\s*)?(?:olage|kulla|rupees|rs\b)/i,
    );
  if (budgetMatch) {
    const budget = Number(budgetMatch[1].replaceAll(",", ""));
    if (budget > 0 && budget <= 10000000) set("budget_max", budget);
  }
  const colors = ["Pastel", "Black", "Blue", "Pink", "White", "Green"].filter(
    (color) => new RegExp(`\\b${color}\\b`, "i").test(text),
  );
  for (const color of colors) {
    if (
      new RegExp(
        `(?:no|not|avoid|dislike|hate)\\s+(?:\\w+\\s+)?${color}|${color}\\s+(?:beda|venda)`,
        "i",
      ).test(text)
    ) {
      set("disliked_items", merge("disliked_items", [color]));
    } else set("preferred_colors", merge("preferred_colors", [color]));
  }
  if (/\bformal\s*(?:wear|shirts?|clothes)?/i.test(text))
    set("interests", ["Formal wear"]);
  else if (/\bcasual\s*(?:wear|shirts?|clothes)?/i.test(text))
    set("interests", ["Casual wear"]);
  else if (/\bdresses?\b/i.test(text)) set("interests", ["Dresses"]);
  if (/\b(minimal|elegant|relaxed)\b/i.test(text))
    set(
      "preferred_style",
      merge("preferred_style", [
        text.match(/\b(minimal|elegant|relaxed)\b/i)![1].toLowerCase(),
      ]),
    );
  if (
    /\b(super|love|like it|chennagide|interested|pudichirukku)\b/i.test(text)
  ) {
    intent = "Interested";
    set("purchase_intent", "High", false, 0.8);
  }
  if (/\b(expensive|costly|too much|budget)\b/i.test(text) || budgetMatch)
    intent = "Price objection";
  if (/\b(beda|venda|not interested|do not like|don.t like)\b/i.test(text))
    intent = "Preference change";
  if (Object.keys(updates).length && intent === "Unclear")
    intent = "Preference shared";
  if (optout) intent = "Opt-out";
  if (deletion) intent = "Delete data";
  return {
    updates: optout || deletion ? {} : updates,
    intent,
    optout,
    deletion,
  };
}
