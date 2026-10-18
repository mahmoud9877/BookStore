// Build-time settings: Create React App inlines REACT_APP_* variables when building.
// The fallbacks are the values the GitHub Pages build has always shipped with.
export const API_BASE_URL = (
  process.env.REACT_APP_API_URL || "https://book-store-liart-zeta.vercel.app"
).replace(/\/+$/, "");

// Must match the API's BEARER_KEY. It is a header prefix, not a secret.
export const BEARER_KEY = process.env.REACT_APP_BEARER_KEY || "Hamada__";

// Prices are stored without a currency; checkout charges this currency (see the API's
// StripePaymentGateway), so the UI must display the same one.
export const CURRENCY = process.env.REACT_APP_CURRENCY || "EGP";
