/**
 * Multi-Page Content Utilities
 * 
 * Handles serialization and deserialization of multi-page content
 * for Sanchika notes. Supports both legacy single-page HTML and
 * new multi-page JSON format.
 */

export interface PageContent {
    id: string;
    html: string;
    header?: string;
    addedFrom?: 'ai_tutor' | 'manual';
    addedAt?: string;
}

export interface MultiPageContent {
    version: 2;
    pages: PageContent[];
    metadata?: {
        title?: string;
        author?: string;
    };
}

/**
 * Check if content is multi-page JSON format
 */
export function isMultiPageContent(content: string): boolean {
    if (!content || typeof content !== 'string')
  return false;

    try {
        const parsed = JSON.parse(content);
        return parsed.version === 2 && Array.isArray(parsed.pages);
    } catch {
        return false;
    }
}

/**
 * Parse content - returns multi-page format regardless of input
 * Converts legacy single-page HTML to multi-page format if needed
 */
export function parseContent(content: string): MultiPageContent {
    if (!content || content.trim() === '') {
        return {
            version: 2,
            pages: [{
                id: generatePageId(),
                html: '',
            }]
        };
    }

    // Try to parse as multi-page JSON
    if (isMultiPageContent(content)) {
        return JSON.parse(content);
    }

    // Legacy single-page HTML - convert to multi-page format
    return {
        version: 2,
        pages: [{
            id: generatePageId(),
            html: content,
        }]
    };
}

/**
 * Serialize multi-page content to JSON string for storage
 */
export function serializeContent(multiPage: MultiPageContent): string {
    return JSON.stringify(multiPage);
}

/**
 * Add a new page with content at the end
 */
export function addNewPage(
    existingContent: string,
    newPageHtml: string,
    options?: {
        addedFrom?: 'ai_tutor' | 'manual';
        header?: string;
    }
): string {
    const parsed = parseContent(existingContent);

    const newPage: PageContent = {
        id: generatePageId(),
        html: newPageHtml,
        addedFrom: options?.addedFrom,
        addedAt: new Date().toISOString(),
        header: options?.header,
    };

    parsed.pages.push(newPage);

    return serializeContent(parsed);
}

/**
 * Get combined HTML for all pages (for legacy rendering)
 * This creates a visual separator between pages
 */
export function getCombinedHtml(content: string): string {
    const parsed = parseContent(content);

    return parsed.pages.map((page, index) => {
        let html = '';

        // Add page separator header for pages added from AI Tutor
        if (index > 0 && page.addedFrom === 'ai_tutor') {
            const dateStr = page.addedAt
                ? new Date(page.addedAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                })
                : new Date().toLocaleDateString('en-IN');

            html += `
<div style="margin: 32px 0 24px 0; padding: 24px 0 16px 0; border-top: 3px solid #e5e7eb;">
  <div style="background: linear-gradient(135deg, #f97316, #3b82f6); color: white; padding: 8px 16px; border-radius: 8px; display: inline-block; margin-bottom: 16px; font-size: 14px; font-weight: 500;">
    📝 Added from AI Tutor • ${dateStr}
  </div>
</div>
`;
        } else if (index > 0) {
            // Generic page break for manually added pages
            html += `<div style="margin: 32px 0; border-top: 2px dashed #d1d5db; page-break-before: always;"></div>`;
        }

        html += page.html;

        return html;
    }).join('\n');
}

/**
 * Get content for a specific page
 */
export function getPageContent(content: string, pageIndex: number): string {
    const parsed = parseContent(content);

    if (pageIndex < 0 || pageIndex >= parsed.pages.length) {
        return '';
    }

    return parsed.pages[pageIndex].html;
}

/**
 * Get total page count
 */
export function getPageCount(content: string): number {
    const parsed = parseContent(content);
    return parsed.pages.length;
}

/**
 * Update content for a specific page
 */
export function updatePageContent(content: string, pageIndex: number, newHtml: string): string {
    const parsed = parseContent(content);

    if (pageIndex >= 0 && pageIndex < parsed.pages.length) {
        parsed.pages[pageIndex].html = newHtml;
    }

    return serializeContent(parsed);
}

/**
 * Generate unique page ID
 */
function generatePageId(): string {
    return `page-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export default {
    isMultiPageContent,
    parseContent,
    serializeContent,
    addNewPage,
    getCombinedHtml,
    getPageContent,
    getPageCount,
    updatePageContent,
};
