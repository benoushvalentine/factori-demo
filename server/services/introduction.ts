import type { CustomerData } from "../types.js";
export function introduction(customer: CustomerData, storeName: string) {
  const name = customer.nickname || customer.name.split(" ")[0];
  if (customer.language === "Tamil")
    return `Hi ${name}, naan ${storeName}-la irundhu pesuren. Enga clothing collection-la irundhu rendu options anuppattuma? Neenga enna maadhiri style paakureenga?`;
  if (customer.language === "Kannada")
    return `Hi ${name}, ${storeName} inda message maadta iddini. Namma clothing collection inda onderadu options kalisabahuda? Yaava style ishta?`;
  return `Hi ${name}, this is ${storeName}. Would you like me to share a couple of options from our clothing collection? What kind of styles do you usually like?`;
}
export function hasDemoOptIn(text: string) {
  return (
    /\b(yes|sure|okay|ok|haudu|sari|seri|kandippa|anuppunga|kalisi)\b/i.test(
      text,
    ) &&
    !/\b(no thanks|not interested|don't send|do not send|stop|unsubscribe|beda|venda|vendam)\b/i.test(
      text,
    )
  );
}
