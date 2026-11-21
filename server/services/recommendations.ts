import type { CustomerData, ProductData, Profile } from "../types.js";

export function recommend(customer: CustomerData, catalogue: ProductData[]) {
  const p = customer.profile as Profile;
  const vals = (key: string) =>
    Array.isArray(p[key]?.value)
      ? (p[key].value as string[]).map((v) => v.toLowerCase())
      : [];
  const budget =
    typeof p.budget_max?.value === "number" ? p.budget_max.value : Infinity;
  const interests = vals("interests"),
    colors = vals("preferred_colors"),
    styles = vals("preferred_style"),
    dislikes = vals("disliked_items");
  const candidates = catalogue
    .filter(
      (product) =>
        product.stock > 0 &&
        product.price <= budget &&
        !dislikes.some((d) =>
          `${product.name} ${product.category} ${product.style} ${(product.colors as string[]).join(" ")}`
            .toLowerCase()
            .includes(d),
        ),
    )
    .map((product) => {
      const categoryMatch = interests.some(
        (i) =>
          product.category.toLowerCase().includes(i) ||
          i.includes(product.category.toLowerCase()),
      );
      const colorMatch = colors.some((c) =>
        (product.colors as string[]).some((pc) => pc.toLowerCase().includes(c)),
      );
      const styleMatch = styles.some((s) =>
        product.style.toLowerCase().includes(s),
      );
      const score =
        (categoryMatch ? 10 : 0) + (colorMatch ? 6 : 0) + (styleMatch ? 3 : 0);
      const reasons = [
        categoryMatch && `Matches interest in ${product.category}`,
        colorMatch && `Matches preferred ${colors.join("/")} colours`,
        styleMatch && `Matches ${product.style.toLowerCase()} style`,
        Number.isFinite(budget) &&
          `Within ₹${budget.toLocaleString("en-IN")} budget`,
        "Available in demo catalogue",
      ].filter(Boolean) as string[];
      return { product, score, reasons };
    });
  // Avoid recommending an unrelated category when a customer has stated their interests.
  return candidates
    .filter((p) => !interests.length || p.score >= 10)
    .sort((a, b) => b.score - a.score || a.product.price - b.product.price)
    .slice(0, 2);
}
