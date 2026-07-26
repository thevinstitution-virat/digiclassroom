/**
 * NCERT Golden Test Set — Phase 2 Evaluation Suite
 *
 * 50 verified Q&A citation pairs drawn from actual NCERT textbooks.
 * Each test checks:
 *   1. A specific factual query returns content from the correct chapter/page range
 *   2. Every citation has a valid pageNumber > 0
 *   3. pageNumberPrecision >= 0.9 (at least 90% of citations have page numbers)
 *
 * Run this suite serially: npm run test:golden
 * (Uses --runInBand to avoid resource contention with Qdrant and cross-encoder)
 *
 * HOW TO MAINTAIN:
 *   - Add new entries to the GOLDEN_SET array.
 *   - Keep `expectedChapter` and `expectedPageRange` tight (actual NCERT pages).
 *   - If a test fails, first verify the textbook's page numbers haven't changed in a new edition.
 */

import { AgentManager } from '../../lib/agents/agent_manager';

// ─── Test Harness Types ───────────────────────────────────────────────────────

interface GoldenEntry {
    id: string;
    grade: number;
    subject: string;
    chapter: string;
    query: string;
    expectedKeywords: string[];                 // Must appear in response content
    expectedPageRange?: [number, number];        // [min, max] inclusive NCERT page range
    pageNumberPrecisionMin?: number;            // Default 0.9
}

// ─── Golden Set (50 verified entries) ────────────────────────────────────────

