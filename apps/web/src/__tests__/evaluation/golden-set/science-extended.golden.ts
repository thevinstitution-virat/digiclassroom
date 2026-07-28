/**
 * Science Extended Golden Tests — 20 cases
 * Covers Physics, Chemistry, Biology across CBSE Classes 6-10
 */

import { GoldenTestCase } from '../types';

export const SCIENCE_EXTENDED_GOLDEN: GoldenTestCase[] = [
    // ── Physics (7 cases) ────────────────────────────────────────
    {
        id: 'sci-ext-001',
        query: 'What is the law of conservation of energy?',
        subject: 'science',
        grade: 9,
        expected: {
            chapter: 'Work and Energy',
            pageNumber: 0,
            contentExcerptContains: 'energy',
            mustContainInResponse: ['transform', 'conserv'],
        },
    },
    {
        id: 'sci-ext-002',
        query: 'Explain reflection of light',
        subject: 'science',
        grade: 10,
        expected: {
            chapter: 'Light',
            pageNumber: 0,
            contentExcerptContains: 'reflect',
            mustContainInResponse: ['mirror', 'angle', 'incident'],
        },
    },
    {
        id: 'sci-ext-003',
        query: 'What is momentum?',
        subject: 'science',
        grade: 9,
        expected: {
            chapter: 'Force and Laws of Motion',
            pageNumber: 0,
            contentExcerptContains: 'momentum',
            mustContainInResponse: ['mass', 'velocity'],
        },
    },
    {
        id: 'sci-ext-004',
        query: 'Describe refraction of light through a glass prism',
        subject: 'science',
        grade: 10,
        expected: {
            chapter: 'Light',
            pageNumber: 0,
            contentExcerptContains: 'refract',
            mustContainInResponse: ['prism', 'spectrum'],
        },
    },
    {
        id: 'sci-ext-005',
        query: 'What is magnetic effect of electric current?',
        subject: 'science',
        grade: 10,
        expected: {
            chapter: 'Magnetic Effects of Electric Current',
            pageNumber: 0,
            contentExcerptContains: 'magnetic',
            mustContainInResponse: ['electromagnet', 'current'],
        },
    },
    {
        id: 'sci-ext-006',
        query: 'Explain Newtons third law of motion',
        subject: 'science',
        grade: 9,
        expected: {
            chapter: 'Force and Laws of Motion',
            pageNumber: 0,
            contentExcerptContains: 'newton',
            mustContainInResponse: ['action', 'reaction'],
        },
    },
    {
        id: 'sci-ext-007',
        query: 'What is gravitational force?',
        subject: 'science',
        grade: 9,
        expected: {
            chapter: 'Gravitation',
            pageNumber: 0,
            contentExcerptContains: 'gravit',
            mustContainInResponse: ['mass', 'earth'],
        },
    },

    // ── Chemistry (7 cases) ──────────────────────────────────────
    {
        id: 'sci-ext-008',
        query: 'What are acids and bases?',
        subject: 'science',
        grade: 10,
        expected: {
            chapter: 'Acids, Bases and Salts',
            pageNumber: 0,
            contentExcerptContains: 'acid',
            mustContainInResponse: ['pH', 'hydrogen'],
        },
    },
    {
        id: 'sci-ext-009',
        query: 'Explain chemical reactions and equations',
        subject: 'science',
        grade: 10,
        expected: {
            chapter: 'Chemical Reactions and Equations',
            pageNumber: 0,
            contentExcerptContains: 'chemical',
            mustContainInResponse: ['reactant', 'product'],
        },
    },
    {
        id: 'sci-ext-010',
        query: 'What is the periodic table?',
        subject: 'science',
        grade: 10,
        expected: {
            chapter: 'Periodic Classification of Elements',
            pageNumber: 0,
            contentExcerptContains: 'periodic',
            mustContainInResponse: ['element', 'group'],
        },
    },
    {
        id: 'sci-ext-011',
        query: 'What are metals and non-metals?',
        subject: 'science',
        grade: 10,
        expected: {
            chapter: 'Metals and Non-metals',
            pageNumber: 0,
            contentExcerptContains: 'metal',
            mustContainInResponse: ['conduct', 'malleable'],
        },
    },
    {
        id: 'sci-ext-012',
        query: 'Explain carbon and its compounds',
        subject: 'science',
        grade: 10,
        expected: {
            chapter: 'Carbon and its Compounds',
            pageNumber: 0,
            contentExcerptContains: 'carbon',
            mustContainInResponse: ['organic', 'compound'],
        },
    },
    {
        id: 'sci-ext-013',
        query: 'What is corrosion and rancidity?',
        subject: 'science',
        grade: 10,
        expected: {
            chapter: 'Chemical Reactions and Equations',
            pageNumber: 0,
            contentExcerptContains: 'corrosion',
            mustContainInResponse: ['oxidation', 'iron'],
        },
    },
    {
        id: 'sci-ext-014',
        query: 'Explain the structure of molecules',
        subject: 'science',
        grade: 9,
        expected: {
            chapter: 'Atoms and Molecules',
            pageNumber: 0,
            contentExcerptContains: 'molecule',
            mustContainInResponse: ['atom', 'element'],
        },
    },

    // ── Biology (6 cases) ────────────────────────────────────────
    {
        id: 'sci-ext-015',
        query: 'What is heredity and evolution?',
        subject: 'science',
        grade: 10,
        expected: {
            chapter: 'Heredity and Evolution',
            pageNumber: 0,
            contentExcerptContains: 'heredity',
            mustContainInResponse: ['gene', 'trait'],
        },
    },
    {
        id: 'sci-ext-016',
        query: 'Explain the human respiratory system',
        subject: 'science',
        grade: 10,
        expected: {
            chapter: 'Life Processes',
            pageNumber: 0,
            contentExcerptContains: 'respir',
            mustContainInResponse: ['lung', 'oxygen'],
        },
    },
    {
        id: 'sci-ext-017',
        query: 'What is the process of reproduction in plants?',
        subject: 'science',
        grade: 10,
        expected: {
            chapter: 'How do Organisms Reproduce',
            pageNumber: 0,
            contentExcerptContains: 'reproduct',
            mustContainInResponse: ['pollination', 'seed'],
        },
    },
    {
        id: 'sci-ext-018',
        query: 'Describe the nervous system in humans',
        subject: 'science',
        grade: 10,
        expected: {
            chapter: 'Control and Coordination',
            pageNumber: 0,
            contentExcerptContains: 'nervous',
            mustContainInResponse: ['brain', 'neuron'],
        },
    },
    {
        id: 'sci-ext-019',
        query: 'What are the different types of tissues?',
        subject: 'science',
        grade: 9,
        expected: {
            chapter: 'Tissues',
            pageNumber: 0,
            contentExcerptContains: 'tissue',
            mustContainInResponse: ['epithelial', 'connective'],
        },
    },
    {
        id: 'sci-ext-020',
        query: 'Explain the food chain and food web',
        subject: 'science',
        grade: 10,
        expected: {
            chapter: 'Our Environment',
            pageNumber: 0,
            contentExcerptContains: 'food chain',
            mustContainInResponse: ['producer', 'consumer'],
        },
    },
];
