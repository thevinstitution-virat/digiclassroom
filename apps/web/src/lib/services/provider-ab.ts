import crypto from 'crypto';

export type ProviderVariant = 'openai' | 'anthropic' | 'gemini';

interface ProviderConfig {
    variant: ProviderVariant;
    weight: number; // 0-100 percentage
}

export class ProviderABTest {
    // Current weights configured for production
    // Eventually this could be loaded dynamically from DB or Env
    private static variants: ProviderConfig[] = [
        { variant: 'openai', weight: Number(process.env.AB_WEIGHT_OPENAI) || 60 },
        { variant: 'anthropic', weight: Number(process.env.AB_WEIGHT_ANTHROPIC) || 30 },
        { variant: 'gemini', weight: Number(process.env.AB_WEIGHT_GEMINI) || 10 }
    ];

    /**
     * Get the assigned provider for a specific user ID deterministically.
     * 
     * Uses MD5 hashing of the userId to ensure a student always gets the same
     * provider during an A/B test (to prevent jarring UX changes mid-session),
     * while distributing evenly across the userbase according to the weights.
     */
    static getVariantForUser(userId: string): ProviderVariant {
        // Enforce total weight is 100
        const totalWeight = this.variants.reduce((acc, curr) => acc + curr.weight, 0);

        let normalizedVariants = this.variants;
        if (totalWeight !== 100 && totalWeight > 0) {
            normalizedVariants = this.variants.map(v => ({
                variant: v.variant,
                weight: Math.round((v.weight / totalWeight) * 100)
            }));
        }

        // Generate deterministic 0-99 value based on user ID
        const hash = crypto.createHash('md5').update(userId).digest('hex');
        // Take first 8 chars, parse as hex, modulo 100
        const hashInt = parseInt(hash.substring(0, 8), 16);
        const randIndex = hashInt % 100;

        // Select variant based on weights array
        let accumulator = 0;
        for (const config of normalizedVariants) {
            accumulator += config.weight;
            if (randIndex < accumulator) {
                return config.variant;
            }
        }

        // Fallback
        return 'openai';
    }
}
