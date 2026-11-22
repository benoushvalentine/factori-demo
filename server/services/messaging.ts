import type { CustomerData } from "../types.js";
import { recommend } from "./recommendations.js";
import { retailerTone } from "./language.js";

export function generateMessage(
  customer: CustomerData,
  recommendations: ReturnType<typeof recommend>,
  tone: ReturnType<typeof retailerTone>,
  followup = false,
) {
  const name = customer.nickname || customer.name.split(" ")[0];
  const products = recommendations
    .map(
      ({ product }) =>
        `${product.name} (₹${product.price.toLocaleString("en-IN")}) — ${product.url}`,
    )
    .join("\n");
  const friendly = customer.style === "Friendly" && tone.style === "Friendly";
  const greeting = friendly ? tone.greeting : "Hello";
  if (!recommendations.length) {
    if (customer.language === "Tamil")
      return `${greeting} ${name}, unga preferences-ku match aagura in-stock product ippo illa. Endha colour illa style venum nu sollunga?`;
    if (customer.language === "Kannada")
      return `${greeting} ${name}, nimma preferences-ge match aaguva in-stock product iga illa. Yaava colour athava style beku?`;
    return `${greeting} ${name}, I couldn't find an available product matching your preferences. Is there another colour or style you'd like?`;
  }
  if (customer.language === "Tamil")
    return `${greeting} ${name}! ${followup ? "Neenga sonnadha base panni" : "Unga preferences-ku match aagura"} indha options select pannirukken:\n\n${products}\n\n${friendly ? "Pudichirukka? Endha colour venum nu sollunga!" : "Ungalukku edhu pidikkum nu sollunga."}`;
  if (customer.language === "Kannada")
    return `${greeting} ${name}! ${followup ? "Neevu helida preferences prakara" : "Nimma preferences-ge match aaguva"} ee options select maadiddene:\n\n${products}\n\n${friendly ? "Hegide? Yaava colour beku heli!" : "Yaavudu ishta antha heli."}`;
  return `${greeting} ${name}! ${followup ? "Based on what you shared, here are" : "Here are"} a couple of options matching your preferences:\n\n${products}\n\n${friendly ? "What do you think? Happy to help with colours or sizes!" : "Let me know which option you prefer."}`;
}

export function generateFollowup(
  customer: CustomerData,
  recommendations: ReturnType<typeof recommend>,
  tone: ReturnType<typeof retailerTone>,
  context: { text: string; intent: string; budget?: number; category?: string },
) {
  const tamil = customer.language === "Tamil";
  const kannada = customer.language === "Kannada";
  const casual = customer.style === "Friendly" && tone.style === "Friendly";
  if (!recommendations.length) {
    return tamil
      ? "Neenga ketta maadhiri option ippo kidaikkala. Vera style paarkalama?"
      : kannada
        ? "Neevu kelida thara option iga sigalilla. Bere style nodona?"
        : "I couldn’t find an available option that fits. Would you like to try another style?";
  }
  const size = String(
    (customer.profile as import("../types.js").Profile).preferred_size?.value ||
      "",
  );
  if (size && /\bsize\b/i.test(context.text)) {
    const p = recommendations[0].product;
    const price = `₹${p.price.toLocaleString("en-IN")}`;
    return tamil
      ? `Sari, ${size} size irukku. ${p.name} ${price}. Idha order note pannalama?`
      : kannada
        ? `Sari, ${size} size ide. ${p.name} ${price}. Order note maadona?`
        : `Size ${size} is available for the ${p.name} at ${price}. Shall I note your order?`;
  }
  const pastelRequested = /\bpastel\b/i.test(context.text);
  const selected =
    (pastelRequested &&
      recommendations.find((r) =>
        (r.product.colors as string[]).some((c) => /pastel/i.test(c)),
      )) ||
    recommendations[0];
  const p = selected.product;
  const price = `₹${p.price.toLocaleString("en-IN")}`;
  const pastelMatch =
    pastelRequested && (p.colors as string[]).some((c) => /pastel/i.test(c));
  let opening: string;
  if (context.intent === "Price objection" && context.budget !== undefined) {
    const budget = `₹${context.budget.toLocaleString("en-IN")}`;
    opening = tamil
      ? `Sari, ${budget} kulla paarkalam. Idhu ${price}.`
      : kannada
        ? `Sari, ${budget} olage nodona. Idu ${price} ide.`
        : `Got it, let’s keep it within ${budget}. This one is ${price}.`;
  } else if (pastelMatch) {
    opening = tamil
      ? `Irukku! Indha pastel shade paarunga — ${price}.`
      : kannada
        ? `Ide! Ee pastel shade nodi — ${price}.`
        : `Yes! Here’s a pastel option — ${price}.`;
  } else if (context.category && p.category === context.category) {
    opening = tamil
      ? `Sari, ${p.category.toLowerCase()} paarkalam. Idhu ${price}.`
      : kannada
        ? `Sari, ${p.category.toLowerCase()} nodona. Idu ${price} ide.`
        : `Got it, ${p.category.toLowerCase()}. This one is ${price}.`;
  } else {
    opening = tamil
      ? `Sari! Indha option paarunga — ${price}.`
      : kannada
        ? `Sari! Ee option nodi — ${price}.`
        : `Sure! How about this one? It’s ${price}.`;
  }
  const question = pastelMatch
    ? tamil
      ? casual
        ? "Indha colour okay-va?"
        : "Indha colour ungalukku okay-va?"
      : kannada
        ? "Ee colour ishta aayta?"
        : "Does this colour work for you?"
    : tamil
      ? "Endha size venum?"
      : kannada
        ? "Yaava size beku?"
        : "Which size do you need?";
  return `${opening}\n\n${p.name}\n${p.url}\n\n${question}`;
}
