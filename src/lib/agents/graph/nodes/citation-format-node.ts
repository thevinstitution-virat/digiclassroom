/**
 * Citation Format Node — Formats NCERTCitation and WebCitation differently.
 * PRESERVATION RULE A: Uses isNCERTCitation() guard to distinguish types.
 * NCERTCitation → "[Chapter, Page X: 'excerpt']"
 * WebCitation → "[Source: title (domain)]"
 */

import type { TutorState } from '../TutorGraphState';
import { isNCERTCitation } from '@/types/citations';

export async function citationFormatNode(state: TutorState): Promise<Partial<TutorState>> {
    if (!state.citations?.length) {
        return { finalResponse: state.rawResponse };
    }

    const ncertCitations = state.citations.filter(isNCERTCitation);
    const webCitations = state.citations.filter((c): c is import('@/types/citations').WebCitation => !isNCERTCitation(c));

    let citationBlock = '';

    if (ncertCitations.length > 0) {
        citationBlock += '\n\n**Sources:**\n';
        citationBlock += ncertCitations.map(c => {
            const pageStr = c.pageNumber > 0 ? `Page ${c.pageNumber}` : 'page unavailable';
            return `• ${c.chapter ? `Chapter ${c.chapter}` : 'NCERT'} — ${pageStr}: *"${c.contentExcerpt.slice(0, 60)}..."*`;
        }).join('\n');
    }

    if (webCitations.length > 0) {
        citationBlock += '\n\n**Additional Sources** *(current data — not from textbook)*:\n';
        citationBlock += webCitations.map(c =>
            `• [${c.title}](${c.url}) — ${c.domain}${c.publishedDate ? ` (${c.publishedDate})` : ''}`
        ).join('\n');
    }

    return {
        finalResponse: state.rawResponse + citationBlock,
    };
}
