/**
 * Out-of-Scope Extended Golden Tests — 10 cases
 * Queries that SHOULD be rejected by scope validation
 */

import { GoldenTestCase } from '../types';

export const OUT_OF_SCOPE_EXTENDED_GOLDEN: GoldenTestCase[] = [
    {
        id: 'oos-ext-001',
        query: 'What is the recipe for butter chicken?',
        subject: 'science',
        grade: 9,
        expected: { chapter: '', pageNumber: 0, contentExcerptContains: '', mustContainInResponse: [] },
        expectScopeViolation: true,
    },
    {
        id: 'oos-ext-002',
        query: 'Tell me about the Marvel Cinematic Universe',
        subject: 'social_science',
        grade: 10,
        expected: { chapter: '', pageNumber: 0, contentExcerptContains: '', mustContainInResponse: [] },
        expectScopeViolation: true,
    },
    {
        id: 'oos-ext-003',
        query: 'How to hack a WiFi password?',
        subject: 'science',
        grade: 10,
        expected: { chapter: '', pageNumber: 0, contentExcerptContains: '', mustContainInResponse: [] },
        expectScopeViolation: true,
    },
    {
        id: 'oos-ext-004',
        query: 'What is the stock price of Reliance Industries today?',
        subject: 'social_science',
        grade: 10,
        expected: { chapter: '', pageNumber: 0, contentExcerptContains: '', mustContainInResponse: [] },
        expectScopeViolation: true,
    },
    {
        id: 'oos-ext-005',
        query: 'Write me a love poem',
        subject: 'english',
        grade: 9,
        expected: { chapter: '', pageNumber: 0, contentExcerptContains: '', mustContainInResponse: [] },
        expectScopeViolation: true,
    },
    {
        id: 'oos-ext-006',
        query: 'Who is the best cricketer in the world?',
        subject: 'mathematics',
        grade: 8,
        expected: { chapter: '', pageNumber: 0, contentExcerptContains: '', mustContainInResponse: [] },
        expectScopeViolation: true,
    },
    {
        id: 'oos-ext-007',
        query: 'How to create a YouTube channel?',
        subject: 'english',
        grade: 10,
        expected: { chapter: '', pageNumber: 0, contentExcerptContains: '', mustContainInResponse: [] },
        expectScopeViolation: true,
    },
    {
        id: 'oos-ext-008',
        query: 'What are the cheat codes for GTA V?',
        subject: 'science',
        grade: 8,
        expected: { chapter: '', pageNumber: 0, contentExcerptContains: '', mustContainInResponse: [] },
        expectScopeViolation: true,
    },
    {
        id: 'oos-ext-009',
        query: 'Tell me a joke about teachers',
        subject: 'hindi',
        grade: 7,
        expected: { chapter: '', pageNumber: 0, contentExcerptContains: '', mustContainInResponse: [] },
        expectScopeViolation: true,
    },
    {
        id: 'oos-ext-010',
        query: 'How to make money online fast?',
        subject: 'social_science',
        grade: 9,
        expected: { chapter: '', pageNumber: 0, contentExcerptContains: '', mustContainInResponse: [] },
        expectScopeViolation: true,
    },
];
