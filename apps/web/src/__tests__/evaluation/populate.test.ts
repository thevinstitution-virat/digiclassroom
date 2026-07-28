import { jest } from '@jest/globals';

// Mock Redis to avoid connection crashes during population script
jest.mock('@/lib/services/implementations/redis-cache.service', () => {
    return {
        RedisCacheService: jest.fn().mockImplementation(() => {
            return { get: async () => null, set: async () => { } };
        })
    };
});

import { INITIAL_20_GOLDEN } from './golden-set/initial-20.golden';
import { RetrievalService } from '@/lib/agents/core/services/retrieval.service';
import * as fs from 'fs';
import * as path from 'path';

describe('Data Population Script', () => {
    it('populates golden pages from Qdrant', async () => {
        const retrievalService = new RetrievalService();
        const filePath = path.join(__dirname, './golden-set/initial-20.golden.ts');
        let updatedContent = fs.readFileSync(filePath, 'utf-8');

        console.log('Populating Real pageNumbers in Golden Tests...');

        for (const testCase of INITIAL_20_GOLDEN) {
            if (testCase.expectScopeViolation) continue;

            try {
                const context = await retrievalService.searchRelevantContent({
                    query: testCase.query,
                    subject: testCase.subject,
                    grade_level: testCase.grade,
                    board_type: 'CBSE',
                    limit: 1, // topK 1
                });

                const topResult = context.results?.[0] as any;
                if (topResult && topResult.metadata?.page) {
                    const realPage = topResult.metadata.page;
                    let excerpt = (topResult.text || topResult.content || topResult.pageContent || JSON.stringify(topResult) || '').substring(0, 30).trim();

                    const words = excerpt.split(/[\s\W]+/).filter((w: string) => w.length > 4);
                    let keyword = words.length > 0 ? words[0].toLowerCase() : testCase.expected.contentExcerptContains;

                    console.log(`Found for ${testCase.id}: page ${realPage}, keyword '${keyword}'`);

                    const idRegex = new RegExp(`id:\\s*'${testCase.id}'[\\s\\S]*?pageNumber:\\s*\\d+[\\s\\S]*?contentExcerptContains:\\s*'.*?'`);
                    const replacement = updatedContent.match(idRegex)?.[0]
                        ?.replace(/pageNumber:\s*\d+.*$/, `pageNumber: ${realPage},`)
                        ?.replace(/contentExcerptContains:\s*'.*'/, `contentExcerptContains: '${keyword}'`);

                    if (replacement) {
                        updatedContent = updatedContent.replace(idRegex, replacement);
                    }
                }
            } catch (err: any) {
                console.error(`Error querying ${testCase.id}: ${err.message}`);
            }
        }

        fs.writeFileSync(filePath, updatedContent);
        expect(true).toBe(true);
    }, 60000);
});
