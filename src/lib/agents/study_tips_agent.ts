/**
 * Study Tips Agent - Personalized Study Coach
 * Provides personalized study guidance with psychological support
 */

import { OpenAIService } from '../services/openai_service';
import { VectorStoreService } from '../services/vector_store_service';
import { buildLanguageDirective, type ResponseLanguage } from '../ai/language/resolve-language';

export interface StudyTipsRequest {
  grade_level: number;
  subject?: string;
  board_type: 'CBSE' | 'ICSE' | 'State Board';
  specific_area?: string;
  learning_style?: 'visual' | 'auditory' | 'kinesthetic' | 'mixed';
  challenges?: string[];
  study_environment?: string;
  conversation_history?: Array<{role: string, content: string}>;
}

export interface StudentProfile {
  grade_level: number;
  subject?: string;
  learning_style?: string;
  challenges?: string[];
  name?: string;
  study_goals?: string[];
  // Response language (defaults to the student's subscribed medium upstream)
  language?: ResponseLanguage;
}

export interface StudyGuidanceResponse {
  personalized_guidance: string;
  grade_appropriate: boolean;
  culturally_sensitive: boolean;
  psychologically_informed: boolean;
  actionable: boolean;
  study_techniques: string[];
  motivation_strategies: string[];
  time_management_tips: string[];
  stress_management_advice: string[];
}

export class StudyTipsRetrieval {
  private vectorService: VectorStoreService;

  constructor() {
    this.vectorService = new VectorStoreService();
  }

  async retrieve_study_tips(
    gradeLevel: number,
    specificArea?: string
  ): Promise<any> {
    console.log(`📚 Retrieving study tips for Class ${gradeLevel}${specificArea ? ` - ${specificArea}` : ''}`);
    
    try {
      // Search for study tips content in vector database
      let query = `study tips techniques Class ${gradeLevel}`;
      if (specificArea) {
        query += ` ${specificArea}`;
      }

      const tipsContent = await this.vectorService.search_relevant_content({
        query,
        grade_level: gradeLevel,
        subject: 'study_skills', // Special category for study tips
        board_type: 'CBSE', // General study tips applicable across boards
        limit: 10,
        content_types: ['tips', 'techniques', 'strategies', 'methods']
      });

      return tipsContent;
    } catch (error) {
      console.error('❌ Study Tips Retrieval Error:', error);
      return { results: [] }; // Return empty results as fallback
    }
  }
}

export class PersonalizedStudyCoach {
  private llmService: OpenAIService;
  private tipsRetrieval: StudyTipsRetrieval;

  constructor() {
    this.llmService = OpenAIService.getInstance();
    this.tipsRetrieval = new StudyTipsRetrieval();
  }

