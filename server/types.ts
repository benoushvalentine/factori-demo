export type Language = "Tamil" | "Kannada" | "English";
export type Fact = {
  value: string[] | number | string | null;
  source: string;
  confidence: number;
  explicit: boolean;
};
export type Profile = Record<string, Fact>;
export type ProductData = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  colors: unknown;
  sizes: unknown;
  stock: number;
  style: string;
  url: string;
  image: string;
};
export type CustomerData = {
  id: string;
  name: string;
  nickname: string;
  language: string;
  style: string;
  profile: unknown;
};
