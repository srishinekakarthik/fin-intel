import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from './fin-intel-backend/src/config/env';

const genAI = new GoogleGenerativeAI(env.GOOGLE_GEMINI_API_KEY);

async function test() {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    tools: [{ googleSearch: {} } as any],
  });
  const prompt = "Search Google for the most recent financial or business news about 'OpenAI' from the last 24 hours. Return the top 3 news headlines, short summaries, and their source URLs in valid JSON format. Format: [{headline: string, summary: string, url: string, source: string}]. Return ONLY JSON, no markdown blocks.";
  const res = await model.generateContent(prompt);
  console.log(res.response.text());
}
test().catch(console.error);
