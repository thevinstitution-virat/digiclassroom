-- Dictionary Words Table Migration
-- Creates the missing dictionary_words table with proper schema

CREATE TABLE IF NOT EXISTS dictionary_words (
  id INT PRIMARY KEY AUTO_INCREMENT,
  word VARCHAR(255) NOT NULL UNIQUE,
  pronunciation VARCHAR(255),
  part_of_speech VARCHAR(100),
  english_definition TEXT NOT NULL,
  hindi_translation VARCHAR(255),
  devanagari_script VARCHAR(255),
  amarkosha_category VARCHAR(100),
  semantic_cluster VARCHAR(100),
  difficulty_level ENUM('easy', 'medium', 'hard') DEFAULT 'medium',
  frequency_rank INT DEFAULT 1000,
  audio_url TEXT,
  audio_accent ENUM('us', 'uk', 'au') DEFAULT 'us',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes for performance
  INDEX idx_word (word),
  INDEX idx_hindi_translation (hindi_translation),
  INDEX idx_difficulty (difficulty_level),
  INDEX idx_frequency (frequency_rank),
  INDEX idx_active (is_active),
  INDEX idx_part_of_speech (part_of_speech),
  
  -- Full-text search indexes
  FULLTEXT idx_definition (english_definition),
  FULLTEXT idx_combined (word, english_definition, hindi_translation)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert essential vocabulary words
INSERT INTO dictionary_words (
  word, pronunciation, part_of_speech, english_definition, hindi_translation, 
  devanagari_script, difficulty_level, frequency_rank, audio_url
) VALUES
-- Basic vocabulary (frequency rank 1-50)
('hello', '/həˈloʊ/', 'interjection', 'Used as a greeting or to begin a phone conversation', 'नमस्ते', 'नमस्ते', 'easy', 1, 'https://api.dictionaryapi.dev/media/pronunciations/en/hello-us.mp3'),
('education', '/ˌɛdʒʊˈkeɪʃən/', 'noun', 'The process of receiving or giving systematic instruction', 'शिक्षा', 'शिक्षा', 'medium', 2, 'https://api.dictionaryapi.dev/media/pronunciations/en/education-us.mp3'),
('knowledge', '/ˈnɑlɪdʒ/', 'noun', 'Facts, information, and skills acquired through experience or education', 'ज्ञान', 'ज्ञान', 'medium', 3, 'https://api.dictionaryapi.dev/media/pronunciations/en/knowledge-us.mp3'),
('student', '/ˈstudənt/', 'noun', 'A person who is studying at a school or college', 'छात्र', 'छात्र', 'easy', 4, 'https://api.dictionaryapi.dev/media/pronunciations/en/student-us.mp3'),
('teacher', '/ˈtitʃər/', 'noun', 'A person who teaches, especially in a school', 'शिक्षक', 'शिक्षक', 'easy', 5, 'https://api.dictionaryapi.dev/media/pronunciations/en/teacher-us.mp3'),
('book', '/bʊk/', 'noun', 'A written or printed work consisting of pages glued or sewn together along one side', 'किताब', 'किताब', 'easy', 6, 'https://api.dictionaryapi.dev/media/pronunciations/en/book-us.mp3'),
('school', '/skul/', 'noun', 'An institution for educating children', 'स्कूल', 'स्कूल', 'easy', 7, 'https://api.dictionaryapi.dev/media/pronunciations/en/school-us.mp3'),
('learn', '/lɜrn/', 'verb', 'Acquire knowledge or skills through experience, study, or by being taught', 'सीखना', 'सीखना', 'easy', 8, 'https://api.dictionaryapi.dev/media/pronunciations/en/learn-us.mp3'),
('study', '/ˈstʌdi/', 'verb', 'Devote time and attention to acquiring knowledge on an academic subject', 'अध्ययन करना', 'अध्ययन करना', 'easy', 9, 'https://api.dictionaryapi.dev/media/pronunciations/en/study-us.mp3'),
('read', '/rid/', 'verb', 'Look at and comprehend the meaning of written or printed matter', 'पढ़ना', 'पढ़ना', 'easy', 10, 'https://api.dictionaryapi.dev/media/pronunciations/en/read-us.mp3'),

-- Academic vocabulary (frequency rank 51-100)
('science', '/ˈsaɪəns/', 'noun', 'The intellectual and practical activity encompassing the systematic study of the structure and behaviour of the physical and natural world', 'विज्ञान', 'विज्ञान', 'medium', 11, 'https://api.dictionaryapi.dev/media/pronunciations/en/science-us.mp3'),
('mathematics', '/ˌmæθəˈmætɪks/', 'noun', 'The abstract science of number, quantity, and space', 'गणित', 'गणित', 'medium', 12, 'https://api.dictionaryapi.dev/media/pronunciations/en/mathematics-us.mp3'),
('history', '/ˈhɪstəri/', 'noun', 'The study of past events, particularly in human affairs', 'इतिहास', 'इतिहास', 'medium', 13, 'https://api.dictionaryapi.dev/media/pronunciations/en/history-us.mp3'),
('language', '/ˈlæŋɡwɪdʒ/', 'noun', 'The method of human communication, either spoken or written', 'भाषा', 'भाषा', 'medium', 14, 'https://api.dictionaryapi.dev/media/pronunciations/en/language-us.mp3'),
('dictionary', '/ˈdɪkʃəˌnɛri/', 'noun', 'A book or electronic resource that lists the words of a language typically in alphabetical order', 'शब्दकोश', 'शब्दकोश', 'medium', 15, 'https://api.dictionaryapi.dev/media/pronunciations/en/dictionary-us.mp3'),
('vocabulary', '/voʊˈkæbjəˌlɛri/', 'noun', 'The body of words used in a particular language', 'शब्दावली', 'शब्दावली', 'medium', 16, 'https://api.dictionaryapi.dev/media/pronunciations/en/vocabulary-us.mp3'),
('grammar', '/ˈɡræmər/', 'noun', 'The whole system and structure of a language', 'व्याकरण', 'व्याकरण', 'medium', 17, 'https://api.dictionaryapi.dev/media/pronunciations/en/grammar-us.mp3'),
('pronunciation', '/prəˌnʌnsiˈeɪʃən/', 'noun', 'The way in which a word is pronounced', 'उच्चारण', 'उच्चारण', 'hard', 18, 'https://api.dictionaryapi.dev/media/pronunciations/en/pronunciation-us.mp3'),
('meaning', '/ˈminɪŋ/', 'noun', 'What is meant by a word, text, concept, or action', 'अर्थ', 'अर्थ', 'easy', 19, 'https://api.dictionaryapi.dev/media/pronunciations/en/meaning-us.mp3'),
('definition', '/ˌdɛfəˈnɪʃən/', 'noun', 'A statement of the exact meaning of a word', 'परिभाषा', 'परिभाषा', 'medium', 20, 'https://api.dictionaryapi.dev/media/pronunciations/en/definition-us.mp3'),

-- Common words (frequency rank 101-150)
('word', '/wɜrd/', 'noun', 'A single distinct meaningful element of speech or writing', 'शब्द', 'शब्द', 'easy', 21, 'https://api.dictionaryapi.dev/media/pronunciations/en/word-us.mp3'),
('sentence', '/ˈsɛntəns/', 'noun', 'A set of words that is complete in itself', 'वाक्य', 'वाक्य', 'easy', 22, 'https://api.dictionaryapi.dev/media/pronunciations/en/sentence-us.mp3'),
('paragraph', '/ˈpærəˌɡræf/', 'noun', 'A distinct section of a piece of writing', 'अनुच्छेद', 'अनुच्छेद', 'medium', 23, 'https://api.dictionaryapi.dev/media/pronunciations/en/paragraph-us.mp3'),
('chapter', '/ˈtʃæptər/', 'noun', 'A section of a book', 'अध्याय', 'अध्याय', 'easy', 24, 'https://api.dictionaryapi.dev/media/pronunciations/en/chapter-us.mp3'),
('lesson', '/ˈlɛsən/', 'noun', 'A period of learning or teaching', 'पाठ', 'पाठ', 'easy', 25, 'https://api.dictionaryapi.dev/media/pronunciations/en/lesson-us.mp3'),
('homework', '/ˈhoʊmˌwɜrk/', 'noun', 'Schoolwork assigned to be done outside the classroom', 'गृहकार्य', 'गृहकार्य', 'easy', 26, 'https://api.dictionaryapi.dev/media/pronunciations/en/homework-us.mp3'),
('exam', '/ɪɡˈzæm/', 'noun', 'A formal test of a person\'s knowledge or proficiency', 'परीक्षा', 'परीक्षा', 'easy', 27, 'https://api.dictionaryapi.dev/media/pronunciations/en/exam-us.mp3'),
('test', '/tɛst/', 'noun', 'A procedure intended to establish the quality, performance, or reliability of something', 'परीक्षण', 'परीक्षण', 'easy', 28, 'https://api.dictionaryapi.dev/media/pronunciations/en/test-us.mp3'),
('grade', '/ɡreɪd/', 'noun', 'A particular level of rank, quality, proficiency, or value', 'श्रेणी', 'श्रेणी', 'easy', 29, 'https://api.dictionaryapi.dev/media/pronunciations/en/grade-us.mp3'),
('subject', '/ˈsʌbdʒɪkt/', 'noun', 'A branch of knowledge studied or taught in a school, college, or university', 'विषय', 'विषय', 'easy', 30, 'https://api.dictionaryapi.dev/media/pronunciations/en/subject-us.mp3'),

-- Advanced vocabulary (frequency rank 151-200)
('analysis', '/əˈnæləsɪs/', 'noun', 'Detailed examination of the elements or structure of something', 'विश्लेषण', 'विश्लेषण', 'hard', 31, 'https://api.dictionaryapi.dev/media/pronunciations/en/analysis-us.mp3'),
('synthesis', '/ˈsɪnθəsɪs/', 'noun', 'The combination of ideas to form a theory or system', 'संश्लेषण', 'संश्लेषण', 'hard', 32, 'https://api.dictionaryapi.dev/media/pronunciations/en/synthesis-us.mp3'),
('hypothesis', '/haɪˈpɑθəsɪs/', 'noun', 'A supposition or proposed explanation made on the basis of limited evidence', 'परिकल्पना', 'परिकल्पना', 'hard', 33, 'https://api.dictionaryapi.dev/media/pronunciations/en/hypothesis-us.mp3'),
('theory', '/ˈθɪri/', 'noun', 'A supposition or a system of ideas intended to explain something', 'सिद्धांत', 'सिद्धांत', 'medium', 34, 'https://api.dictionaryapi.dev/media/pronunciations/en/theory-us.mp3'),
('concept', '/ˈkɑnsɛpt/', 'noun', 'An abstract idea or general notion', 'अवधारणा', 'अवधारणा', 'medium', 35, 'https://api.dictionaryapi.dev/media/pronunciations/en/concept-us.mp3'),
('principle', '/ˈprɪnsəpəl/', 'noun', 'A fundamental truth or proposition that serves as the foundation for a system of belief', 'सिद्धांत', 'सिद्धांत', 'medium', 36, 'https://api.dictionaryapi.dev/media/pronunciations/en/principle-us.mp3'),
('method', '/ˈmɛθəd/', 'noun', 'A particular form of procedure for accomplishing or approaching something', 'विधि', 'विधि', 'medium', 37, 'https://api.dictionaryapi.dev/media/pronunciations/en/method-us.mp3'),
('process', '/ˈprɑsɛs/', 'noun', 'A series of actions or steps taken in order to achieve a particular end', 'प्रक्रिया', 'प्रक्रिया', 'medium', 38, 'https://api.dictionaryapi.dev/media/pronunciations/en/process-us.mp3'),
('system', '/ˈsɪstəm/', 'noun', 'A set of connected things or parts forming a complex whole', 'प्रणाली', 'प्रणाली', 'medium', 39, 'https://api.dictionaryapi.dev/media/pronunciations/en/system-us.mp3'),
('structure', '/ˈstrʌktʃər/', 'noun', 'The arrangement of and relations between the parts or elements of something complex', 'संरचना', 'संरचना', 'medium', 40, 'https://api.dictionaryapi.dev/media/pronunciations/en/structure-us.mp3');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_word_search ON dictionary_words (word, is_active);
CREATE INDEX IF NOT EXISTS idx_hindi_search ON dictionary_words (hindi_translation, is_active);
CREATE INDEX IF NOT EXISTS idx_frequency_active ON dictionary_words (frequency_rank, is_active);

-- Update statistics
ANALYZE TABLE dictionary_words;
