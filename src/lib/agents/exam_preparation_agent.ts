/**
 * Exam Preparation Agent - Strategic Study Planner
 * Creates comprehensive exam preparation strategies with Indian cultural context
 */

import { OpenAIService } from '../services/openai_service';
import { VectorStoreService } from '../services/vector_store_service';
import { buildLanguageDirective, type ResponseLanguage } from '../ai/language/resolve-language';

export interface ExamStrategyRequest {
  chapters: string[];
  grade_level: number;
  subject: string;
  board_type: 'CBSE' | 'ICSE' | 'State Board';
  exam_type?: 'regular' | 'board' | 'competitive' | 'unit_test';
  time_available?: number; // days
  student_strengths?: string[];
  student_weaknesses?: string[];
  conversation_history?: Array<{role: string, content: string}>;
  // Response language (defaults to the student's subscribed medium upstream)
  language?: ResponseLanguage;
}

export interface StudyPlan {
  study_plan: string;
  chapters_covered: string[];
  timeline: number;
  personalized: boolean;
  cultural_context_used: boolean;
  priority_matrix: {
    high_priority: string[];
    medium_priority: string[];
    low_priority: string[];
  };
  daily_schedule: {
    morning: string;
    afternoon: string;
    evening: string;
  };
  stress_management_tips: string[];
}

export class ExamStrategyTool {
  private llmService: OpenAIService;
  private vectorService: VectorStoreService;

  constructor() {
    this.llmService = OpenAIService.getInstance();
    this.vectorService = new VectorStoreService();
  }

