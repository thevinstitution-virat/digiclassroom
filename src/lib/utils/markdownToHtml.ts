/**
 * Markdown to HTML Converter Utility
 * Used for converting AI-generated markdown content to HTML for rich text editors
 * 
 * CRITICAL: AI-generated content often has blank lines between numbered items.
 * This converter handles that case properly by looking ahead for continued list items.
 */

/**
 * Converts markdown text to HTML with styling classes
 * Preserves exact formatting of AI Tutor responses
 */
export function markdownToHtml(markdown: string): string {
    if (!markdown || typeof markdown !== 'string') {
        return '';
    }

    // Normalize line endings
    let content = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Step 1: Protect code blocks from processing
    const codeBlocks: string[] = [];
    content = content.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
        const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
        codeBlocks.push(`<pre class="bg-gray-100 dark:bg-gray-800 p-3 rounded-md text-sm font-mono overflow-x-auto my-3"><code>${escapeHtml(code.trim())}</code></pre>`);
        return placeholder;
    });

    // Step 2: Process the content block by block
    const lines = content.split('\n');
    const processedBlocks: string[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        // Check for horizontal rule
        if (/^[-*_]{3,}$/.test(trimmed)) {
            processedBlocks.push('<hr class="my-6 border-t-2 border-gray-300" />');
            i++;
            continue;
        }

        // Check for headers
        const headerMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
        if (headerMatch) {
            const level = headerMatch[1].length;
            const text = processInlineFormatting(headerMatch[2]);
            const classes = {
                1: 'text-2xl font-bold text-gray-900 mt-8 mb-4',
                2: 'text-xl font-bold text-gray-900 mt-6 mb-3',
                3: 'text-lg font-semibold text-gray-800 mt-4 mb-2',
                4: 'text-base font-semibold text-gray-800 mt-3 mb-2'
            };
            processedBlocks.push(`<h${level} class="${classes[level as 1 | 2 | 3 | 4]}">${text}</h${level}>`);
            i++;
            continue;
        }

        // Check for ordered list (handles lists with blank lines between items)
        const orderedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
        if (orderedMatch) {
            const listItems: string[] = [];

            // Collect all list items (allowing blank lines between them)
            while (i < lines.length) {
                const currentLine = lines[i].trim();

                // Check if this is a numbered list item
                const itemMatch = currentLine.match(/^(\d+)\.\s+(.+)$/);
                if (itemMatch) {
                    listItems.push(`<li class="leading-relaxed mb-2">${processInlineFormatting(itemMatch[2])}</li>`);
                    i++;
                }
                // Skip blank lines within the list (look ahead to see if list continues)
                else if (currentLine === '') {
                    // Look ahead to see if there's another numbered item
                    let lookAhead = i + 1;
                    while (lookAhead < lines.length && lines[lookAhead].trim() === '') {
                        lookAhead++;
                    }
                    if (lookAhead < lines.length && /^\d+\.\s+/.test(lines[lookAhead].trim())) {
                        // There's another list item ahead, skip the blank line
                        i++;
                    } else {
                        // No more list items, break out
                        break;
                    }
                } else {
                    // Non-blank, non-list line - end the list
                    break;
                }
            }

            if (listItems.length > 0) {
                processedBlocks.push(`<ol class="list-decimal ml-6 mb-4 space-y-2">${listItems.join('')}</ol>`);
            }
            continue;
        }

        // Check for unordered list
        const unorderedMatch = trimmed.match(/^[-*+]\s+(.+)$/);
        if (unorderedMatch) {
            const listItems: string[] = [];

            while (i < lines.length) {
                const currentLine = lines[i].trim();
                const itemMatch = currentLine.match(/^[-*+]\s+(.+)$/);

                if (itemMatch) {
                    listItems.push(`<li class="leading-relaxed mb-2">${processInlineFormatting(itemMatch[1])}</li>`);
                    i++;
                } else if (currentLine === '') {
                    // Look ahead for more items
                    let lookAhead = i + 1;
                    while (lookAhead < lines.length && lines[lookAhead].trim() === '') {
                        lookAhead++;
                    }
                    if (lookAhead < lines.length && /^[-*+]\s+/.test(lines[lookAhead].trim())) {
                        i++;
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            }

            if (listItems.length > 0) {
                processedBlocks.push(`<ul class="list-disc ml-6 mb-4 space-y-2">${listItems.join('')}</ul>`);
            }
            continue;
        }

        // Check for table
        if (trimmed.startsWith('|')) {
            const tableLines: string[] = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) {
                tableLines.push(lines[i]);
                i++;
            }
            if (tableLines.length >= 2) {
                processedBlocks.push(processTable(tableLines));
            }
            continue;
        }

        // Code block placeholder - pass through
        if (trimmed.startsWith('__CODE_BLOCK_')) {
            processedBlocks.push(trimmed);
            i++;
            continue;
        }

        // Empty line - skip
        if (trimmed === '') {
            i++;
            continue;
        }

        // Regular paragraph - collect consecutive non-empty lines
        const paragraphLines: string[] = [];
        while (i < lines.length) {
            const currentLine = lines[i].trim();

            // Stop if we hit a special element
            if (currentLine === '' ||
                /^#{1,4}\s+/.test(currentLine) ||
                /^\d+\.\s+/.test(currentLine) ||
                /^[-*+]\s+/.test(currentLine) ||
                /^[-*_]{3,}$/.test(currentLine) ||
                currentLine.startsWith('|') ||
                currentLine.startsWith('__CODE_BLOCK_')) {
                break;
            }

            paragraphLines.push(currentLine);
            i++;
        }

        if (paragraphLines.length > 0) {
            const text = processInlineFormatting(paragraphLines.join(' '));
            processedBlocks.push(`<p class="mb-4 leading-relaxed text-gray-800">${text}</p>`);
        }
    }

    // Step 3: Join all blocks
    let html = processedBlocks.join('\n');

    // Step 4: Restore code blocks
    codeBlocks.forEach((block, index) => {
        html = html.replace(`__CODE_BLOCK_${index}__`, block);
    });

    return html;
}

/**
 * Process inline formatting (bold, italic, code, links)
 */
function processInlineFormatting(text: string): string {
    return text
        // Bold + Italic
        .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
        .replace(/__(.*?)__/g, '<strong class="font-semibold">$1</strong>')
        // Italic
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/_(.*?)_/g, '<em>$1</em>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">$1</code>');
}

/**
 * Process markdown table to HTML
 */
function processTable(lines: string[]): string {
    if (lines.length < 2)
  return '';

    const headerCells = lines[0].split('|').map(c => c.trim()).filter(Boolean);
    // Skip the separator line (line 1)
    const bodyRows = lines.slice(2).map(row =>
        row.split('|').map(c => c.trim()).filter(Boolean)
    );

    let html = '<table class="w-full border-collapse border border-gray-300 my-4">';

    // Header
    html += '<thead><tr class="bg-gray-100">';
    headerCells.forEach(cell => {
        html += `<th class="border border-gray-300 px-4 py-2 text-left font-semibold">${processInlineFormatting(cell)}</th>`;
    });
    html += '</tr></thead>';

    // Body
    html += '<tbody>';
    bodyRows.forEach(row => {
        html += '<tr class="hover:bg-gray-50">';
        row.forEach(cell => {
            html += `<td class="border border-gray-300 px-4 py-2">${processInlineFormatting(cell)}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table>';

    return html;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export default markdownToHtml;
