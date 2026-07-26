/**
 * PageBreak — an explicit page boundary for the paged Sanchika layout.
 * On screen it shows a "Page break" separator; in print/PDF it forces a new page
 * (via `.page-break { break-after: page }` in RichTextEditor's styles).
 */

import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      /** Insert a page break at the current selection. */
      setPageBreak: () => ReturnType;
    };
  }
}

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: 'div[data-page-break]' }, { tag: 'hr[data-page-break]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-page-break': 'true', class: 'page-break', contenteditable: 'false' }),
      ['span', { class: 'page-break-label' }, 'Page break'],
    ];
  },

  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ chain }) =>
          chain().insertContent({ type: this.name }).run(),
    };
  },
});

export default PageBreak;
