/**
 * Jest Configuration specifically for Backend Evaluation and Golden Set Tests
 */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    },
    testTimeout: 60000,
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: 'tsconfig.json',
            isolatedModules: true
        }],
    },
    setupFiles: ['dotenv/config'],
    testMatch: [
        '<rootDir>/src/__tests__/evaluation/**/*.test.ts'
    ]
};
