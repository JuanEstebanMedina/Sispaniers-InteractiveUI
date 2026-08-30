const DEFAULT_OPENAI_MODEL = "gpt-5.6-terra";
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";

export const aiModelsConfig = {
  openai: process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
  gemini: process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL,
};
