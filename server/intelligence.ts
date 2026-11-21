// Provider boundary: swap this adapter for a real model without changing send controls.
import {
  detectLanguage,
  detectStyle,
  retailerTone,
} from "./services/language.js";
import { recommend } from "./services/recommendations.js";
import { generateMessage, generateFollowup } from "./services/messaging.js";
import { fact, interpret } from "./services/memory.js";
export {
  detectLanguage,
  detectStyle,
  retailerTone,
  recommend,
  generateMessage,
  generateFollowup,
  fact,
  interpret,
};
export { simulatedWhatsApp } from "./adapters/whatsapp.js";
export const simulatedAI = {
  detectLanguage,
  detectStyle,
  retailerTone,
  recommend,
  generateMessage,
  generateFollowup,
  interpret,
};
