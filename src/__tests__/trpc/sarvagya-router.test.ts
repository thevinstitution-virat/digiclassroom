/**
 * Sarvagya tRPC Router — Unit Tests
 *
 * Mocks all infrastructure deps (auth, db, queues, credits, client)
 * so the test validates only the router logic.
 */

// Mock @/auth BEFORE any imports that reach it
jest.mock('@/auth', () => ({
    auth: {
        api: {
            getSession: jest.fn().mockResolvedValue({
                user: { id: 'test-user-id', role: 'student' },
                session: { activeOrganizationId: 'default' },
            }),
        },
    },
}));

jest.mock('@/db', () => ({
    db: {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([
            { id: 1, name: 'Test Space', internalSpaceId: 'space-123' },
        ]),
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: 1 }]),
    },
}));

jest.mock('@/db/schema', () => ({
    sarvagyaSpaces: {},
    sarvagyaDocuments: {},
}));

jest.mock('@/lib/sarvagya/client', () => ({
    callSarvagya: jest.fn().mockResolvedValue({
        answer: 'Mock AI Answer',
        citations: [],
    }),
}));

jest.mock('@/lib/sarvagya/credits', () => ({
    checkSarvagyaCredits: jest.fn().mockResolvedValue(10),
    deductSarvagyaCredits: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/lib/queues', () => ({
    documentProcessingQueue: {
        add: jest.fn().mockResolvedValue(undefined),
    },
}));

// Mock next/headers (used by ../server.ts)
jest.mock('next/headers', () => ({
    headers: jest.fn().mockResolvedValue(new Map()),
    cookies: jest.fn(),
}));

// Mock the logger
jest.mock('@/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        child: jest.fn().mockReturnThis(),
    },
}));

import { sarvagyaRouter } from '@/lib/trpc/routers/sarvagya';
import * as creditsModule from '@/lib/sarvagya/credits';

// Using tRPC caller correctly for v11
describe('Sarvagya tRPC Router', () => {
    it('should execute a query and check/deduct credits', async () => {
        // For unit testing routers, tRPC v11 uses createCaller Factory method
        const caller = sarvagyaRouter.createCaller({
            userId: 'test-user-id',
            userRole: 'student',
            tenantId: 'default',
            req: {} as unknown,
            res: {} as unknown,
            sessionData: {} as unknown,
        });

        const spaces = await caller.spaces.list();
        expect(spaces).toBeDefined();
        expect(spaces.length).toBe(1);
        expect(spaces[0].name).toBe('Test Space');

        const response = await caller.query({
            spaceId: 1,
            message: 'Hello world',
        });

        expect(response).toBeDefined();
        expect(response.answer).toBe('Mock AI Answer');
        expect(creditsModule.checkSarvagyaCredits).toHaveBeenCalledWith(
            'test-user-id'
        );
        expect(creditsModule.deductSarvagyaCredits).toHaveBeenCalled();
    });
});
