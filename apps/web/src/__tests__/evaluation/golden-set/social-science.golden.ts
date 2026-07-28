/**
 * Social Science Golden Tests — 20 cases
 * Covers History, Geography, Civics, Economics for CBSE Classes 8-10
 */

import { GoldenTestCase } from '../types';

export const SOCIAL_SCIENCE_GOLDEN: GoldenTestCase[] = [
    // ── History (6 cases) ────────────────────────────────────────
    {
        id: 'ssc-ext-001',
        query: 'What was the Russian Revolution?',
        subject: 'social_science',
        grade: 9,
        expected: {
            chapter: 'Socialism in Europe and the Russian Revolution',
            pageNumber: 0,
            contentExcerptContains: 'revolution',
            mustContainInResponse: ['Bolshevik', 'Lenin'],
        },
    },
    {
        id: 'ssc-ext-002',
        query: 'Explain the rise of nationalism in Europe',
        subject: 'social_science',
        grade: 10,
        expected: {
            chapter: 'The Rise of Nationalism in Europe',
            pageNumber: 0,
            contentExcerptContains: 'national',
            mustContainInResponse: ['nation', 'state'],
        },
    },
    {
        id: 'ssc-ext-003',
        query: 'What was the Nazism and the rise of Hitler?',
        subject: 'social_science',
        grade: 9,
        expected: {
            chapter: 'Nazism and the Rise of Hitler',
            pageNumber: 0,
            contentExcerptContains: 'nazi',
            mustContainInResponse: ['Hitler', 'Germany'],
        },
    },
    {
        id: 'ssc-ext-004',
        query: 'Describe the nationalist movement in Indo-China',
        subject: 'social_science',
        grade: 10,
        expected: {
            chapter: 'The Nationalist Movement in Indo-China',
            pageNumber: 0,
            contentExcerptContains: 'indo-china',
            mustContainInResponse: ['Vietnam', 'colonial'],
        },
    },
    {
        id: 'ssc-ext-005',
        query: 'What was the Indian National Movement?',
        subject: 'social_science',
        grade: 10,
        expected: {
            chapter: 'Nationalism in India',
            pageNumber: 0,
            contentExcerptContains: 'national',
            mustContainInResponse: ['Gandhi', 'movement'],
        },
    },
    {
        id: 'ssc-ext-006',
        query: 'Explain forest society and colonialism',
        subject: 'social_science',
        grade: 9,
        expected: {
            chapter: 'Forest Society and Colonialism',
            pageNumber: 0,
            contentExcerptContains: 'forest',
            mustContainInResponse: ['colonial', 'tribe'],
        },
    },

    // ── Geography (6 cases) ──────────────────────────────────────
    {
        id: 'ssc-ext-007',
        query: 'What is climate in India?',
        subject: 'social_science',
        grade: 9,
        expected: {
            chapter: 'Climate',
            pageNumber: 0,
            contentExcerptContains: 'climate',
            mustContainInResponse: ['monsoon', 'season'],
        },
    },
    {
        id: 'ssc-ext-008',
        query: 'Describe the drainage system of India',
        subject: 'social_science',
        grade: 9,
        expected: {
            chapter: 'Drainage',
            pageNumber: 0,
            contentExcerptContains: 'drainage',
            mustContainInResponse: ['river', 'Ganga'],
        },
    },
    {
        id: 'ssc-ext-009',
        query: 'What are the natural resources of India?',
        subject: 'social_science',
        grade: 10,
        expected: {
            chapter: 'Resources and Development',
            pageNumber: 0,
            contentExcerptContains: 'resource',
            mustContainInResponse: ['land', 'soil'],
        },
    },
    {
        id: 'ssc-ext-010',
        query: 'Explain agriculture in India',
        subject: 'social_science',
        grade: 10,
        expected: {
            chapter: 'Agriculture',
            pageNumber: 0,
            contentExcerptContains: 'agricultur',
            mustContainInResponse: ['crop', 'farming'],
        },
    },
    {
        id: 'ssc-ext-011',
        query: 'What are minerals and energy resources?',
        subject: 'social_science',
        grade: 10,
        expected: {
            chapter: 'Minerals and Energy Resources',
            pageNumber: 0,
            contentExcerptContains: 'mineral',
            mustContainInResponse: ['iron', 'coal'],
        },
    },
    {
        id: 'ssc-ext-012',
        query: 'Describe manufacturing industries in India',
        subject: 'social_science',
        grade: 10,
        expected: {
            chapter: 'Manufacturing Industries',
            pageNumber: 0,
            contentExcerptContains: 'manufactur',
            mustContainInResponse: ['industry', 'production'],
        },
    },

    // ── Civics (4 cases) ─────────────────────────────────────────
    {
        id: 'ssc-ext-013',
        query: 'What is the constitutional design of India?',
        subject: 'social_science',
        grade: 9,
        expected: {
            chapter: 'Constitutional Design',
            pageNumber: 0,
            contentExcerptContains: 'constitution',
            mustContainInResponse: ['fundamental', 'rights'],
        },
    },
    {
        id: 'ssc-ext-014',
        query: 'Explain the working of institutions in Indian democracy',
        subject: 'social_science',
        grade: 9,
        expected: {
            chapter: 'Working of Institutions',
            pageNumber: 0,
            contentExcerptContains: 'institution',
            mustContainInResponse: ['parliament', 'government'],
        },
    },
    {
        id: 'ssc-ext-015',
        query: 'What is federalism?',
        subject: 'social_science',
        grade: 10,
        expected: {
            chapter: 'Federalism',
            pageNumber: 0,
            contentExcerptContains: 'federal',
            mustContainInResponse: ['state', 'central'],
        },
    },
    {
        id: 'ssc-ext-016',
        query: 'Explain political parties in India',
        subject: 'social_science',
        grade: 10,
        expected: {
            chapter: 'Political Parties',
            pageNumber: 0,
            contentExcerptContains: 'political part',
            mustContainInResponse: ['election', 'party'],
        },
    },

    // ── Economics (4 cases) ──────────────────────────────────────
    {
        id: 'ssc-ext-017',
        query: 'What is the story of village Palampur?',
        subject: 'social_science',
        grade: 9,
        expected: {
            chapter: 'The Story of Village Palampur',
            pageNumber: 0,
            contentExcerptContains: 'palampur',
            mustContainInResponse: ['farming', 'land'],
        },
    },
    {
        id: 'ssc-ext-018',
        query: 'Explain the concept of development',
        subject: 'social_science',
        grade: 10,
        expected: {
            chapter: 'Development',
            pageNumber: 0,
            contentExcerptContains: 'development',
            mustContainInResponse: ['income', 'standard'],
        },
    },
    {
        id: 'ssc-ext-019',
        query: 'What is money and credit?',
        subject: 'social_science',
        grade: 10,
        expected: {
            chapter: 'Money and Credit',
            pageNumber: 0,
            contentExcerptContains: 'money',
            mustContainInResponse: ['bank', 'loan'],
        },
    },
    {
        id: 'ssc-ext-020',
        query: 'Explain globalisation and the Indian economy',
        subject: 'social_science',
        grade: 10,
        expected: {
            chapter: 'Globalisation and the Indian Economy',
            pageNumber: 0,
            contentExcerptContains: 'globalis',
            mustContainInResponse: ['trade', 'foreign'],
        },
    },
];