  async create_personalized_study_guidance(
    studentProfile: StudentProfile,
    studyChallenge?: string
  ): Promise<StudyGuidanceResponse> {
    console.log(`🧠 Creating personalized study guidance for Class ${studentProfile.grade_level}`);
    
    try {
      const gradeLevel = studentProfile.grade_level;
      const learningStyle = studentProfile.learning_style || 'mixed';
      const challenges = studentProfile.challenges || [];
      const studentName = studentProfile.name || 'beta';

      // Retrieve relevant study tips
      const tipsContent = await this.tipsRetrieval.retrieve_study_tips(
        gradeLevel,
        studyChallenge
      );

      // Build personalized study guidance prompt
      const prompt = this.buildStudyGuidancePrompt(
        studentProfile,
        studyChallenge,
        tipsContent,
        learningStyle,
        challenges,
        studentName
      );

      // Generate personalized guidance
      const response = await this.llmService.generateChatCompletion({
        messages: [
          {
            role: 'system',
            content: `${buildLanguageDirective(studentProfile.language || 'english')}\n\nYou are a supportive CBSE study coach for Class ${gradeLevel} ${studentProfile.subject || 'General'} students, targeting the "${this.determineCognitiveLevel(gradeLevel)}" cognitive level.`
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.6,
        maxTokens: 1500
      });

      // Extract structured information
      const structuredInfo = this.extractStructuredInfo(response.text);

      return {
        personalized_guidance: response.text,
        grade_appropriate: true,
        culturally_sensitive: true,
        psychologically_informed: true,
        actionable: true,
        ...structuredInfo
      };

    } catch (error) {
      console.error('❌ Study Guidance Error:', error);
      throw new Error(`Study guidance creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract textbook sources from context results for accurate citations
   */
  private extractTextbookSources(results: Record<string, unknown>[]): Array<{
    subject: string;
    class_level: string;
    chapter: string;
    page?: number;
  }> {
    if (!results || results.length === 0) {
      return [];
    }

    return results
      .filter(result => result.metadata)
      .map(result => ({
        // @ts-ignore
        subject: result.metadata.subject || 'General',
        // @ts-ignore
        class_level: result.metadata.class_level || 'Unknown',
        // @ts-ignore
        chapter: result.metadata.chapter || 'Unknown',
        // @ts-ignore
        page: result.metadata.page
      }))
      .filter((src, index, self) =>
        // Remove duplicates based on chapter
        index === self.findIndex(s => s.chapter === src.chapter)
      )
      .slice(0, 3); // Limit to top 3 sources
  }

  private buildStudyGuidancePrompt(
    studentProfile: StudentProfile,
    studyChallenge: string | undefined,
    tipsContent: Record<string, unknown>,
    learningStyle: string,
    challenges: string[],
    studentName: string
  ): string {
        // @ts-ignore
    const contextText = this.formatStudyTipsContent(tipsContent.results || []);
        // @ts-ignore
    const textbookSources = this.extractTextbookSources(tipsContent.results || []);
    
    return `You are a caring, experienced study coach and educational psychologist helping an Indian student develop better study habits.

**Student Profile:**
- Name: ${studentName}
- Grade Level: Class ${studentProfile.grade_level}
- Subject Focus: ${studentProfile.subject || 'General studies'}
- Learning Style: ${learningStyle}
- Current Challenges: ${challenges.length > 0 ? challenges.join(', ') : 'General study improvement'}
- Specific Area for Help: ${studyChallenge || 'Overall study effectiveness'}

**Study Tips from Educational Resources:**
${contextText}

**TEXTBOOK CITATIONS (IF APPLICABLE):**
${textbookSources.length > 0 ? `
Available textbook sources for reference:
${textbookSources.map((src, idx) => `${idx + 1}. ${src.subject} - ${src.class_level}, Chapter ${src.chapter}${src.page ? `, Page ${src.page}` : ''}`).join('\n')}

**CITATION FORMAT (when referencing specific study techniques from textbooks):**
If you reference specific study techniques or methods from textbooks, cite them as:

📚 **Reference:** NCERT Class ${studentProfile.grade_level} ${studentProfile.subject || 'Study Skills'}, Chapter [number]: [chapter name], Page(s) [number(s)]

**Note:** Most study tips will be based on general educational psychology and pedagogy, not specific textbook pages. Only cite when directly referencing textbook content.
` : `
**Note:** Study guidance will be based on general educational psychology and proven study techniques.
`}

Create personalized study guidance with this structure:

## 🤗 **नमस्ते ${studentName}! आपका व्यक्तिगत अध्ययन मार्गदर्शक (Your Personal Study Guide)**

### 1. **गर्मजोशी से स्वागत (Warm Personal Greeting)**
- Address ${studentName} warmly and personally
- Acknowledge their desire to improve their study habits
- Create a supportive, encouraging atmosphere
- Use phrases like "मुझे खुशी है कि आप बेहतर बनना चाहते हैं" (I'm happy you want to improve)

### 2. **आपकी सीखने की शैली को समझना (Understanding Your Learning Style)**
Based on their ${learningStyle} learning style:
- Explain what ${learningStyle} learning means in simple terms
- How to leverage their natural strengths
- Specific techniques that work best for ${learningStyle} learners
- Examples relevant to Class ${studentProfile.grade_level} students

### 3. **कक्षा ${studentProfile.grade_level} के लिए उपयुक्त अध्ययन तकनीकें (Grade-Appropriate Study Techniques)**
For Class ${studentProfile.grade_level} students, recommend:
- **Daily study routines** suitable for their age and attention span
- **Time management techniques** they can realistically follow
- **Organization methods** that work for their developmental stage
- **Subject-specific strategies** for their current curriculum

### 4. **आपकी चुनौतियों का समाधान (Addressing Your Specific Challenges)**
${challenges.length > 0 ? `For each challenge (${challenges.join(', ')}):` : 'For common study challenges:'}
- Validate that it's completely normal to face these challenges
- Provide 2-3 specific, actionable strategies to overcome each one
- Include both immediate solutions and long-term habit building
- Share success stories of other students who overcame similar challenges

### 5. **भारतीय छात्र का अध्ययन वातावरण (The Indian Student's Study Environment)**
Practical guidance on:
- **Creating productive study spaces** in typical Indian homes
- **Managing family time vs study time** respectfully
- **Using cultural strengths** like respect for education and family support
- **Handling academic pressure** positively and healthily
- **Balancing studies with festivals and family obligations**

### 6. **स्मृति और धारणा तकनीकें (Memory and Retention Techniques)**
Age-appropriate methods for Class ${studentProfile.grade_level}:
- **Mnemonics** suitable for their grade level and subjects
- **Review schedules** they can realistically maintain
- **Connection techniques** for better understanding
- **Visual aids and mind maps** for complex topics
- **Story-based learning** using Indian cultural references

### 7. **मानसिक स्वास्थ्य और कल्याण (Psychological Well-being)**
Include guidance on:
- **Managing study stress** without overwhelming themselves
- **Maintaining motivation** during difficult periods
- **Building confidence** through small, achievable wins
- **The importance of rest and play** for effective learning
- **Dealing with comparison** with classmates positively

### 8. **प्रौद्योगिकी और अध्ययन उपकरण (Technology and Study Tools)**
Appropriate for Class ${studentProfile.grade_level}:
- **How to use technology wisely** for studying
- **Avoiding digital distractions** while maintaining focus
- **Digital vs traditional study methods** - when to use each
- **Educational apps and resources** suitable for their age
- **Screen time management** for healthy study habits

### 9. **दीर्घकालिक आदतें बनाना (Building Long-term Habits)**
- **Small, manageable changes** to start with immediately
- **How to track progress** without becoming obsessive
- **Celebrating improvements** and maintaining motivation
- **Gradual habit stacking** for sustainable change
- **Recovery strategies** when they slip up (which is normal!)

### 10. **प्रोत्साहन और समर्थन (Encouragement and Support)**
- Remind them that good study habits take time to develop
- Encourage patience and self-compassion
- Provide motivational thoughts rooted in Indian culture and values
- Share wisdom from great Indian scholars and leaders
- End with confidence-building affirmations

**Writing Style Guidelines:**
- Warm, encouraging, and supportive like a caring mentor
- Use simple, clear language appropriate for Class ${studentProfile.grade_level}
- Include encouraging Hindi phrases naturally throughout
- Make them feel capable, supported, and understood
- Provide practical advice they can actually implement
- Balance high expectations with realistic goals
- Show understanding of Indian family dynamics and cultural context

**Cultural Integration:**
- Use Indian examples and contexts naturally
- Reference Indian festivals, traditions, and values
- Include wisdom from Indian philosophy and great thinkers
- Respect for family and cultural obligations
- Balance individual achievement with community values

**Psychological Principles:**
- Build intrinsic motivation rather than just external rewards
- Focus on growth mindset and learning from mistakes
- Encourage self-reflection and metacognition
- Support emotional regulation and stress management
- Foster independence while respecting cultural interdependence

Remember: The goal is to build sustainable study habits that reduce stress while improving learning effectiveness, all while honoring their Indian cultural context and family values.`;
  }

  private formatStudyTipsContent(results: Record<string, unknown>[]): string {
    if (results.length === 0) {
      return "General study principles and best practices will be applied.";
    }

    let formatted = "Educational Research and Best Practices:\n\n";
    results.forEach((result, index) => {
        // @ts-ignore
      formatted += `${index + 1}. ${result.text?.substring(0, 200) || 'Study technique'}...\n\n`;
    });
    
    return formatted;
  }

  private determineCognitiveLevel(gradeLevel: number): string {
    if (gradeLevel <= 3)
  return "remember_understand";
    if (gradeLevel <= 6)
  return "understand_apply";
    if (gradeLevel <= 8)
  return "apply_analyze";
    if (gradeLevel <= 10)
  return "analyze_evaluate";
    return "evaluate_create";
  }

  private extractStructuredInfo(responseText: string): {
    study_techniques: string[];
    motivation_strategies: string[];
    time_management_tips: string[];
    stress_management_advice: string[];
  } {
    // Extract structured information from the response
    const studyTechniques = this.extractSection(responseText, ['study techniques', 'अध्ययन तकनीकें', 'techniques']);
    const motivationStrategies = this.extractSection(responseText, ['motivation', 'प्रेरणा', 'encouragement']);
    const timeManagement = this.extractSection(responseText, ['time management', 'समय प्रबंधन', 'schedule']);
    const stressManagement = this.extractSection(responseText, ['stress', 'तनाव', 'well-being', 'स्वास्थ्य']);

    return {
      study_techniques: studyTechniques,
      motivation_strategies: motivationStrategies,
      time_management_tips: timeManagement,
      stress_management_advice: stressManagement
    };
  }

  private extractSection(text: string, keywords: string[]): string[] {
    const sections: string[] = [];
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (keywords.some(keyword => line.includes(keyword))) {
        // Extract next few lines as section content
        for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
          const nextLine = lines[j].trim();
          if (nextLine && nextLine.startsWith('-') && nextLine.length > 15) {
            sections.push(nextLine.substring(1).trim());
          } else if (nextLine && nextLine.startsWith('•') && nextLine.length > 15) {
            sections.push(nextLine.substring(1).trim());
          }
        }
        break;
      }
    }
    
    return sections.slice(0, 5); // Limit to 5 items per section
  }
}

export class StudyTipsAgent {
  private studyCoach: PersonalizedStudyCoach;

  constructor() {
    this.studyCoach = new PersonalizedStudyCoach();
  }

  async provide_study_guidance(
    studentContext: {
      grade_level: number;
      subject?: string;
      board_type: 'CBSE' | 'ICSE' | 'State Board';
      name?: string;
      learning_style?: 'visual' | 'auditory' | 'kinesthetic' | 'mixed';
      challenges?: string[];
    },
    specificArea?: string
  ): Promise<StudyGuidanceResponse> {
    console.log(`🧠 Study Tips Request for Class ${studentContext.grade_level}${specificArea ? ` - ${specificArea}` : ''}`);
    
    const studentProfile: StudentProfile = {
      grade_level: studentContext.grade_level,
      subject: studentContext.subject,
      learning_style: studentContext.learning_style || 'mixed',
      challenges: studentContext.challenges || [],
      name: studentContext.name || 'beta'
    };

    return await this.studyCoach.create_personalized_study_guidance(
      studentProfile,
      specificArea
    );
  }
}