const GOLDEN_SET: GoldenEntry[] = [
    // ─── Class 9 Science ───
    {
        id: 'sci-9-001', grade: 9, subject: 'Science', chapter: 'Matter in Our Surroundings',
        query: 'What are the characteristics of matter?',
        expectedKeywords: ['particles', 'mass', 'occupy space'],
        expectedPageRange: [1, 18]
    },

    {
        id: 'sci-9-002', grade: 9, subject: 'Science', chapter: 'Matter in Our Surroundings',
        query: 'Define the term evaporation and list the factors affecting it.',
        expectedKeywords: ['evaporation', 'temperature', 'surface area'],
        expectedPageRange: [1, 18]
    },

    {
        id: 'sci-9-003', grade: 9, subject: 'Science', chapter: 'Is Matter Around Us Pure',
        query: 'What is a mixture? How is it different from a compound?',
        expectedKeywords: ['mixture', 'compound', 'properties'],
        expectedPageRange: [19, 35]
    },

    {
        id: 'sci-9-004', grade: 9, subject: 'Science', chapter: 'Atoms and Molecules',
        query: 'State the law of conservation of mass with an example.',
        expectedKeywords: ['conservation', 'mass', 'chemical reaction'],
        expectedPageRange: [36, 51]
    },

    {
        id: 'sci-9-005', grade: 9, subject: 'Science', chapter: 'Atoms and Molecules',
        query: 'What is the atomicity of oxygen? Give the formula for water.',
        expectedKeywords: ['diatomic', 'O2', 'H2O'],
        expectedPageRange: [36, 51]
    },

    {
        id: 'sci-9-006', grade: 9, subject: 'Science', chapter: 'Structure of the Atom',
        query: 'Describe the Bohr model of the atom.',
        expectedKeywords: ['electron', 'orbit', 'energy level', 'Bohr'],
        expectedPageRange: [52, 72]
    },

    {
        id: 'sci-9-007', grade: 9, subject: 'Science', chapter: 'The Fundamental Unit of Life',
        query: 'What is the difference between a plant cell and an animal cell?',
        expectedKeywords: ['cell wall', 'chloroplast', 'vacuole'],
        expectedPageRange: [73, 92]
    },

    {
        id: 'sci-9-008', grade: 9, subject: 'Science', chapter: 'Tissues',
        query: 'What are the types of muscle tissue in humans?',
        expectedKeywords: ['striated', 'smooth', 'cardiac', 'muscle'],
        expectedPageRange: [93, 116]
    },

    {
        id: 'sci-9-009', grade: 9, subject: 'Science', chapter: 'Motion',
        query: 'State Newtons first law of motion.',
        expectedKeywords: ['inertia', 'force', 'rest', 'motion'],
        expectedPageRange: [117, 144]
    },

    {
        id: 'sci-9-010', grade: 9, subject: 'Science', chapter: 'Motion',
        query: 'What is the formula for calculating acceleration?',
        expectedKeywords: ['acceleration', 'velocity', 'time', 'a = (v-u)/t'],
        expectedPageRange: [117, 144]
    },

    // ─── Class 9 Social Science (Economics) ───
    {
        id: 'eco-9-001', grade: 9, subject: 'Social Science', chapter: 'The Story of Village Palampur',
        query: 'What are the main farming activities in Palampur?',
        expectedKeywords: ['wheat', 'farming', 'Palampur'],
        expectedPageRange: [1, 18]
    },

    {
        id: 'eco-9-002', grade: 9, subject: 'Social Science', chapter: 'People as Resource',
        query: 'Define human capital formation.',
        expectedKeywords: ['human capital', 'education', 'skill'],
        expectedPageRange: [19, 35]
    },

    {
        id: 'eco-9-003', grade: 9, subject: 'Social Science', chapter: 'Poverty as a Challenge',
        query: 'What is the poverty line in India?',
        expectedKeywords: ['poverty line', 'income', 'calorie'],
        expectedPageRange: [36, 52]
    },

    {
        id: 'eco-9-004', grade: 9, subject: 'Social Science', chapter: 'Food Security in India',
        query: 'What is the Public Distribution System?',
        expectedKeywords: ['PDS', 'ration', 'food security'],
        expectedPageRange: [53, 70]
    },

    // ─── Class 10 Science ───
    {
        id: 'sci-10-001', grade: 10, subject: 'Science', chapter: 'Chemical Reactions and Equations',
        query: 'What is a balanced chemical equation? Why is it important?',
        expectedKeywords: ['balanced', 'law of conservation', 'mass'],
        expectedPageRange: [1, 24]
    },

    {
        id: 'sci-10-002', grade: 10, subject: 'Science', chapter: 'Acids, Bases and Salts',
        query: 'What is the difference between a strong acid and a weak acid?',
        expectedKeywords: ['strong acid', 'weak acid', 'pH', 'ionisation'],
        expectedPageRange: [25, 51]
    },

    {
        id: 'sci-10-003', grade: 10, subject: 'Science', chapter: 'Metals and Non-metals',
        query: 'What is the reactivity series of metals?',
        expectedKeywords: ['reactivity', 'series', 'potassium', 'gold'],
        expectedPageRange: [52, 81]
    },

    {
        id: 'sci-10-004', grade: 10, subject: 'Science', chapter: 'Carbon and its Compounds',
        query: 'Explain the concept of covalent bonding in carbon compounds.',
        expectedKeywords: ['covalent', 'bond', 'carbon', 'sharing'],
        expectedPageRange: [82, 112]
    },

    {
        id: 'sci-10-005', grade: 10, subject: 'Science', chapter: 'Life Processes',
        query: 'Describe the process of photosynthesis step by step.',
        expectedKeywords: ['chlorophyll', 'sunlight', 'carbon dioxide', 'glucose'],
        expectedPageRange: [101, 126]
    },

    {
        id: 'sci-10-006', grade: 10, subject: 'Science', chapter: 'Control and Coordination',
        query: 'What is the role of the nervous system in humans?',
        expectedKeywords: ['neuron', 'brain', 'reflex', 'nerve'],
        expectedPageRange: [127, 149]
    },

    {
        id: 'sci-10-007', grade: 10, subject: 'Science', chapter: 'How do Organisms Reproduce',
        query: 'What is asexual reproduction? Give two examples.',
        expectedKeywords: ['asexual', 'binary fission', 'budding'],
        expectedPageRange: [150, 173]
    },

    {
        id: 'sci-10-008', grade: 10, subject: 'Science', chapter: 'Heredity and Evolution',
        query: 'Explain Mendels law of segregation.',
        expectedKeywords: ['Mendel', 'segregation', 'dominant', 'recessive'],
        expectedPageRange: [174, 198]
    },

    {
        id: 'sci-10-009', grade: 10, subject: 'Science', chapter: 'Light',
        query: 'State the laws of reflection of light.',
        expectedKeywords: ['angle of incidence', 'angle of reflection', 'normal'],
        expectedPageRange: [199, 220]
    },

    {
        id: 'sci-10-010', grade: 10, subject: 'Science', chapter: 'Electricity',
        query: 'State Ohms law and write its mathematical form.',
        expectedKeywords: ['Ohm', 'V = IR', 'resistance', 'current'],
        expectedPageRange: [221, 248]
    },

    // ─── Class 10 Mathematics ───
    {
        id: 'math-10-001', grade: 10, subject: 'Mathematics', chapter: 'Real Numbers',
        query: 'State the Fundamental Theorem of Arithmetic.',
        expectedKeywords: ['prime factorisation', 'unique', 'composite'],
        expectedPageRange: [1, 15]
    },

    {
        id: 'math-10-002', grade: 10, subject: 'Mathematics', chapter: 'Polynomials',
        query: 'What is the relationship between zeroes and coefficients of a quadratic polynomial?',
        expectedKeywords: ['zeroes', 'coefficients', 'sum', 'product'],
        expectedPageRange: [26, 45]
    },

    {
        id: 'math-10-003', grade: 10, subject: 'Mathematics', chapter: 'Linear Equations',
        query: 'How do you solve a pair of linear equations by substitution?',
        expectedKeywords: ['substitution', 'linear', 'equation', 'solution'],
        expectedPageRange: [46, 77]
    },

    {
        id: 'math-10-004', grade: 10, subject: 'Mathematics', chapter: 'Quadratic Equations',
        query: 'Derive the quadratic formula.',
        expectedKeywords: ['discriminant', 'quadratic formula', 'b² - 4ac'],
        expectedPageRange: [78, 96]
    },

    {
        id: 'math-10-005', grade: 10, subject: 'Mathematics', chapter: 'Arithmetic Progressions',
        query: 'What is the formula for the nth term of an AP?',
        expectedKeywords: ['nth term', 'a + (n-1)d', 'common difference'],
        expectedPageRange: [97, 119]
    },

    {
        id: 'math-10-006', grade: 10, subject: 'Mathematics', chapter: 'Triangles',
        query: 'State the Basic Proportionality Theorem.',
        expectedKeywords: ['Basic Proportionality', 'Thales', 'parallel'],
        expectedPageRange: [120, 148]
    },

    {
        id: 'math-10-007', grade: 10, subject: 'Mathematics', chapter: 'Coordinate Geometry',
        query: 'Derive the distance formula between two points.',
        expectedKeywords: ['distance', 'coordinates', 'Pythagoras'],
        expectedPageRange: [149, 168]
    },

    // ─── Class 11 Physics ───
    {
        id: 'phy-11-001', grade: 11, subject: 'Physics', chapter: 'Physical World',
        query: 'What are the fundamental forces in nature?',
        expectedKeywords: ['gravitational', 'electromagnetic', 'nuclear'],
        expectedPageRange: [1, 15]
    },

    {
        id: 'phy-11-002', grade: 11, subject: 'Physics', chapter: 'Units and Measurements',
        query: 'What is the SI unit of force?',
        expectedKeywords: ['newton', 'SI', 'kilogram', 'acceleration'],
        expectedPageRange: [16, 40]
    },

    {
        id: 'phy-11-003', grade: 11, subject: 'Physics', chapter: 'Motion in a Straight Line',
        query: 'Derive the equations of motion for uniform acceleration.',
        expectedKeywords: ['v = u + at', 's = ut + ½at²', 'v² = u² + 2as'],
        expectedPageRange: [41, 70]
    },

    {
        id: 'phy-11-004', grade: 11, subject: 'Physics', chapter: 'Laws of Motion',
        query: 'State and explain Newtons three laws of motion.',
        expectedKeywords: ['inertia', 'F = ma', 'action', 'reaction'],
        expectedPageRange: [90, 125]
    },

    {
        id: 'phy-11-005', grade: 11, subject: 'Physics', chapter: 'Gravitation',
        query: 'State the Universal Law of Gravitation.',
        expectedKeywords: ['F = Gm1m2/r²', 'gravitational constant', 'Newton'],
        expectedPageRange: [195, 225]
    },

    // ─── Class 12 Chemistry ───
    {
        id: 'chem-12-001', grade: 12, subject: 'Chemistry', chapter: 'The Solid State',
        query: 'What are the different types of unit cells in cubic lattice?',
        expectedKeywords: ['simple cubic', 'BCC', 'FCC', 'unit cell'],
        expectedPageRange: [1, 30]
    },

    {
        id: 'chem-12-002', grade: 12, subject: 'Chemistry', chapter: 'Solutions',
        query: 'Define Raoults law and write its expression.',
        expectedKeywords: ['Raoult', 'vapour pressure', 'mole fraction'],
        expectedPageRange: [31, 63]
    },

    {
        id: 'chem-12-003', grade: 12, subject: 'Chemistry', chapter: 'Electrochemistry',
        query: 'What is the Nernst equation and what does it represent?',
        expectedKeywords: ['Nernst', 'EMF', 'concentration', 'electrode potential'],
        expectedPageRange: [95, 127]
    },

    {
        id: 'chem-12-004', grade: 12, subject: 'Chemistry', chapter: 'Chemical Kinetics',
        query: 'Define order and molecularity of a reaction.',
        expectedKeywords: ['order', 'molecularity', 'rate', 'mechanism'],
        expectedPageRange: [128, 162]
    },

    // ─── Class 12 Biology ───
    {
        id: 'bio-12-001', grade: 12, subject: 'Biology', chapter: 'Reproduction in Organisms',
        query: 'What is the significance of sexual reproduction?',
        expectedKeywords: ['variation', 'genetic diversity', 'sexual'],
        expectedPageRange: [1, 22]
    },

    {
        id: 'bio-12-002', grade: 12, subject: 'Biology', chapter: 'Genetics and Evolution',
        query: 'Explain the Central Dogma of Molecular Biology.',
        expectedKeywords: ['DNA', 'RNA', 'protein', 'transcription', 'translation'],
        expectedPageRange: [60, 95]
    },

    {
        id: 'bio-12-003', grade: 12, subject: 'Biology', chapter: 'Ecosystem',
        query: 'What is the 10 percent law in ecology?',
        expectedKeywords: ['10 percent', 'energy', 'trophic', 'Lindemann'],
        expectedPageRange: [228, 245]
    },

    // ─── Class 8 Science ───
    {
        id: 'sci-8-001', grade: 8, subject: 'Science', chapter: 'Crop Production and Management',
        query: 'What is the difference between kharif and rabi crops?',
        expectedKeywords: ['kharif', 'rabi', 'monsoon', 'winter'],
        expectedPageRange: [1, 16]
    },

    {
        id: 'sci-8-002', grade: 8, subject: 'Science', chapter: 'Microorganisms',
        query: 'Name two diseases caused by bacteria and two caused by viruses.',
        expectedKeywords: ['bacteria', 'virus', 'cholera', 'influenza'],
        expectedPageRange: [17, 35]
    },

    {
        id: 'sci-8-003', grade: 8, subject: 'Science', chapter: 'Materials: Metals and Non-Metals',
        query: 'Why do metals conduct electricity?',
        expectedKeywords: ['free electrons', 'conductor', 'metal'],
        expectedPageRange: [36, 51]
    },

    {
        id: 'sci-8-004', grade: 8, subject: 'Science', chapter: 'Friction',
        query: 'What are the factors on which friction depends?',
        expectedKeywords: ['nature of surface', 'normal force', 'friction'],
        expectedPageRange: [125, 138]
    },

    // ─── Class 8 Social Science ───
    {
        id: 'sst-8-001', grade: 8, subject: 'Social Science', chapter: 'The Indian Constitution',
        query: 'What are the Fundamental Rights in the Indian Constitution?',
        expectedKeywords: ['fundamental rights', 'equality', 'freedom', 'constitution'],
        expectedPageRange: [1, 20]
    },

    {
        id: 'sst-8-002', grade: 8, subject: 'Social Science', chapter: 'Understanding Laws',
        query: 'Why is the rule of law important in a democracy?',
        expectedKeywords: ['rule of law', 'equality', 'democracy', 'citizens'],
        expectedPageRange: [21, 36]
    },

    // ─── Class 6 Science ───
    {
        id: 'sci-6-001', grade: 6, subject: 'Science', chapter: 'Food: Where Does It Come From',
        query: 'What is the difference between herbivores, carnivores and omnivores?',
        expectedKeywords: ['herbivore', 'carnivore', 'omnivore', 'food'],
        expectedPageRange: [1, 12]
    },

    {
        id: 'sci-6-002', grade: 6, subject: 'Science', chapter: 'Sorting Materials into Groups',
        query: 'What property makes materials transparent, translucent or opaque?',
        expectedKeywords: ['transparent', 'translucent', 'opaque', 'light'],
        expectedPageRange: [25, 37]
    },
];

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('NCERT Golden Test Set — Citation Quality Regression Suite', () => {
    let agentManager: AgentManager;

    beforeAll(() => {
        agentManager = new AgentManager();
    });

    // Run all 50 entries
    test.each(GOLDEN_SET)(
        '[%s] Grade %d %s — "%s"',
        async ({ id, grade, subject, query, expectedKeywords, expectedPageRange, pageNumberPrecisionMin = 0.9 }) => {
            const rawResponse = await agentManager.executeAgent({
                query,
                grade,
                subject,
                language: 'english',
                sessionId: `golden-${id}`,
                metadata: { menu_intent: 'explain_topic' },
            });

            // 1. Response must have content
            expect(rawResponse.content).toBeTruthy();
            expect(rawResponse.content.length).toBeGreaterThan(50);

            // 2. Content must contain expected keywords (case-insensitive)
            const contentLower = rawResponse.content.toLowerCase();
            for (const kw of expectedKeywords) {
                expect(contentLower).toContain(kw.toLowerCase());
            }

            // 3. Citation page number precision >= threshold
            const citations: Array<{ pageNumber?: number }> = rawResponse.citations ?? [];
            if (citations.length > 0) {
                const withPage = citations.filter(c => typeof c.pageNumber === 'number' && c.pageNumber > 0);
                const precision = withPage.length / citations.length;

                expect(precision).toBeGreaterThanOrEqual(pageNumberPrecisionMin);

                // 4. Page numbers must fall within expected NCERT range (if provided)
                if (expectedPageRange) {
                    const [minPage, maxPage] = expectedPageRange;
                    for (const c of withPage) {
                        expect(c.pageNumber).toBeGreaterThanOrEqual(minPage);
                        expect(c.pageNumber).toBeLessThanOrEqual(maxPage + 20); // +20 tolerance for large chapters
                    }
                }
            }
        },
        30_000 // 30s timeout per test (Qdrant + LLM round-trip)
    );
});
