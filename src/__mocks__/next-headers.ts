// Mock for next/headers — Jest can't resolve server-only Next.js APIs
export const cookies = jest.fn(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    has: jest.fn(),
    getAll: jest.fn(() => []),
}));

export const headers = jest.fn(() => ({
    get: jest.fn(),
    has: jest.fn(),
    entries: jest.fn(() => []),
    forEach: jest.fn(),
}));
