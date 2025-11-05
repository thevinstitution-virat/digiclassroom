/**
 * Conversation Context Manager
 * Handles entity tracking and pronoun resolution for AI Tutor
 */

export interface EntityReference {
  name: string;
  type: 'person' | 'place' | 'concept' | 'book' | 'chapter';
  lastMentioned: number; // timestamp
  context: string; // surrounding context
  aliases: string[]; // alternative names
}

export interface ConversationMemory {
  entities: Map<string, EntityReference>;
  lastQuery: string;
  queryCount: number;
  sessionStart: number;
}

export class ConversationContextManager {
  private memory: ConversationMemory;
  private readonly ENTITY_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.memory = {
      entities: new Map(),
      lastQuery: '',
      queryCount: 0,
      sessionStart: Date.now()
    };
  }

  /**
   * Process a new query and resolve pronouns using conversation context
   */
  processQuery(query: string, conversationHistory: Array<{role: string, content: string}>): string {
    console.log('🧠 Processing query with context:', query);
    
    // Update memory
    this.memory.lastQuery = query;
    this.memory.queryCount++;

    // Extract entities from conversation history
    this.extractEntitiesFromHistory(conversationHistory);

    // Resolve pronouns in the current query
    const resolvedQuery = this.resolvePronounsInQuery(query);
    
    console.log('🎯 Resolved query:', resolvedQuery);
    return resolvedQuery;
  }

  /**
   * Extract and track entities from conversation history
   */
  private extractEntitiesFromHistory(history: Array<{role: string, content: string}>): void {
    const now = Date.now();
    
    // Look at recent messages (last 5)
    const recentHistory = history.slice(-5);
    
    for (const message of recentHistory) {
      if (message.role === 'assistant') {
        // Extract entities from AI responses
        this.extractEntitiesFromText(message.content, now);
      }
    }

    // Clean up expired entities
    this.cleanupExpiredEntities(now);
  }

  /**
   * Extract entities from text using simple pattern matching
   */
  private extractEntitiesFromText(text: string, timestamp: number): void {
    // Common educational entities patterns
    const patterns = [
      // People (often authors, scientists, historical figures)
      {
        regex: /\b([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b/g,
        type: 'person' as const,
        filter: (name: string) => this.isLikelyPersonName(name)
      },
      // Books and chapters
      {
        regex: /\b(?:book|chapter|story|poem|lesson)\s+"([^"]+)"/gi,
        type: 'book' as const,
        filter: () => true
      },
      // Concepts (capitalized terms)
      {
        regex: /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\b/g,
        type: 'concept' as const,
        filter: (term: string) => this.isLikelyConcept(term)
      }
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        const entityName = match[1];
        
        if (pattern.filter(entityName)) {
          const key = entityName.toLowerCase();
          
          // Update or create entity
          const existing = this.memory.entities.get(key);
          this.memory.entities.set(key, {
            name: entityName,
            type: pattern.type,
            lastMentioned: timestamp,
            context: this.extractContext(text, match.index, 50),
            aliases: existing ? [...existing.aliases, entityName] : [entityName]
          });
          
          console.log(`📝 Tracked entity: ${entityName} (${pattern.type})`);
        }
      }
    }
  }

  /**
   * Resolve pronouns in the query using tracked entities
   */
  private resolvePronounsInQuery(query: string): string {
    let resolvedQuery = query;
    
    // Common pronouns to resolve
    const pronounPatterns = [
      { pronoun: /\bhe\b/gi, gender: 'male' },
      { pronoun: /\bshe\b/gi, gender: 'female' },
      { pronoun: /\bhis\b/gi, gender: 'male' },
      { pronoun: /\bher\b/gi, gender: 'female' },
      { pronoun: /\bhim\b/gi, gender: 'male' }
    ];

    for (const pattern of pronounPatterns) {
      if (pattern.pronoun.test(query)) {
        const recentEntity = this.findRecentEntity('person', pattern.gender);
        if (recentEntity) {
          resolvedQuery = resolvedQuery.replace(
            pattern.pronoun, 
            recentEntity.name
          );
          console.log(`🔄 Resolved "${pattern.pronoun.source}" to "${recentEntity.name}"`);
        }
      }
    }

    // Resolve "it" for concepts/books
    if (/\bit\b/gi.test(query)) {
      const recentConcept = this.findRecentEntity('concept') || this.findRecentEntity('book');
      if (recentConcept) {
        resolvedQuery = resolvedQuery.replace(/\bit\b/gi, recentConcept.name);
        console.log(`🔄 Resolved "it" to "${recentConcept.name}"`);
      }
    }

    return resolvedQuery;
  }

  /**
   * Find the most recently mentioned entity of a specific type
   */
  private findRecentEntity(type: string, gender?: string): EntityReference | null {
    let mostRecent: EntityReference | null = null;
    let latestTime = 0;

    for (const entity of this.memory.entities.values()) {
      if (entity.type === type && entity.lastMentioned > latestTime) {
        // For people, check gender if specified
        if (type === 'person' && gender) {
          if (this.matchesGender(entity.name, gender)) {
            mostRecent = entity;
            latestTime = entity.lastMentioned;
          }
        } else {
          mostRecent = entity;
          latestTime = entity.lastMentioned;
        }
      }
    }

    return mostRecent;
  }

  /**
   * Simple heuristics to determine if a name is likely a person
   */
  private isLikelyPersonName(name: string): boolean {
    // Common educational figures and patterns
    const commonNames = [
      'Abdul Kalam', 'A.P.J. Abdul Kalam', 'Einstein', 'Albert Einstein',
      'Evelyn Glennie', 'Charlie Chaplin', 'Robert Frost', 'Subramania Bharati'
    ];
    
    return commonNames.some(known => 
      name.toLowerCase().includes(known.toLowerCase()) ||
      known.toLowerCase().includes(name.toLowerCase())
    ) || (name.split(' ').length >= 2 && name.length > 5);
  }

  /**
   * Simple heuristics to determine if a term is likely a concept
   */
  private isLikelyConcept(term: string): boolean {
    // Skip common words
    const skipWords = ['The', 'This', 'That', 'Class', 'Chapter', 'Page'];
    return !skipWords.includes(term) && term.length > 3;
  }

  /**
   * Simple gender matching for pronouns
   */
  private matchesGender(name: string, gender: string): boolean {
    // Simple heuristics - in a real system, use a proper name database
    const maleNames = ['Abdul', 'Kalam', 'Einstein', 'Albert', 'Charlie'];
    const femaleNames = ['Evelyn', 'Glennie'];
    
    const nameLower = name.toLowerCase();
    
    if (gender === 'male') {
      return maleNames.some(male => nameLower.includes(male.toLowerCase()));
    } else if (gender === 'female') {
      return femaleNames.some(female => nameLower.includes(female.toLowerCase()));
    }
    
    return false;
  }

  /**
   * Extract context around a match
   */
  private extractContext(text: string, index: number, radius: number): string {
    const start = Math.max(0, index - radius);
    const end = Math.min(text.length, index + radius);
    return text.substring(start, end);
  }

  /**
   * Clean up entities that haven't been mentioned recently
   */
  private cleanupExpiredEntities(now: number): void {
    for (const [key, entity] of this.memory.entities.entries()) {
      if (now - entity.lastMentioned > this.ENTITY_EXPIRY_MS) {
        this.memory.entities.delete(key);
        console.log(`🗑️ Expired entity: ${entity.name}`);
      }
    }
  }

  /**
   * Get current conversation context summary
   */
  getContextSummary(): string {
    const entities = Array.from(this.memory.entities.values())
      .sort((a, b) => b.lastMentioned - a.lastMentioned)
      .slice(0, 5); // Top 5 recent entities

    if (entities.length === 0) {
      return '';
    }

    const entityList = entities.map(e => `${e.name} (${e.type})`).join(', ');
    return `Recent conversation entities: ${entityList}`;
  }

  /**
   * Reset conversation memory
   */
  reset(): void {
    this.memory = {
      entities: new Map(),
      lastQuery: '',
      queryCount: 0,
      sessionStart: Date.now()
    };
    console.log('🔄 Conversation context reset');
  }
}
