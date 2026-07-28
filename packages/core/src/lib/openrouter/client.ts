import OpenAI from 'openai';

// Create a single AICredits (aicredits.in) client instance to be shared across the application.
// This client points to AICredits' OpenAI-compatible API gateway with INR billing.

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
    console.warn("⚠️ OPENROUTER_API_KEY is missing from environment variables. Using OPENAI_API_KEY as fallback if available.");
}

export const openrouter = new OpenAI({
    baseURL: apiKey ? 'https://openrouter.ai/api/v1' : undefined,
    apiKey: apiKey || process.env.OPENAI_API_KEY || '',
    defaultHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        "X-Title": "DigiClassroom Pro",
    }
});
