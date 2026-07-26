/**
 * Language Golden Tests — 10 cases
 * Covers English and Hindi for CBSE Classes 7-10
 */

import { GoldenTestCase } from '../types';

export const LANGUAGE_GOLDEN: GoldenTestCase[] = [
    // ── English Grammar (4 cases) ───────────────────────────────
    {
        id: 'lang-001',
        query: 'What are tenses in English grammar?',
        subject: 'english',
        grade: 8,
        expected: {
            chapter: 'Grammar',
            pageNumber: 0,
            contentExcerptContains: 'tense',
            mustContainInResponse: ['past', 'present', 'future'],
        },
    },
    {
        id: 'lang-002',
        query: 'Explain active and passive voice',
        subject: 'english',
        grade: 9,
        expected: {
            chapter: 'Grammar',
            pageNumber: 0,
            contentExcerptContains: 'voice',
            mustContainInResponse: ['active', 'passive'],
        },
    },
    {
        id: 'lang-003',
        query: 'What are prepositions?',
        subject: 'english',
        grade: 7,
        expected: {
            chapter: 'Grammar',
            pageNumber: 0,
            contentExcerptContains: 'preposition',
            mustContainInResponse: ['in', 'on', 'at'],
        },
    },
    {
        id: 'lang-004',
        query: 'Explain direct and indirect speech',
        subject: 'english',
        grade: 10,
        expected: {
            chapter: 'Grammar',
            pageNumber: 0,
            contentExcerptContains: 'speech',
            mustContainInResponse: ['direct', 'indirect'],
        },
    },

    // ── English Literature (3 cases) ────────────────────────────
    {
        id: 'lang-005',
        query: 'What is the central theme of the poem "The Road Not Taken"?',
        subject: 'english',
        grade: 9,
        expected: {
            chapter: 'The Road Not Taken',
            pageNumber: 0,
            contentExcerptContains: 'road',
            mustContainInResponse: ['choice', 'path'],
        },
    },
    {
        id: 'lang-006',
        query: 'Summarize the story "The Fun They Had"',
        subject: 'english',
        grade: 9,
        expected: {
            chapter: 'The Fun They Had',
            pageNumber: 0,
            contentExcerptContains: 'fun',
            mustContainInResponse: ['school', 'book'],
        },
    },
    {
        id: 'lang-007',
        query: 'What is the theme of "A Letter to God"?',
        subject: 'english',
        grade: 10,
        expected: {
            chapter: 'A Letter to God',
            pageNumber: 0,
            contentExcerptContains: 'letter',
            mustContainInResponse: ['faith', 'God'],
        },
    },

    // ── Hindi (3 cases) ─────────────────────────────────────────
    {
        id: 'lang-008',
        query: 'संज्ञा किसे कहते हैं और उसके प्रकार बताइए',
        subject: 'hindi',
        grade: 8,
        expected: {
            chapter: 'व्याकरण',
            pageNumber: 0,
            contentExcerptContains: 'संज्ञा',
            mustContainInResponse: ['व्यक्तिवाचक', 'जातिवाचक'],
        },
    },
    {
        id: 'lang-009',
        query: 'सर्वनाम किसे कहते हैं?',
        subject: 'hindi',
        grade: 7,
        expected: {
            chapter: 'व्याकरण',
            pageNumber: 0,
            contentExcerptContains: 'सर्वनाम',
            mustContainInResponse: ['संज्ञा', 'वह'],
        },
    },
    {
        id: 'lang-010',
        query: 'क्रिया विशेषण क्या है?',
        subject: 'hindi',
        grade: 9,
        expected: {
            chapter: 'व्याकरण',
            pageNumber: 0,
            contentExcerptContains: 'क्रिया',
            mustContainInResponse: ['विशेषण', 'क्रिया'],
        },
    },

    // ── Additional English (3 cases to reach 100 total) ─────────
    {
        id: 'lang-011',
        query: 'What are conjunctions in English?',
        subject: 'english',
        grade: 8,
        expected: {
            chapter: 'Grammar',
            pageNumber: 0,
            contentExcerptContains: 'conjunction',
            mustContainInResponse: ['and', 'but', 'or'],
        },
    },
    {
        id: 'lang-012',
        query: 'Explain the poem "Dust of Snow" by Robert Frost',
        subject: 'english',
        grade: 10,
        expected: {
            chapter: 'Dust of Snow',
            pageNumber: 0,
            contentExcerptContains: 'dust',
            mustContainInResponse: ['crow', 'hemlock'],
        },
    },
    {
        id: 'lang-013',
        query: 'What are adjectives and their types?',
        subject: 'english',
        grade: 7,
        expected: {
            chapter: 'Grammar',
            pageNumber: 0,
            contentExcerptContains: 'adjective',
            mustContainInResponse: ['noun', 'quality'],
        },
    },
];
