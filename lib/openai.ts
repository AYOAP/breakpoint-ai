import OpenAI from "openai";

const DEFAULT_MODEL = "gpt-5-mini";

let client: OpenAI | null = null;

export function getOpenAIModel() {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
}

export function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY. Add it to your environment before running the app.");
  }

  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return client;
}
