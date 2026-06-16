import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // AI — Gemini only
  GOOGLE_GEMINI_API_KEY: z.string().min(1, 'Missing Google Gemini API key'),
  MISTRAL_API_KEY: z.string().optional(),
  YAHOO_FINANCE_BASE_URL: z.string().url().default('https://query1.finance.yahoo.com'),

  // Market data
  FINNHUB_API_KEY: z.string().optional(),

  // n8n Cloud — webhook base + individual workflow paths
  N8N_WEBHOOK_BASE_URL: z.string().url().optional(),
  N8N_API_KEY: z.string().optional(),

  // n8n workflow webhook paths (the UUID path segment from each workflow's webhook node)
  N8N_INGESTION_WEBHOOK_PATH: z.string().optional(), // document ingestion pipeline
  N8N_CALLBACK_SECRET: z.string().optional(),        // shared secret for n8n → backend callbacks

  // CORS
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
export type Env = typeof env;
