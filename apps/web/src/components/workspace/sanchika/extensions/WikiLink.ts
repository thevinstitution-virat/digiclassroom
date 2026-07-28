/**
 * WikiLink — an inline atom node for [[Note Links]] (Phase 2 knowledge graph).
 *
 * - Renders as <a data-wikilink data-target data-label class="wikilink">label</a>
 *   so the server can extract links for backlinks/graph (see lib/sanchika/note-links).
 * - Typing [[Some Title]] auto-converts to a node via an input rule.
 * - Round-trips through saved HTML (attributes restored in parseHTML).
 * - The autocomplete dropdown + click navigation live in RichTextEditor.
 */

import { Node, mergeAttributes, InputRule } from '@tiptap/core';

export interface WikiLinkOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wikiLink: {
      /** Insert a wiki-link node (followed by a space). */
      insertWikiLink: (attrs: { label: string; target?: string | null }) => ReturnType;
    };
  }
}

export const WikiLink = Node.create<WikiLinkOptions>({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      label: {
        default: '',
        parseHTML: (el) =>
          (el as HTMLElement).getAttribute('data-label') ||
          (el as HTMLElement).textContent?.replace(/^\[\[|\]\]$/g, '') ||
          '',
        renderHTML: (attrs) => ({ 'data-label': attrs.label }),
      },
      target: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-target') || null,
        renderHTML: (attrs) => (attrs.target ? { 'data-target': attrs.target } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'a[data-wikilink]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'a',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-wikilink': 'true',
        href: '#',
        class: 'wikilink' + (node.attrs.target ? '' : ' wikilink-unresolved'),
      }),
      node.attrs.label || '',
    ];
  },

  renderText({ node }) {
    return `[[${node.attrs.label || ''}]]`;
  },

  addInputRules() {
    return [
      new InputRule({
        find: /\[\[([^\]]+)\]\]$/,
        handler: ({ range, match, chain }) => {
          const label = (match[1] || '').trim();
          if (!label) return;
          chain()
            .deleteRange(range)
            .insertContent([
              { type: this.name, attrs: { label, target: null } },
              { type: 'text', text: ' ' },
            ])
            .run();
        },
      }),
    ];
  },

  addCommands() {
    return {
      insertWikiLink:
        (attrs) =>
        ({ chain }) =>
          chain()
            .insertContent([
              { type: this.name, attrs: { label: attrs.label, target: attrs.target ?? null } },
              { type: 'text', text: ' ' },
            ])
            .run(),
    };
  },
});

export default WikiLink;
