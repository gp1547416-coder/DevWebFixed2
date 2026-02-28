import { GoogleGenAI } from '@google/genai';

export interface SearchSource {
  title: string;
  uri: string;
}

export interface SearchResult {
  text: string;
  sources: SearchSource[];
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function performSearch(query: string): Promise<SearchResult> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: query,
    config: {
      tools: [{ googleSearch: {} }],
      systemInstruction:
        'You are DevWeb, a professional search assistant. Provide concise and well-structured markdown answers and cite your sources.',
    },
  });

  const text = response.text ?? 'No results found.';
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];

  const uniqueSources = Array.from(
    new Map(
      chunks
        .map((chunk) => chunk.web)
        .filter((web): web is NonNullable<typeof web> => Boolean(web?.uri))
        .map((web) => [web.uri, { title: web.title || 'Source', uri: web.uri }]),
    ).values(),
  );

  return { text, sources: uniqueSources };
}
