import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/auth';
import { isPlatformStaff, type Role } from '@/auth/permissions';

export async function GET() {
    try {
        const session = await auth.api.getSession({ headers: await headers() });

        if (!isPlatformStaff((session?.user?.role ?? '') as Role)) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        // Inline provider detection — avoids importing LangChainModelFactory
        // which triggers webpack to bundle uninstalled @langchain/* packages
        const activeProvider = (process.env.LLM_PROVIDER ?? 'openai').toLowerCase();

        // Check if the relevant API key is present
        const keyMap: Record<string, string | undefined> = {
            openai: process.env.OPENAI_API_KEY,
            anthropic: process.env.ANTHROPIC_API_KEY,
            claude: process.env.ANTHROPIC_API_KEY,
            gemini: process.env.GOOGLE_AI_API_KEY,
            google: process.env.GOOGLE_AI_API_KEY,
            groq: process.env.GROQ_API_KEY,
        };
        const tokenConfigured = !!keyMap[activeProvider];

        // Determine active model name
        const modelMap: Record<string, string> = {
            openai: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
            anthropic: process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet',
            claude: process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet',
            gemini: process.env.GEMINI_MODEL ?? 'gemini-1.5-pro',
            google: process.env.GEMINI_MODEL ?? 'gemini-1.5-pro',
            groq: process.env.GROQ_MODEL ?? 'llama-3.3-70b',
        };
        const activeModel = modelMap[activeProvider] ?? 'gpt-4o-mini';

        if (tokenConfigured) {
            return NextResponse.json({
                online: true,
                url: `${activeProvider} — ${activeModel} (Internal LLM)`,
                tokenConfigured: true,
            });
        }

        return NextResponse.json({
            online: false,
            url: `${activeProvider} (Internal LLM)`,
            tokenConfigured: false,
            message: `Missing API Key for provider: ${activeProvider}`,
        });

    } catch (error: any) {
        return NextResponse.json({ online: false, error: error.message }, { status: 500 });
    }
}
