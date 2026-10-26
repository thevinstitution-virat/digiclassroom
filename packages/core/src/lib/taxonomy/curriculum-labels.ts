/**
 * Display labels for curriculum v2 nodes, the same words Book Buddy's picker uses
 * (lib/api/curriculumApi.ts there). No server code here, so client components can import it.
 */

export const NODE_TYPE_LABEL: Record<string, string> = {
  DOMAIN: 'Domain',
  SUBDOMAIN: 'Board / sector',
  PROGRAM: 'Programme',
  SPECIALISATION: 'Specialisation',
  CLASS: 'Class',
  EXAM: 'Exam',
  LEVEL: 'Level',
  PERIOD: 'Year / semester',
  STAGE: 'Stage',
  GROUP: 'Group',
  MODULE: 'Module',
  PAPER: 'Paper',
  SUBJECT: 'Subject',
  SECTION: 'Section',
  UNIT: 'Unit',
  TOPIC: 'Topic',
};

/** How far to trust a node's details. Shown as a small badge so nobody mistakes a template for gospel. */
export const VERIFICATION_HINT: Record<string, string> = {
  sourced: 'Taken from the regulator’s published scheme',
  verify: 'Structure is right; check the details against the current notification',
  template: 'A default pattern; the real list varies by board or state',
};
