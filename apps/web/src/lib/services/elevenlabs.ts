import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

// Validate env vars
const apiKey = process.env.ELEVENLABS_API_KEY;

if (!apiKey) {
    console.warn("ElevenLabs API Key is not configured. Audio synthesis will fail.");
}

export const elevenlabs = new ElevenLabsClient({
    apiKey: apiKey || "",
});

/**
 * Synthesize text into an audio buffer using ElevenLabs
 * @param text The script to synthesize
 * @param voiceId The ID of the voice to use (default: George)
 * @returns Buffer containing the MP3 audio data
 */
export async function generatePodcastAudio(text: string, voiceId = 'JBFqnCBsd6RMkjVDRZzb'): Promise<Buffer> {
    try {
        const audioStream = await elevenlabs.textToSpeech.convert(voiceId, {
            text: text,
        // @ts-ignore
            model_id: 'eleven_multilingual_v2',
            output_format: 'mp3_44100_128',
        });

        // Convert the async iterable stream into a Buffer
        const chunks: any[] = [];
        // @ts-ignore
        for await (const chunk of audioStream) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    } catch (error) {
        console.error("ElevenLabs synthesis error:", error);
        throw error;
    }
}
