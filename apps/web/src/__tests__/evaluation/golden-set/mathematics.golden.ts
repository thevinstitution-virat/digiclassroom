/**
 * Mathematics Golden Tests — 20 cases
 * Covers Algebra, Geometry, Arithmetic, Statistics across CBSE Classes 8-10
 */

import { GoldenTestCase } from '../types';

export const MATHEMATICS_GOLDEN: GoldenTestCase[] = [
    // ── Algebra (6 cases) ────────────────────────────────────────
    {
        id: 'math-ext-001',
        query: 'What are linear equations in two variables?',
        subject: 'mathematics',
        grade: 9,
        expected: {
            chapter: 'Linear Equations in Two Variables',
            pageNumber: 0,
            contentExcerptContains: 'linear',
            mustContainInResponse: ['variable', 'equation'],
        },
    },
    {
        id: 'math-ext-002',
        query: 'Explain arithmetic progressions',
        subject: 'mathematics',
        grade: 10,
        expected: {
            chapter: 'Arithmetic Progressions',
            pageNumber: 0,
            contentExcerptContains: 'arithmetic',
            mustContainInResponse: ['common difference', 'term'],
        },
    },
    {
        id: 'math-ext-003',
        query: 'What is a pair of linear equations in two variables?',
        subject: 'mathematics',
        grade: 10,
        expected: {
            chapter: 'Pair of Linear Equations in Two Variables',
            pageNumber: 0,
            contentExcerptContains: 'linear',
            mustContainInResponse: ['solution', 'graph'],
        },
    },
    {
        id: 'math-ext-004',
        query: 'Explain factorization of polynomials',
        subject: 'mathematics',
        grade: 9,
        expected: {
            chapter: 'Polynomials',
            pageNumber: 0,
            contentExcerptContains: 'factor',
            mustContainInResponse: ['zero', 'polynomial'],
        },
    },
    {
        id: 'math-ext-005',
        query: 'What are real numbers?',
        subject: 'mathematics',
        grade: 10,
        expected: {
            chapter: 'Real Numbers',
            pageNumber: 0,
            contentExcerptContains: 'real number',
            mustContainInResponse: ['rational', 'irrational'],
        },
    },
    {
        id: 'math-ext-006',
        query: 'Explain the concept of exponents and powers',
        subject: 'mathematics',
        grade: 8,
        expected: {
            chapter: 'Exponents and Powers',
            pageNumber: 0,
            contentExcerptContains: 'exponent',
            mustContainInResponse: ['power', 'base'],
        },
    },

    // ── Geometry (7 cases) ───────────────────────────────────────
    {
        id: 'math-ext-007',
        query: 'What are the properties of triangles?',
        subject: 'mathematics',
        grade: 9,
        expected: {
            chapter: 'Triangles',
            pageNumber: 0,
            contentExcerptContains: 'triangle',
            mustContainInResponse: ['angle', 'side'],
        },
    },
    {
        id: 'math-ext-008',
        query: 'Explain circles and their properties',
        subject: 'mathematics',
        grade: 10,
        expected: {
            chapter: 'Circles',
            pageNumber: 0,
            contentExcerptContains: 'circle',
            mustContainInResponse: ['radius', 'tangent'],
        },
    },
    {
        id: 'math-ext-009',
        query: 'What are quadrilaterals?',
        subject: 'mathematics',
        grade: 8,
        expected: {
            chapter: 'Understanding Quadrilaterals',
            pageNumber: 0,
            contentExcerptContains: 'quadrilateral',
            mustContainInResponse: ['angle', 'sides'],
        },
    },
    {
        id: 'math-ext-010',
        query: 'Explain surface areas and volumes',
        subject: 'mathematics',
        grade: 10,
        expected: {
            chapter: 'Surface Areas and Volumes',
            pageNumber: 0,
            contentExcerptContains: 'surface area',
            mustContainInResponse: ['volume', 'cylinder'],
        },
    },
    {
        id: 'math-ext-011',
        query: 'What is coordinate geometry?',
        subject: 'mathematics',
        grade: 10,
        expected: {
            chapter: 'Coordinate Geometry',
            pageNumber: 0,
            contentExcerptContains: 'coordinate',
            mustContainInResponse: ['point', 'distance'],
        },
    },
    {
        id: 'math-ext-012',
        query: 'What is the area of a parallelogram?',
        subject: 'mathematics',
        grade: 9,
        expected: {
            chapter: 'Areas of Parallelograms and Triangles',
            pageNumber: 0,
            contentExcerptContains: 'parallelogram',
            mustContainInResponse: ['base', 'height'],
        },
    },
    {
        id: 'math-ext-013',
        query: 'Explain constructions in geometry',
        subject: 'mathematics',
        grade: 9,
        expected: {
            chapter: 'Constructions',
            pageNumber: 0,
            contentExcerptContains: 'construct',
            mustContainInResponse: ['bisect', 'angle'],
        },
    },

    // ── Trigonometry (3 cases) ───────────────────────────────────
    {
        id: 'math-ext-014',
        query: 'What is trigonometry?',
        subject: 'mathematics',
        grade: 10,
        expected: {
            chapter: 'Introduction to Trigonometry',
            pageNumber: 0,
            contentExcerptContains: 'trigonometr',
            mustContainInResponse: ['sin', 'cos'],
        },
    },
    {
        id: 'math-ext-015',
        query: 'Explain trigonometric ratios',
        subject: 'mathematics',
        grade: 10,
        expected: {
            chapter: 'Introduction to Trigonometry',
            pageNumber: 0,
            contentExcerptContains: 'trigonometr',
            mustContainInResponse: ['ratio', 'angle'],
        },
    },
    {
        id: 'math-ext-016',
        query: 'What are applications of trigonometry in height and distance problems?',
        subject: 'mathematics',
        grade: 10,
        expected: {
            chapter: 'Some Applications of Trigonometry',
            pageNumber: 0,
            contentExcerptContains: 'height',
            mustContainInResponse: ['angle', 'elevation'],
        },
    },

    // ── Statistics & Probability (4 cases) ──────────────────────
    {
        id: 'math-ext-017',
        query: 'What is probability?',
        subject: 'mathematics',
        grade: 10,
        expected: {
            chapter: 'Probability',
            pageNumber: 0,
            contentExcerptContains: 'probability',
            mustContainInResponse: ['event', 'outcome'],
        },
    },
    {
        id: 'math-ext-018',
        query: 'Explain mean, median and mode',
        subject: 'mathematics',
        grade: 10,
        expected: {
            chapter: 'Statistics',
            pageNumber: 0,
            contentExcerptContains: 'mean',
            mustContainInResponse: ['median', 'mode'],
        },
    },
    {
        id: 'math-ext-019',
        query: 'What is data handling?',
        subject: 'mathematics',
        grade: 8,
        expected: {
            chapter: 'Data Handling',
            pageNumber: 0,
            contentExcerptContains: 'data',
            mustContainInResponse: ['graph', 'frequency'],
        },
    },
    {
        id: 'math-ext-020',
        query: 'Explain the concept of sets',
        subject: 'mathematics',
        grade: 9,
        expected: {
            chapter: 'Number Systems',
            pageNumber: 0,
            contentExcerptContains: 'number',
            mustContainInResponse: ['natural', 'whole'],
        },
    },
];