  async create_comprehensive_exam_plan(request: ExamStrategyRequest): Promise<StudyPlan> {
    console.log(`📚 Creating Exam Strategy: ${request.subject} for Class ${request.grade_level}`);
    
    try {
      // Get content for all chapters
      const allContent = [];
      for (const chapter of request.chapters) {
        const content = await this.vectorService.search_relevant_content({
          query: chapter,
          grade_level: request.grade_level,
          subject: request.subject,
          board_type: request.board_type,
          limit: 12
        });
        allContent.push({ chapter, content: content.results });
      }

      const timeAvailable = request.time_available || 30;
      const examType = request.exam_type || 'regular';

      // Build comprehensive exam strategy prompt
      const prompt = this.buildExamStrategyPrompt(request, allContent, timeAvailable, examType);
      
      // Generate exam strategy
      const response = await this.llmService.generateChatCompletion({
        messages: [
          {
            role: 'system',
            content: `${buildLanguageDirective(request.language || 'english')}\n\nYou are an expert ${request.board_type} exam-preparation coach for Class ${request.grade_level} ${request.subject}. Use Indian cultural context and target the "${this.determineCognitiveLevel(request.grade_level)}" cognitive level.`
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        maxTokens: 2000
      });

      // Extract structured information
      const structuredPlan = this.extractStructuredPlan(response.text, request);

      return {
        study_plan: response.text,
        chapters_covered: request.chapters,
        timeline: timeAvailable,
        personalized: true,
        cultural_context_used: true,
        ...structuredPlan
      };

    } catch (error) {
      console.error('❌ Exam Strategy Error:', error);
      throw new Error(`Exam strategy creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract textbook sources from context results for accurate citations
   */
  private extractTextbookSources(allContent: Record<string, unknown>[]): Array<{
    subject: string;
    class_level: string;
    chapter: string;
    page?: number;
  }> {
    const sources: Array<{
      subject: string;
      class_level: string;
      chapter: string;
      page?: number;
    }> = [];

    for (const item of allContent) {
        // @ts-ignore
      if (item.content && item.content.length > 0) {
        // @ts-ignore
        for (const result of item.content) {
          if (result.metadata) {
            sources.push({
              subject: result.metadata.subject || 'General',
              class_level: result.metadata.class_level || 'Unknown',
              chapter: result.metadata.chapter || item.chapter,
              page: result.metadata.page
            });
          }
        }
      }
    }

    // Remove duplicates based on chapter
    return sources
      .filter((src, index, self) =>
        index === self.findIndex(s => s.chapter === src.chapter)
      )
      .slice(0, 5); // Limit to top 5 sources
  }

  private buildExamStrategyPrompt(
    request: ExamStrategyRequest,
    allContent: Record<string, unknown>[],
    timeAvailable: number,
    examType: string
  ): string {
    const chaptersInfo = allContent.map(item => {
      const chunks = (item.content as any[]) || [];
      return `**${item.chapter}**:\n${chunks.length > 0 ? chunks.map((c: any) => c.text).join('\n\n') : 'Content available'}`;
    }).join('\n\n');
    const conversationHistory = this.formatConversationHistory(request.conversation_history || []);
    const textbookSources = this.extractTextbookSources(allContent);

    return `Create a comprehensive exam preparation strategy for a Class ${request.grade_level} student preparing for ${request.subject} ${examType} exam.

**CONVERSATIONAL CONTEXT AWARENESS:**
- Review the conversation history below to understand what has already been discussed
- Build on previous study plans or recommendations
- If the student asks for modifications, adjust the existing plan rather than creating a new one
- Recognize follow-up questions about specific chapters or study techniques

${conversationHistory}

**Student Context:**
- Subject: ${request.subject}
- Board: ${request.board_type}
- Chapters: ${request.chapters.join(', ')}
- Exam Type: ${examType}
- Preparation Time: ${timeAvailable} days
- Student Strengths: ${request.student_strengths?.join(', ') || 'To be assessed'}
- Student Weaknesses: ${request.student_weaknesses?.join(', ') || 'To be assessed'}

**Available Chapter Content:**
${chaptersInfo}

**TEXTBOOK CITATIONS (CRITICAL REQUIREMENT):**
${textbookSources.length > 0 ? `
Available textbook sources for accurate citation:
${textbookSources.map((src, idx) => `${idx + 1}. ${src.subject} - ${src.class_level}, Chapter ${src.chapter}${src.page ? `, Page ${src.page}` : ''}`).join('\n')}

**MANDATORY CITATION FORMAT:**
When referencing specific chapters or topics, include textbook citations in this format:

📚 **Key References:**
- Chapter [number]: [chapter name] (Pages [number(s)])
- Chapter [number]: [chapter name] (Pages [number(s)])

**Citation Requirements:**
- Include SPECIFIC chapter numbers and chapter names
- Include SPECIFIC page numbers or ranges (e.g., "pages 13-15" or "page 14")
- Place citations in the chapter-wise analysis section
- The citations should be accurate and verifiable
- Use the sources from the list above

**Example of Good Citation:**
📚 **Key References:**
- Chapter 2: Physical Features of India (Pages 13-15)
- Chapter 3: Drainage System (Pages 20-25)
` : `
**Note:** No specific textbook sources available. Base recommendations on general curriculum knowledge.
`}

Create a detailed preparation plan with Indian cultural context and values:

## 📚 **${request.subject} Exam Preparation Strategy - Class ${request.grade_level}**

### 1. **अध्याय विश्लेषण (Chapter-wise Analysis)**
For each chapter, provide:
- **Key topics and concepts** (most important points)
- **Difficulty level** (Easy/Medium/Hard based on typical student performance)
- **Weightage in exams** (estimated marks based on ${request.board_type} pattern)
- **Time required for revision** (hours needed)
- **Important questions** (likely to appear in exam)

### 2. **समय सारणी (Study Timeline)**
**Week-wise breakdown for ${timeAvailable} days:**

**Week 1-2: Foundation Building**
- Chapters to cover: [List based on difficulty and importance]
- Daily targets: [Specific goals]
- Focus: Understanding concepts clearly

**Week 3-4: Application & Practice**
- Chapters to cover: [Remaining chapters]
- Daily targets: [Problem solving focus]
- Focus: Applying knowledge to questions

**Final Week: Revision & Confidence Building**
- Complete revision strategy
- Mock tests and practice papers
- Last-minute tips and tricks

### 3. **प्राथमिकता मैट्रिक्स (Topic Priority Matrix)**

**🔴 High Priority (Must Master - 70% marks):**
- [Critical topics that frequently appear in exams]
- [Concepts that form foundation for other topics]

**🟡 Medium Priority (Should Know - 20% marks):**
- [Important but less frequent topics]
- [Topics that complement high priority areas]

**🟢 Low Priority (Good to Know - 10% marks):**
- [Additional topics if time permits]
- [Interesting but rarely examined concepts]

### 4. **महत्वपूर्ण प्रश्न बैंक (Important Questions Bank)**
Based on textbook exercises and ${request.board_type} patterns:
- **10 most important short answer questions** (2-3 marks each)
- **5 most likely long answer questions** (5-6 marks each)
- **Key numerical problems** (if applicable)
- **Previous year question patterns** and trends

### 5. **स्मृति तकनीकें (Memory Techniques)**
Indian traditional and modern methods:
- **Subject-specific mnemonics** (Hindi/English mix)
- **Formula sheets** (if applicable) with visual aids
- **Concept maps** for complex topics
- **Quick revision notes** format
- **Story-based memory** techniques using Indian contexts

### 6. **दैनिक अध्ययन कार्यक्रम (Daily Study Schedule)**

**प्रातःकाल (Morning - 6:00-9:00 AM):**
- Fresh mind for difficult concepts
- New topic learning
- 2-3 hours focused study

**दोपहर (Afternoon - 2:00-4:00 PM):**
- Practice problems and exercises
- Revision of morning topics
- Question solving

**सायंकाल (Evening - 6:00-8:00 PM):**
- Light revision and reading
- Notes making
- Doubt clearing

### 7. **तनाव प्रबंधन और प्रेरणा (Stress Management & Motivation)**

**Healthy Study Habits:**
- Regular breaks (every 45 minutes)
- Proper sleep (7-8 hours)
- Healthy meals and hydration
- Physical exercise or yoga

**Indian Cultural Wisdom for Confidence:**
- Start each study session with "ॐ गं गणपतये नमः" for removing obstacles
- Remember "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन" - Focus on effort, not results
- Take inspiration from great Indian scholars like Aryabhata, Chanakya

**Motivation Mantras:**
- "मैं कर सकता हूँ!" (I can do it!)
- "अभ्यास से सिद्धि" (Success through practice)
- "धैर्य और मेहनत से सब कुछ संभव है" (Everything is possible with patience and hard work)

### 8. **अंतिम क्षण रणनीति (Last-Minute Revision Strategy)**

**3 Days Before Exam:**
- Complete syllabus revision
- Focus on high-priority topics only
- Solve previous year papers

**1 Day Before Exam:**
- Light revision of formulas/key points
- Avoid learning new topics
- Relax and maintain confidence

**Exam Day Morning:**
- Light breakfast
- Quick glance at important formulas
- Positive affirmations: "मैं तैयार हूँ!" (I am ready!)

### 9. **परिवार का सहयोग (Family Support)**
- Create a supportive study environment at home
- Family members can help with mock tests
- Maintain encouraging atmosphere
- Celebrate small achievements

Remember: "विद्या विनयेन शोभते" - Knowledge shines with humility. Study with dedication, stay humble, and success will follow!

**Final Message:** You have ${timeAvailable} days to achieve excellence. With proper planning, consistent effort, and the blessings of knowledge, you will surely succeed. All the best, beta!`;
  }

  /**
   * Format conversation history for context-aware responses
   */
  private formatConversationHistory(history: Array<{role: string, content: string}>): string {
    if (history.length === 0) {
      return "**CONVERSATION HISTORY:** This is the first interaction.";
    }

    let formatted = "**CONVERSATION HISTORY:**\n";
    history.slice(-6).forEach((msg) => {
      const role = msg.role === 'student' || msg.role === 'user' ? 'Student' : 'Assistant';
      formatted += `${role}: ${msg.content}\n`;
    });
    formatted += "\n**IMPORTANT:** Build on this conversation. If the student is asking for modifications to a previous plan, adjust it rather than creating a completely new one.\n";

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

  private extractStructuredPlan(responseText: string, request: ExamStrategyRequest): {
    priority_matrix: {
      high_priority: string[];
      medium_priority: string[];
      low_priority: string[];
    };
    daily_schedule: {
      morning: string;
      afternoon: string;
      evening: string;
    };
    stress_management_tips: string[];
  } {
    // Extract structured information from the response
    const highPriority = this.extractSection(responseText, ['high priority', '🔴', 'must master']);
    const mediumPriority = this.extractSection(responseText, ['medium priority', '🟡', 'should know']);
    const lowPriority = this.extractSection(responseText, ['low priority', '🟢', 'good to know']);
    
    const stressTips = this.extractSection(responseText, ['stress management', 'तनाव प्रबंधन', 'healthy habits']);

    return {
      priority_matrix: {
        high_priority: highPriority,
        medium_priority: mediumPriority,
        low_priority: lowPriority
      },
      daily_schedule: {
        morning: "Fresh mind for difficult concepts, new topic learning, 2-3 hours focused study",
        afternoon: "Practice problems and exercises, revision of morning topics, question solving",
        evening: "Light revision and reading, notes making, doubt clearing"
      },
      stress_management_tips: stressTips
    };
  }

  private extractSection(text: string, keywords: string[]): string[] {
    const sections: string[] = [];
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (keywords.some(keyword => line.includes(keyword))) {
        // Extract next few lines as section content
        for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
          const nextLine = lines[j].trim();
          if (nextLine && nextLine.startsWith('-') && nextLine.length > 10) {
            sections.push(nextLine.substring(1).trim());
          } else if (nextLine && !nextLine.startsWith('#') && nextLine.length > 15 && !nextLine.includes('**')) {
            sections.push(nextLine);
          }
        }
        break;
      }
    }
    
    return sections.slice(0, 5); // Limit to 5 items per section
  }
}

export class ExamPreparationAgent {
  private strategyTool: ExamStrategyTool;

  constructor() {
    this.strategyTool = new ExamStrategyTool();
  }

  async create_exam_strategy(
    chapters: string[],
    studentContext: {
      grade_level: number;
      subject: string;
      board_type: 'CBSE' | 'ICSE' | 'State Board';
      exam_type?: 'regular' | 'board' | 'competitive' | 'unit_test';
      time_available?: number;
      language?: ResponseLanguage;
    },
    studentProfile: {
      strengths?: string[];
      weaknesses?: string[];
    } = {},
    conversationHistory: Array<{role: string, content: string}> = []
  ): Promise<StudyPlan> {
    console.log(`📚 Exam Strategy Request: ${studentContext.subject} for Class ${studentContext.grade_level}`);

    const request: ExamStrategyRequest = {
      chapters,
      grade_level: studentContext.grade_level,
      subject: studentContext.subject,
      board_type: studentContext.board_type,
      exam_type: studentContext.exam_type || 'regular',
      time_available: studentContext.time_available || 30,
      student_strengths: studentProfile.strengths,
      student_weaknesses: studentProfile.weaknesses,
      conversation_history: conversationHistory,
      language: studentContext.language
    };

    return await this.strategyTool.create_comprehensive_exam_plan(request);
  }
}
