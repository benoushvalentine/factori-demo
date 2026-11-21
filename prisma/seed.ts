import { demoContacts, demoHistory } from "../server/demo-data.js";
import { pathToFileURL } from "node:url";
import { db, RETAILER_ID } from "../server/db.js";
import { fact } from "../server/intelligence.js";

export async function seed() {
  await db.$transaction(async (tx) => {
    await tx.whatsAppConnection.deleteMany();
    await tx.preferenceChange.deleteMany();
    await tx.message.deleteMany();
    await tx.draft.deleteMany();
    await tx.campaign.deleteMany();
    await tx.customer.deleteMany();
    await tx.product.deleteMany();
    await tx.retailer.deleteMany();
    await tx.retailer.create({
      data: { id: RETAILER_ID, name: "The Style Studio" },
    });
    const products = [
      [
        "dress-sage",
        "Sage Everyday Dress",
        "Dresses",
        1490,
        ["Pastel green", "Sage"],
        "Minimal",
        12,
        "dress",
      ],
      [
        "dress-rose",
        "Rose Linen Dress",
        "Dresses",
        1890,
        ["Pastel pink", "Rose"],
        "Elegant",
        7,
        "dress",
      ],
      [
        "dress-black",
        "Midnight Wrap Dress",
        "Dresses",
        1790,
        ["Black"],
        "Elegant",
        8,
        "dress",
      ],
      [
        "dress-lavender",
        "Lavender Cotton Dress",
        "Dresses",
        1290,
        ["Pastel lavender"],
        "Minimal",
        15,
        "dress",
      ],
      [
        "tee-blue",
        "Blue Everyday Tee",
        "Casual wear",
        590,
        ["Blue"],
        "Casual",
        24,
        "tee",
      ],
      [
        "tee-black",
        "Essential Black Tee",
        "Casual wear",
        490,
        ["Black"],
        "Minimal",
        30,
        "tee",
      ],
      [
        "shirt-oxford",
        "Blue Oxford Shirt",
        "Casual wear",
        990,
        ["Blue"],
        "Casual",
        10,
        "shirt",
      ],
      [
        "shirt-linen",
        "Relaxed Linen Shirt",
        "Casual wear",
        1190,
        ["White", "Green"],
        "Relaxed",
        6,
        "shirt",
      ],
      [
        "formal-blue",
        "Classic Blue Formal Shirt",
        "Formal wear",
        690,
        ["Blue"],
        "Minimal",
        11,
        "shirt",
      ],
      [
        "formal-white",
        "Crisp White Formal Shirt",
        "Formal wear",
        650,
        ["White"],
        "Elegant",
        9,
        "shirt",
      ],
      [
        "formal-black",
        "Tailored Black Trousers",
        "Formal wear",
        1590,
        ["Black"],
        "Elegant",
        5,
        "trousers",
      ],
      [
        "tee-pastel",
        "Pastel Weekend Tee",
        "Casual wear",
        650,
        ["Pastel pink"],
        "Relaxed",
        17,
        "tee",
      ],
      [
        "dress-premium",
        "Silk Occasion Dress",
        "Dresses",
        3490,
        ["Black"],
        "Elegant",
        3,
        "dress",
      ],
      [
        "shirt-soldout",
        "Navy Pocket Shirt",
        "Casual wear",
        550,
        ["Blue"],
        "Casual",
        0,
        "shirt",
      ],
      [
        "trousers-stone",
        "Stone Chino Trousers",
        "Casual wear",
        1290,
        ["White"],
        "Minimal",
        8,
        "trousers",
      ],
      [
        "dress-blue",
        "Blue Cotton Midi",
        "Dresses",
        1690,
        ["Blue"],
        "Casual",
        14,
        "dress",
      ],
    ] as const;
    for (const [
      id,
      name,
      category,
      price,
      colors,
      style,
      stock,
      shape,
    ] of products) {
      await tx.product.create({
        data: {
          id,
          retailerId: RETAILER_ID,
          name,
          category,
          price,
          colors: [...colors],
          sizes: ["S", "M", "L", "XL"],
          style,
          stock,
          image: `/assets/${shape}.svg`,
          url: `https://catalogue.example/products/${id}`,
          description: `${name} from our demo collection. Available in ${colors.join(" and ")}; ${style.toLowerCase()} fit and styling. Product link is illustrative.`,
        },
      });
    }
    const customers = demoContacts;
    for (const [
      i,
      [
        id,
        name,
        nickname,
        language,
        interests,
        colors,
        budget,
        styles,
        consent,
        style,
      ],
    ] of customers.entries()) {
      const profile = {
        interests: fact([...interests], "Demo conversation"),
        preferred_colors: fact([...colors], "Demo conversation"),
        budget_max: fact(budget, "Demo conversation"),
        preferred_style: fact([...styles], "Demo conversation"),
        disliked_items: fact([], "Demo conversation"),
      };
      await tx.customer.create({
        data: {
          id,
          retailerId: RETAILER_ID,
          name,
          nickname,
          language,
          phone: `+91 90000 ${String(10000 + i)}`,
          style,
          consent,
          profile,
          purchases: [],
        },
      });
    }
    const history = demoHistory;
    for (const [
      i,
      [customerId, direction, text, language],
    ] of history.entries()) {
      await tx.message.create({
        data: {
          customerId,
          direction,
          text,
          language,
          origin: "seed",
          status: direction === "outgoing" ? "simulated" : "received",
          createdAt: new Date(Date.now() - (history.length - i) * 3600000),
        },
      });
    }
    await tx.customer.update({
      where: { id: "meera" },
      data: {
        purchases: [
          {
            productId: "dress-sage",
            name: "Sage Everyday Dress",
            price: 1490,
            date: new Date(Date.now() - 14 * 86400000).toISOString(),
            campaignId: null,
            simulated: true,
          },
        ],
      },
    });
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  seed()
    .then(() => console.log("Demo database seeded."))
    .finally(() => db.$disconnect());
}
