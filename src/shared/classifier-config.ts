// The classifier endpoint: TypeSafe's Jev by default, Jev on OpenRouter, or any
// URL that speaks the same typed-question API.

export const JEV_URL = "https://api.typesafe.ai/v1/systemone";
export const JEV_MODEL = "jev-latest";

/** Jev through OpenRouter's decisions API (an OpenRouter key). */
export const OPENROUTER_JEV = { jevModel: "typesafe/jev-1.13", jevUrl: "https://openrouter.ai/api/alpha/decisions" } as const;

/** What's wrong with an endpoint, before anything is sent ("" for nothing). */
export function classifierIssue(model: string, url: string): string | null {
  let path = "";
  try { path = new URL(url).pathname.replace(/\/+$/, ""); } catch { return "The classifier endpoint isn't a valid URL."; }
  if (/\/chat\/completions$/.test(path)) return `This URL is a chat endpoint. Jev needs the typed-question API: ${JEV_URL}, or ${OPENROUTER_JEV.jevUrl} with model ${OPENROUTER_JEV.jevModel} for Jev on OpenRouter.`;
  if (!model.trim()) return "Name the classifier model (jev-latest for TypeSafe).";
  return null;
}
