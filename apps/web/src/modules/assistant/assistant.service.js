import { apiClient, responseData } from "../../lib/api-client.js";
import { fetchJson } from "../../lib/resource.js";

/** `{ ai: boolean }`: whether answers come from a language model or a keyword search. */
export const getAssistantStatus = async () => (await fetchJson("/assistant/status")).data;

/** `{ answer, mode, results, recommendedIds }` for a natural-language question. */
export const askAssistant = async (question) => (await responseData(apiClient.post("/assistant/ask", { question }))).data;
