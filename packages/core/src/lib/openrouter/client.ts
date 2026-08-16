import OpenAI from 'openai';

/**
 * Shared chat-completion client used by every tutor agent (topic explanation,
 * exam prep, doubt clearing, study tips, self-study buddy, conversational) plus
 * the RAG query-decomposer, note/writing assistants and the ragas evaluator.
 *
 * Chat completions route through OpenRouter ONLY when a genuine OpenRouter key
 * (`sk-or-…`) is configured. Previously ANY non-empty OPENROUTER_API_KEY forced
 * every request to openrouter.ai; a placeholder / wrong-format key there made
 * OpenRouter answer `401 "Missing Authentication header"`, which silently broke
 * all six agents — the menu router swallowed the error and fell back to a formal
 * RAG reply, so the tutor looked like it was "not answering properly".
 *
 * When no valid OpenRouter key is present we talk to OpenAI directly with
 * OPENAI_API_KEY — the same key embeddings already use — so the agents work out
 * of the box. Add a real `sk-or-…` key later and chat upgrades to OpenRouter
 * automatically, no code change. `usingOpenRouter` is exported so the model
 * router can pick model names that actually exist on the active endpoint.
 */
const openrouterKey = process.env.OPENROUTER_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

// OpenRouter keys look like `sk-or-…`. Treat anything else as "not configured"
// rather than shipping an OpenAI/placeholder key to openrouter.ai and 401-ing.
export const usingOpenRouter = !!openrouterKey && openrouterKey.startsWith('sk-or-');

if (openrouterKey && !usingOpenRouter) {
    console.warn(
        "⚠️ OPENROUTER_API_KEY is set but is not an OpenRouter key (expected 'sk-or-…'). " +
        "Routing chat completions to OpenAI directly with OPENAI_API_KEY."
    );
} else if (!openrouterKey) {
    console.warn("⚠️ OPENROUTER_API_KEY not set — routing chat completions to OpenAI directly.");
}

export const openrouter = new OpenAI({
    // baseURL undefined = OpenAI's default (https://api.openai.com/v1).
    baseURL: usingOpenRouter ? 'https://openrouter.ai/api/v1' : undefined,
    apiKey: (usingOpenRouter ? openrouterKey : openaiKey) || '',
    defaultHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        "X-Title": "DigiClassroom Pro",
    }
});
