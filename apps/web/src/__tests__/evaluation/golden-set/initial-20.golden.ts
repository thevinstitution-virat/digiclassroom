/**
 * Initial 20 Golden Test Cases — Phase 5.4
 *
 * IMPORTANT: Page numbers in these cases must come from your ACTUAL Qdrant
 * indexed content. Before finalizing a case, query your Qdrant collection
 * for that topic and record the actual pageNumber from the top result.
 *
 * Set pageNumber to 0 for cases where you haven't verified yet.
 * The test runner will flag these as failures, helping you identify
 * which entries need Qdrant verification.
 */

import { GoldenTestCase } from '../types';

export const INITIAL_20_GOLDEN: GoldenTestCase[] = [
    // ── Science (5 cases) ──────────────────────────────────────────
    {
        id: 'sci-001',
        query: 'What is photosynthesis?',
        subject: 'science',
        grade: 7,
        expected: {
            chapter: 'Nutrition in Plants',
            pageNumber: 0, // TODO: verify against Qdrant
            contentExcerptContains: 'photosynthesis',
            mustContainInResponse: ['chlorophyll', 'carbon dioxide', 'sunlight'],
        },
    },
    {
        id: 'sci-002',
        query: 'Explain the structure of an atom',
        subject: 'science',
        grade: 9,
        expected: {
            chapter: 'Structure of the Atom',
            pageNumber: 0, // TODO: verify
            contentExcerptContains: 'atom',
            mustContainInResponse: ['electron', 'proton', 'neutron'],
        },
    },
    {
        id: 'sci-003',
        query: 'What is Ohms law?',
        subject: 'science',
        grade: 10,
        expected: {
            chapter: 'Electricity',
            pageNumber: 0, // TODO: verify
            contentExcerptContains: 'ohm',
            mustContainInResponse: ['voltage', 'current', 'resistance'],
        },
    },
    {
        id: 'sci-004',
        query: 'Describe the human digestive system',
        subject: 'science',
        grade: 7,
        expected: {
            chapter: 'Nutrition in Animals',
            pageNumber: 0, // TODO: verify
            contentExcerptContains: 'digesti',
            mustContainInResponse: ['stomach', 'intestine'],
        },
    },
    {
        id: 'sci-005',
        query: 'What is an ecosystem?',
        subject: 'science',
        grade: 10,
        expected: {
            chapter: 'Our Environment',
            pageNumber: 0, // TODO: verify
            contentExcerptContains: 'ecosystem',
            mustContainInResponse: ['biotic', 'abiotic'],
        },
    },

    // ── Mathematics (4 cases) ──────────────────────────────────────
    {
        id: 'math-001',
        query: 'What is the Pythagoras theorem?',
        subject: 'mathematics',
        grade: 10,
        expected: {
            chapter: 'Triangles',
            pageNumber: 0, // TODO: verify
            contentExcerptContains: 'pythagoras',
            mustContainInResponse: ['hypotenuse', 'right angle'],
        },
    },
    {
        id: 'math-002',
        query: 'Explain quadratic equations',
        subject: 'mathematics',
        grade: 10,
        expected: {
            chapter: 'Quadratic Equations',
            pageNumber: 0, // TODO: verify
            contentExcerptContains: 'quadratic',
            mustContainInResponse: ['roots', 'discriminant'],
        },
    },
    {
        id: 'math-003',
        query: 'What are rational numbers?',
        subject: 'mathematics',
        grade: 8,
        expected: {
            chapter: 'Rational Numbers',
            pageNumber: 0, // TODO: verify
            contentExcerptContains: 'rational',
            mustContainInResponse: ['numerator', 'denominator'],
        },
    },
    {
        id: 'math-004',
        query: 'What is a polynomial?',
        subject: 'mathematics',
        grade: 9,
        expected: {
            chapter: 'Polynomials',
            pageNumber: 0, // TODO: verify
            contentExcerptContains: 'polynomial',
            mustContainInResponse: ['degree', 'variable'],
        },
    },

    // ── Social Science (4 cases) ───────────────────────────────────
    {
        id: 'ssc-001',
        query: 'What were the causes of the French Revolution?',
        subject: 'social_science',
        grade: 9,
        expected: {
            chapter: 'The French Revolution',
            pageNumber: 0, // TODO: verify
            contentExcerptContains: 'revolution',
            mustContainInResponse: ['Louis XVI', 'Bastille'],
        },
    },
    {
        id: 'ssc-002',
        query: 'Explain the features of Indian democracy',
        subject: 'social_science',
        grade: 9,
        expected: {
            chapter: 'Democracy',
            pageNumber: 0, // TODO: verify
            contentExcerptContains: 'democracy',
            mustContainInResponse: ['election', 'constitution'],
        },
    },
    {
        id: 'ssc-003',
        query: 'What is the Green Revolution in India?',
        subject: 'social_science',
        grade: 9,
        expected: {
            chapter: 'Food Security',
            pageNumber: 0, // TODO: verify
            contentExcerptContains: 'green revolution',
            mustContainInResponse: ['wheat', 'agriculture'],
        },
    },
    {
        id: 'ssc-004',
        query: 'Describe the physical features of India',
        subject: 'social_science',
        grade: 9,
        expected: {
            chapter: 'Physical Features of India',
            pageNumber: 0, // TODO: verify
            contentExcerptContains: 'himalaya',
            mustContainInResponse: ['plateau', 'plain'],
        },
    },

    // ── English (4 cases) ──────────────────────────────────────────
    {
        id: 'eng-001',
        query: 'What is a pronoun in English grammar?',
        subject: 'english',
        grade: 7,
        expected: {
            chapter: 'Grammar',
            pageNumber: 0, // TODO: verify
            contentExcerptContains: 'pronoun',
            mustContainInResponse: ['noun', 'he', 'she'],
        },
    },

    // ── Out-of-scope cases (3 cases) ──────────────────────────────
    {
        id: 'oos-001',
        query: 'Who won IPL 2025?',
        subject: 'science',
        grade: 9,
        expected: {
            chapter: '',
            pageNumber: 0,
            contentExcerptContains: '',
            mustContainInResponse: [],
        },
        expectScopeViolation: true,
    },
    {
        id: 'oos-002',
        query: 'Write a Python program to sort a list',
        subject: 'mathematics',
        grade: 10,
        expected: {
            chapter: '',
            pageNumber: 0,
            contentExcerptContains: '',
            mustContainInResponse: [],
        },
        expectScopeViolation: true,
    },
    {
        id: 'oos-003',
        query: 'What is the latest iPhone model?',
        subject: 'science',
        grade: 8,
        expected: {
            chapter: '',
            pageNumber: 0,
            contentExcerptContains: '',
            mustContainInResponse: [],
        },
        expectScopeViolation: true,
    },
];
