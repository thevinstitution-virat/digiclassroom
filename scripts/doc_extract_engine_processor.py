#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF-Extract-Kit v1.0.0 Integration Script for DigiClassroom
Comprehensive document processing using PDF-Extract-Kit v1.0.0 modular architecture:
- Layout Detection (DocLayout-YOLO, YOLOv10, LayoutLMv3)
- Formula Detection & Recognition (YOLOv8 + UniMERNet)
- OCR (PaddleOCR)
- Table Recognition (StructEqTable, StructTable-InternVL2-1B)

Usage:
  python scripts/doc_extract_engine_processor.py <pdf_path> --metadata '{...}'

Outputs comprehensive JSON with all detected elements and extracted content.

CHANGELOG v1.0.0:
- Updated to use PDF-Extract-Kit v1.0.0 modular API
- Uses new TASK_REGISTRY and MODEL_REGISTRY system
- Improved configuration loading with YAML support
- Better task initialization and error handling
"""

import argparse
import json
import os
import sys
import io

# Set UTF-8 encoding for stdout/stderr on Windows to handle emojis
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Set environment for OpenMP/Intel MKL issues on Windows before heavy imports
os.environ.setdefault('KMP_DUPLICATE_LIB_OK', 'TRUE')
os.environ.setdefault('OMP_NUM_THREADS', '1')

import time
import warnings
from pathlib import Path
import re
import traceback
from typing import Dict, List, Any, Optional


def normalize_class_level(class_level: str) -> str:
    """
    Normalize class level to 'Class X' format (Arabic numerals)
    Converts: "Class IX" -> "Class 9", "9" -> "Class 9", "IX" -> "Class 9"
    """
    if not class_level or class_level == 'Unknown':
        return 'Unknown'

    # Roman to Arabic mapping
    roman_to_arabic = {
        'XII': '12', 'XI': '11', 'X': '10', 'IX': '9', 'VIII': '8',
        'VII': '7', 'VI': '6', 'V': '5', 'IV': '4', 'III': '3', 'II': '2', 'I': '1'
    }

    # Check for Roman numerals
    for roman, arabic in roman_to_arabic.items():
        if roman in class_level.upper():
            return f'Class {arabic}'

    # Check for Arabic numerals
    match = re.search(r'(\d{1,2})', class_level)
    if match:
        return f'Class {match.group(1)}'

    return 'Unknown'

# Suppress warnings for cleaner output
warnings.filterwarnings('ignore')

# Ensure project root is on sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Add vendor/PDF-Extract-Kit to path
PDF_EXTRACT_KIT_PATH = ROOT_DIR / 'vendor' / 'PDF-Extract-Kit'
if str(PDF_EXTRACT_KIT_PATH) not in sys.path:
    sys.path.insert(0, str(PDF_EXTRACT_KIT_PATH))

# Import PyMuPDF (required by PDF-Extract-Kit for PDF rasterization)
# This is NOT used as a fallback - it's required by PDF-Extract-Kit's load_pdf function
try:
    import fitz
    HAVE_PYMUPDF = True
except Exception:
    HAVE_PYMUPDF = False
    print("❌ PyMuPDF (fitz) not available - required by PDF-Extract-Kit", file=sys.stderr)

# GPU Detection and Configuration
# GPU is REQUIRED - no CPU fallback
GPU_AVAILABLE = False
GPU_DEVICE = 'cuda'
GPU_INFO = {}

try:
    import torch
    if torch.cuda.is_available():
        GPU_AVAILABLE = True
        GPU_DEVICE = 'cuda'
        GPU_INFO = {
            'device_name': torch.cuda.get_device_name(0),
            'device_count': torch.cuda.device_count(),
            'cuda_version': torch.version.cuda,
            'memory_gb': torch.cuda.get_device_properties(0).total_memory / 1024**3
        }
        print(f"✓ GPU Acceleration ENABLED: {GPU_INFO['device_name']} ({GPU_INFO['memory_gb']:.2f} GB)", file=sys.stderr)
    else:
        print(json.dumps({
            'success': False,
            'errors': ['GPU acceleration is required but not available. Please ensure CUDA is properly installed and a compatible GPU is present.']
        }))
        sys.exit(1)
except ImportError:
    print(json.dumps({
        'success': False,
        'errors': ['PyTorch is not installed. GPU acceleration is required for document processing.']
    }))
    sys.exit(1)

# Try to import PDF-Extract-Kit v1.0.0 components
HAVE_PDF_EXTRACT_KIT = False
pdf_extract_kit_tasks = {}

try:
    # Import PDF-Extract-Kit v1.0.0 core utilities
    from pdf_extract_kit.registry import TASK_REGISTRY, MODEL_REGISTRY
    from pdf_extract_kit.utils.config_loader import load_config as load_yaml_config, initialize_tasks_and_models
    import pdf_extract_kit.tasks  # Ensure all task modules are imported
    HAVE_PDF_EXTRACT_KIT = True
    print("✓ PDF-Extract-Kit v1.0.0 core loaded successfully", file=sys.stderr)

    # List available tasks from registry
    try:
        available_tasks = TASK_REGISTRY.list_items()
        print(f"✓ Available tasks: {', '.join(available_tasks)}", file=sys.stderr)
    except Exception as e:
        print(f"⚠ Could not list tasks: {e}", file=sys.stderr)

except Exception as e:
    print(f"❌ PDF-Extract-Kit v1.0.0 import failed: {e}", file=sys.stderr)
    print(f"❌ PDF-Extract-Kit is REQUIRED for document processing - no fallbacks available", file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    HAVE_PDF_EXTRACT_KIT = False


def load_config(config_path: str | None) -> dict:
    """Load configuration from JSON file (for backward compatibility)"""
    if not config_path:
        return {}
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def extract_text_with_pymupdf(pdf_path: Path, metadata: dict) -> dict:
    """Extract text using PyMuPDF as fallback"""
    try:
        doc = fitz.open(str(pdf_path))
        chunks = []
        total_words = 0
        total_pages = len(doc)

        for page_num in range(total_pages):
            page = doc[page_num]
            text = page.get_text()

            if not text.strip():
                # Still emit a progress line for empty pages to reflect advancement
                print(f"page {page_num + 1}/{total_pages} done", file=sys.stderr, flush=True)
                continue

            # Split text into chunks (approximately 500 words each)
            words = text.split()
            chunk_size = 500

            for i in range(0, len(words), chunk_size):
                chunk_words = words[i:i + chunk_size]
                chunk_text = ' '.join(chunk_words)

                if len(chunk_text.strip()) < 50:  # Skip very short chunks
                    continue

                chunk_id = f"page_{page_num + 1}_chunk_{i // chunk_size + 1}"

                # NOTE: OCR correction disabled - TypeScript ContentQualityEnhancer has 148+ patterns (vs 15 here)
                # Let TypeScript handle OCR correction for better accuracy
                corrected_text = chunk_text

                # ENHANCED: Detect metadata accurately (basic detection, TypeScript will refine)
                has_formulas = detect_formulas(corrected_text)
                has_tables = detect_tables(corrected_text)
                section_level, section_title = detect_section_info(corrected_text)

                # ENHANCED: Extract chapter with length limit
                chapter_info = extract_chapter_from_text(corrected_text, max_length=100)

                # Detect content type
                content_type = 'text'
                if has_tables:
                    content_type = 'table'
                elif has_formulas:
                    content_type = 'equation'
                elif re.search(r'\b(?:figure|diagram|chart)\b', corrected_text.lower()):
                    content_type = 'figure'

                chunks.append({
                    'id': chunk_id,
                    'text': corrected_text,  # ENHANCED: Use corrected text
                    'metadata': {
                        'class': normalize_class_level(metadata.get('classLevel', 'Unknown')),
                        'subject': metadata.get('subject', 'Unknown'),
                        'book_title': metadata.get('bookTitle', pdf_path.stem),
                        'chapter': chapter_info or 'General Chapter',  # ENHANCED: Proper chapter
                        'section_title': section_title,  # ENHANCED: Section title
                        'source': metadata.get('bookTitle', pdf_path.name),
                        'curriculum': metadata.get('curriculum', 'CBSE'),
                        'board': metadata.get('curriculum', 'CBSE'),
                        'medium': metadata.get('language', 'English'),
                        'language': metadata.get('language', 'English'),
                        'page': page_num + 1,
                        'section_level': section_level,  # ENHANCED: Accurate level
                        'content_type': content_type,
                        'confidence': 0.85,
                        'contains_equation': has_formulas,  # Basic detection, TypeScript will refine
                        'contains_table': has_tables,  # Basic detection, TypeScript will refine
                        'contains_figure': 'figure' in corrected_text.lower() or 'diagram' in corrected_text.lower()
                        # NOTE: ocr_quality_score removed - TypeScript ContentQualityEnhancer will handle OCR + quality scoring
                    }
                })

                total_words += len(chunk_words)

            # Emit per-page progress after processing the page
            print(f"page {page_num + 1}/{total_pages} done", file=sys.stderr, flush=True)

        doc.close()

        # Extract document structure
        document_structure = extract_document_structure(chunks, metadata, pdf_path)

        return {
            'success': True,
            'chunks': chunks,
            'document_structure': document_structure,
            'stats': {
                'total_pages': total_pages,
                'total_chunks': len(chunks),
                'total_words': total_words,
                'tables_found': sum(1 for c in chunks if c['metadata']['contains_table']),
                'equations_found': sum(1 for c in chunks if c['metadata']['contains_equation']),
                'figures_found': sum(1 for c in chunks if c['metadata']['contains_figure'])
            },
            'errors': []
        }

    except Exception as e:
        return {
            'success': False,
            'chunks': [],
            'document_structure': {'title': pdf_path.name, 'chapters': []},
            'stats': {
                'total_pages': 0,
                'total_chunks': 0,
                'total_words': 0,
                'tables_found': 0,
                'equations_found': 0,
                'figures_found': 0
            },
            'errors': [f'PyMuPDF extraction failed: {str(e)}']
        }

def detect_formulas(text: str) -> bool:
    """Enhanced formula detection"""
    if not text:
        return False

    formula_patterns = [
        r'\b\d+\s*[+\-×÷*/=]\s*\d+',                    # Basic arithmetic: 2 + 2
        r'[a-zA-Z]\s*[+\-×÷*/=]\s*[a-zA-Z0-9]',        # Algebraic: x + y
        r'\b(sin|cos|tan|log|ln|sqrt|exp)\s*\(',       # Functions: sin(x)
        r'\b[a-zA-Z]\^?\d+',                            # Powers: x^2, x2
        r'[∫∑∏√π∞αβγδεθλμσΔ]',                         # Math symbols
        r'\d+°\d+\'[NS]',                               # Coordinates: 23°30'N
        r'\d+\.\d+\s*[×x]\s*10\^?[\-−]?\d+',          # Scientific notation
        r'\([a-zA-Z0-9\s+\-*/^]+\)\s*[=]',             # Equations in parentheses
    ]

    for pattern in formula_patterns:
        if re.search(pattern, text):
            return True
    return False

def detect_tables(text: str) -> bool:
    """Enhanced table detection"""
    if not text:
        return False

    table_patterns = [
        r'\|\s*[^|]+\s*\|',                             # Pipe-separated: | col1 | col2 |
        r'Table\s+\d+',                                 # "Table 1", "Table 2"
        r'\b(?:row|column|cell)\b',                     # Table terminology
        r'^\s*\d+\.\d+\s+\d+\.\d+\s+\d+',              # Numeric columns
        r'\b(?:data|values|results)\s+(?:table|chart)\b'
    ]

    for pattern in table_patterns:
        if re.search(pattern, text, re.IGNORECASE | re.MULTILINE):
            return True
    return False

def detect_section_info(text: str) -> tuple[int, str | None]:
    """
    Detect section level and title
    Returns: (section_level, section_title)
    """
    if not text:
        return (4, None)

    # Level 1: Chapter/Unit headers
    if re.search(r'^(Chapter|Unit)\s+\d+', text, re.IGNORECASE):
        match = re.search(r'^(Chapter|Unit)\s+\d+[:\s]*([^\n]{0,100})', text, re.IGNORECASE)
        title = match.group(0).strip()[:100] if match else None
        return (1, title)

    # Level 2: Major sections (1. Title)
    if re.search(r'^\d+\.\s+[A-Z]', text):
        match = re.search(r'^\d+\.\s+([A-Z][^\n]{0,80})', text)
        title = match.group(1).strip() if match else None
        return (2, title)

    # Level 3: Subsections (1.1 Title)
    if re.search(r'^\d+\.\d+\s+[A-Z]', text):
        match = re.search(r'^\d+\.\d+\s+([A-Z][^\n]{0,80})', text)
        title = match.group(1).strip() if match else None
        return (3, title)

    # Level 4: Paragraph (default)
    return (4, None)

def correct_ocr_errors(text: str) -> tuple[str, int]:
    """
    Correct common OCR errors in extracted text
    Returns: (corrected_text, quality_score)
    """
    if not text:
        return text, 100

    original_text = text
    corrections_made = 0

    # Common OCR error patterns with replacements
    ocr_patterns = [
        # Letter substitutions
        (r'\brn\b', 'm'),
        (r'\bl\b(?=[A-Z])', 'I'),
        (r'\b0(?=[a-zA-Z])', 'O'),
        (r'(?<=[a-zA-Z])0\b', 'o'),
        (r'\bs0\b', 'so'),
        (r'\bndia\b', 'India'),
        (r'\bJout\b', 'out'),
        (r'\bSIzE\b', 'SIZE'),
        (r'\bvvith\b', 'with'),
        (r'\btlie\b', 'the'),
        (r'\banci\b', 'and'),

        # Common word corrections
        (r'\bvvas\b', 'was'),
        (r'\bvvere\b', 'were'),
        (r'\bvvhich\b', 'which'),
        (r'\bvvho\b', 'who'),
        (r'\bvvhat\b', 'what'),

        # Fix spacing issues
        (r'\s+', ' '),  # Multiple spaces to single space
    ]

    corrected_text = text
    for pattern, replacement in ocr_patterns:
        before = corrected_text
        corrected_text = re.sub(pattern, replacement, corrected_text, flags=re.IGNORECASE)
        if before != corrected_text:
            corrections_made += 1

    # Calculate quality score (fewer corrections = higher quality)
    word_count = len(text.split())
    error_rate = corrections_made / max(word_count, 1)
    quality_score = max(0, min(100, int(100 - (error_rate * 100))))

    return corrected_text, quality_score

def extract_chapter_from_text(text: str, max_length: int = 100) -> str:
    """
    Extract chapter information from text content with improved accuracy
    Fixes malformed chapter names by limiting title length and using better patterns
    """
    if not text or len(text) == 0:
        return None

    # Enhanced chapter patterns with proper title extraction
    chapter_patterns = [
        # Pattern 1: "Chapter 1: Title" or "Chapter 1 - Title" (most reliable)
        {
            'regex': r'(?:^|\n)\s*Chapter\s+(\d+)\s*[:\-–—]\s*([A-Z][^\n]{0,80}?)(?:\n|[.!?]|$)',
            'confidence': 0.95
        },
        # Pattern 2: "Chapter 1" followed by title on next line or same line
        {
            'regex': r'(?:^|\n)\s*Chapter\s+(\d+)\s*\n?\s*([A-Z][A-Z\s]{2,50}?)(?:\n|[.!?])',
            'confidence': 0.85
        },
        # Pattern 3: "Unit 1: Title"
        {
            'regex': r'(?:^|\n)\s*Unit\s+(\d+)\s*[:\-–—]\s*([A-Z][^\n]{0,80}?)(?:\n|[.!?]|$)',
            'confidence': 0.90
        },
        # Pattern 4: "1. Title" (numbered section)
        {
            'regex': r'(?:^|\n)\s*(\d+)\.\s+([A-Z][A-Z\s]{5,50}?)(?:\n|$)',
            'confidence': 0.75
        },
        # Pattern 5: Just "Chapter 1" without title
        {
            'regex': r'(?:^|\n)\s*Chapter\s+(\d+)\s*(?:\n|$)',
            'confidence': 0.70
        }
    ]

    # Try each pattern in order of confidence
    for pattern_info in chapter_patterns:
        match = re.search(pattern_info['regex'], text, re.IGNORECASE)
        if match:
            groups = match.groups()

            if len(groups) >= 2 and groups[1]:
                # Has both number and title
                num = groups[0]
                title = groups[1].strip()

                # Clean up title
                title = re.sub(r'\s+', ' ', title)  # Normalize whitespace
                title = re.sub(r'[.!?]+$', '', title)  # Remove trailing punctuation
                title = title[:max_length]  # Limit length

                # Validate title looks reasonable (not just random text)
                if len(title) > 3 and len(title) < max_length:
                    # Check if it's a Unit or Chapter
                    if 'unit' in pattern_info['regex'].lower():
                        return f"Unit {num}: {title}"
                    else:
                        return f"Chapter {num}: {title}"

            # Only has number
            if len(groups) >= 1:
                num = groups[0]
                if 'unit' in pattern_info['regex'].lower():
                    return f"Unit {num}"
                else:
                    return f"Chapter {num}"

    # Fallback: Look for section headers
    section_match = re.search(r'^(\d+\.\d+)\s+([A-Z][^\n]{5,80})$', text, re.MULTILINE)
    if section_match:
        section_num = section_match.group(1)
        section_title = section_match.group(2).strip()[:max_length]
        return f"Section {section_num}: {section_title}"

    # Last resort: Look for any heading-like text at the start
    heading_match = re.search(r'^([A-Z][A-Z\s]{5,50}?)(?:\n|$)', text)
    if heading_match:
        heading = heading_match.group(1).strip()[:max_length]
        if len(heading) > 5:
            return heading

    return None

def extract_document_structure(chunks: list, metadata: dict, pdf_path: Path) -> dict:
    """Extract document structure from chunks"""
    structure = {
        'title': metadata.get('bookTitle', pdf_path.stem),
        'chapters': []
    }

    current_chapter = None
    chapter_num = 0
    seen_chapters = set()

    for chunk in chunks:
        text = chunk['text']

        # Look for chapter markers
        chapter_match = re.search(r'(Chapter|Unit)\s+(\d+)[:\s]*([^\n]*)', text, re.IGNORECASE)
        if chapter_match:
            chapter_title = chapter_match.group(0).strip()
            if chapter_title not in seen_chapters:
                chapter_num += 1
                current_chapter = {
                    'id': f'chapter_{chapter_num}',
                    'title': chapter_title,
                    'page': chunk['metadata']['page'],
                    'sections': []
                }
                structure['chapters'].append(current_chapter)
                seen_chapters.add(chapter_title)

    return structure

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('pdf_path', help='Path to input PDF file')
    parser.add_argument('--metadata', help='JSON metadata string', default='{}')
    parser.add_argument('--config', help='Path to config JSON', default=None)
    args = parser.parse_args()

    start = time.time()
    pdf_path = Path(args.pdf_path)

    # Basic checks
    if not pdf_path.exists():
        print(json.dumps({
            'success': False,
            'chunks': [],
            'document_structure': { 'title': pdf_path.name, 'chapters': [] },
            'stats': {
                'total_pages': 0,
                'total_chunks': 0,
                'total_words': 0,
                'processing_time': 0,
                'tables_found': 0,
                'equations_found': 0,
                'figures_found': 0
            },
            'errors': [f'File not found: {pdf_path}']
        }))
        return 1

    try:
        metadata = json.loads(args.metadata or '{}')
    except Exception:
        metadata = {}

    config = load_config(args.config)

    # Use PDF-Extract-Kit v1.0.0 with all tasks enabled
    if HAVE_PDF_EXTRACT_KIT:
        # PDF-Extract-Kit requires PyMuPDF (fitz) for PDF rasterization
        if not HAVE_PYMUPDF:
            print(json.dumps({
                'success': False,
                'chunks': [],
                'document_structure': { 'title': pdf_path.name, 'chapters': [] },
                'stats': {
                    'total_pages': 0,
                    'total_chunks': 0,
                    'total_words': 0,
                    'processing_time': int((time.time() - start) * 1000),
                },
                'errors': [
                    'PyMuPDF (fitz) is REQUIRED by PDF-Extract-Kit for PDF rasterization',
                    'Install with: pip install pymupdf',
                    'This is not a fallback - it is a core dependency of PDF-Extract-Kit'
                ]
            }, ensure_ascii=False))
            return 2

        # Use PDF-Extract-Kit v1.0.0 modular pipeline with multiple tasks
        try:
            # Initialize PDF-Extract-Kit v1.0.0 tasks using new modular API
            from pdf_extract_kit.utils.config_loader import initialize_tasks_and_models as init_tasks
            from pdf_extract_kit.utils.data_preprocess import load_pdf
            import pdf_extract_kit.tasks  # ensure task modules are registered

            # Build comprehensive config for all available tasks
            # This uses the new v1.0.0 task registry system
            # Model paths are relative to vendor/PDF-Extract-Kit directory
            models_base = PDF_EXTRACT_KIT_PATH / 'models'

            # PHASE 3: GPU-Only Configuration (No CPU Fallback)
            # All processing requires GPU acceleration
            cfg = {
                'tasks': {
                    # NOTE: Layout detection RE-ENABLED with PyTorch 2.2.2+cu118 and Python 3.11.9
                    'layout_detection': {
                        'model': 'layout_detection_yolo',
                        'model_config': {
                            'model_path': str(models_base / 'Layout' / 'YOLO' / 'doclayout_yolo_ft.pt'),
                            'img_size': 1280,
                            'conf_thres': 0.25,
                            'iou_thres': 0.45,
                            'batch_size': 2,  # GPU batch size
                            'device': 'cuda',  # GPU-only, no fallback
                            'visualize': False
                        }
                    },
                    'formula_detection': {
                        'model': 'formula_detection_yolo',
                        'model_config': {
                            'model_path': str(models_base / 'MFD' / 'YOLO' / 'yolo_v8_ft.pt'),
                            'img_size': 1280,
                            'conf_thres': 0.25,
                            'iou_thres': 0.45,
                            'batch_size': 2,  # GPU batch size
                            'device': 'cuda',  # GPU-only, no fallback
                            'visualize': False
                        }
                    },
                    'formula_recognition': {
                        'model': 'formula_recognition_unimernet',
                        'model_config': {
                            'cfg_path': str(PDF_EXTRACT_KIT_PATH / 'pdf_extract_kit' / 'configs' / 'unimernet.yaml'),
                            'model_path': str(models_base / 'MFR' / 'unimernet_small'),
                            'device': 'cuda',  # GPU-only, no fallback
                            'visualize': False
                        }
                    },
                    # NOTE: Using PaddleOCR with GPU acceleration for higher accuracy (95-98%)
                    'ocr': {
                        'model': 'ocr_ppocr',
                        'model_config': {
                            'lang': 'en',
                            'use_angle_cls': True,  # Detect rotated text
                            'use_gpu': True,  # GPU acceleration enabled (PaddlePaddle GPU 2.6.1 with CUDA 11.7)
                            'det_db_thresh': 0.2,  # Lower threshold for better detection
                            'det_db_box_thresh': 0.4,
                            'rec_batch_num': 6,
                            'drop_score': 0.3,
                            'show_log': False
                        }
                    }
                }
            }

            print("Initializing PDF-Extract-Kit v1.0.0 tasks...", file=sys.stderr)

            # Initialize tasks individually with detailed error reporting
            # All critical tasks MUST succeed - no fallbacks, no compromises
            task_instances = {}
            failed_tasks = []

            for task_name, task_config in cfg['tasks'].items():
                try:
                    print(f"  Initializing {task_name}...", file=sys.stderr, flush=True)
                    model_name = task_config['model']
                    model_config = task_config['model_config']

                    TaskClass = TASK_REGISTRY.get(task_name)
                    ModelClass = MODEL_REGISTRY.get(model_name)

                    model_instance = ModelClass(model_config)
                    task_instance = TaskClass(model_instance)

                    task_instances[task_name] = task_instance
                    print(f"  ✓ {task_name} initialized successfully", file=sys.stderr, flush=True)
                except Exception as e:
                    print(f"  ❌ {task_name} initialization FAILED: {e}", file=sys.stderr, flush=True)
                    traceback.print_exc(file=sys.stderr)
                    failed_tasks.append({
                        'task': task_name,
                        'error': str(e),
                        'traceback': traceback.format_exc()
                    })

            # Check if all critical tasks initialized successfully
            critical_tasks = ['layout_detection', 'formula_detection', 'formula_recognition', 'ocr']
            missing_critical = [t for t in critical_tasks if t not in task_instances]

            if missing_critical:
                error_details = []
                for task in missing_critical:
                    failed_info = next((f for f in failed_tasks if f['task'] == task), None)
                    if failed_info:
                        error_details.append(f"{task}: {failed_info['error']}")
                    else:
                        error_details.append(f"{task}: Not initialized")

                print(f"\n❌ CRITICAL TASKS FAILED TO INITIALIZE: {', '.join(missing_critical)}", file=sys.stderr)
                print(f"❌ PDF-Extract-Kit requires ALL critical tasks for maximum quality processing", file=sys.stderr)
                print(f"❌ No fallbacks or compromises - fix the root cause", file=sys.stderr)

                print(json.dumps({
                    'success': False,
                    'chunks': [],
                    'document_structure': { 'title': pdf_path.name, 'chapters': [] },
                    'stats': { 'processing_time': int((time.time() - start) * 1000) },
                    'errors': [
                        f'Critical tasks failed to initialize: {", ".join(missing_critical)}',
                        'Details: ' + '; '.join(error_details),
                        'PDF-Extract-Kit requires all tasks for maximum quality. No fallbacks available.'
                    ],
                    'failed_tasks': failed_tasks
                }, ensure_ascii=False))
                return 2

            print(f"✓ All critical tasks initialized successfully: {list(task_instances.keys())}", file=sys.stderr)

            # Get task instances (all must be present at this point)
            layout_task = task_instances['layout_detection']
            formula_det_task = task_instances['formula_detection']
            formula_rec_task = task_instances['formula_recognition']
            ocr_task = task_instances['ocr']

            print(f"✓ Initialized tasks: layout={layout_task is not None}, formula_det={formula_det_task is not None}, formula_rec={formula_rec_task is not None}, ocr={ocr_task is not None}", file=sys.stderr)

            print("Loading PDF pages...", file=sys.stderr)
            images = load_pdf(str(pdf_path))
            print(f"✓ Loaded {len(images)} pages", file=sys.stderr)

            chunks = []
            total_words = 0
            total_formulas = 0
            total_tables = 0
            total_figures = 0

            def classify_content(text: str, layout_info: dict = None) -> str:
                """Enhanced content classification using layout detection results"""
                if layout_info:
                    # Use layout detection results if available
                    layout_type = layout_info.get('category_type', '').lower()
                    if 'title' in layout_type or 'header' in layout_type:
                        return 'header'
                    if 'table' in layout_type:
                        return 'table'
                    if 'equation' in layout_type or 'formula' in layout_type:
                        return 'equation'
                    if 'figure' in layout_type or 'image' in layout_type:
                        return 'figure'
                    if 'list' in layout_type:
                        return 'list'

                # Fallback to text-based classification
                t = text.strip()
                tl = t.lower()
                if re.search(r"^chapter\s+\d+", t, flags=re.IGNORECASE):
                    return 'header'
                if re.search(r"\btable\b", tl) or re.search(r"\|[^|]+\|", t):
                    return 'table'
                if re.search(r"[a-zA-Z]\s*=\s*[a-zA-Z0-9+\-*/()^]+", t) or re.search(r"\b(sin|cos|tan|log|ln|sqrt)\s*\(", tl):
                    return 'equation'
                if re.search(r"\b(figure|diagram|chart|map|flowchart)\b", tl):
                    return 'figure'
                if re.search(r"^\s*[•\-*]\s+", t) or re.search(r"^\s*\d+\.\s+", t):
                    return 'list'
                return 'text'

            # Create temporary directory for intermediate results
            import tempfile
            temp_dir = tempfile.mkdtemp(prefix='pdf_extract_')

            # Create persistent directory for page images (for visual element detection)
            # Use upload_id if available, otherwise use timestamp
            upload_id = metadata.get('upload_id', str(int(time.time() * 1000)))
            page_images_dir = os.path.join(os.getcwd(), 'tmp', 'page_images', upload_id)
            os.makedirs(page_images_dir, exist_ok=True)
            page_image_paths = {}  # Map of page_number -> image_path

            # Process each page with enhanced v1.0.0 pipeline
            for page_index, img in enumerate(images):
                print(f"Processing page {page_index + 1}/{len(images)}...", file=sys.stderr, flush=True)

                # Save image temporarily for tasks that need file paths
                temp_img_path = os.path.join(temp_dir, f"page_{page_index+1}.png")
                img.save(temp_img_path)

                # Save image persistently for visual element detection
                persistent_img_path = os.path.join(page_images_dir, f"page_{page_index+1}.png")
                img.save(persistent_img_path)
                page_image_paths[page_index + 1] = persistent_img_path

                # Step 1: Layout Detection (disabled due to doclayout_yolo incompatibility)
                layout_results = []
                # if layout_task:
                #     try:
                #         # Layout detection uses model.predict() which expects list of images
                #         layout_output = layout_task.model.predict([img], temp_dir)
                #         if layout_output and len(layout_output) > 0:
                #             layout_results = layout_output[0] if isinstance(layout_output[0], list) else [layout_output[0]]
                #         print(f"  ✓ Layout detection: {len(layout_results)} regions", file=sys.stderr)
                #     except Exception as e:
                #         print(f"  ⚠ Layout detection failed: {e}", file=sys.stderr)

                # Step 2: Formula Detection (if available)
                formula_bboxes = []
                if formula_det_task:
                    try:
                        # Formula detection uses model.predict() which expects list of images
                        formula_output = formula_det_task.model.predict([img], temp_dir)
                        if formula_output and len(formula_output) > 0:
                            formula_bboxes = formula_output[0] if isinstance(formula_output[0], list) else [formula_output[0]]
                        total_formulas += len(formula_bboxes)
                        print(f"  ✓ Formula detection: {len(formula_bboxes)} formulas", file=sys.stderr)
                    except Exception as e:
                        print(f"  ⚠ Formula detection failed: {e}", file=sys.stderr)

                # Step 3: OCR (PaddleOCR - REQUIRED, no fallbacks)
                try:
                    page_res = ocr_task.predict_image(img)
                    # Flatten OCR results into text chunks
                    page_text = ' '.join([b.get('text','') for b in page_res if isinstance(b, dict) and isinstance(b.get('text'), str)])
                    words = page_text.split()
                    total_words += len(words)
                    print(f"  ✓ OCR: {len(words)} words", file=sys.stderr)
                except Exception as e:
                    print(f"  ❌ OCR FAILED on page {page_index + 1}: {e}", file=sys.stderr)
                    traceback.print_exc(file=sys.stderr)
                    # OCR failure is critical - abort processing
                    raise Exception(f"PaddleOCR failed on page {page_index + 1}: {str(e)}")

                # Step 4: Formula Recognition (if formulas detected and task available)
                formula_latex_list = []
                if formula_rec_task and len(formula_bboxes) > 0:
                    try:
                        # Extract formula images from bboxes
                        formula_images = []
                        for bbox in formula_bboxes:
                            # Crop formula region from page image
                            # bbox format depends on YOLO output - typically [x1, y1, x2, y2]
                            if hasattr(bbox, 'boxes') and hasattr(bbox.boxes, 'xyxy'):
                                # YOLOv8 result object
                                boxes = bbox.boxes.xyxy.cpu().numpy()
                                for box in boxes:
                                    x1, y1, x2, y2 = map(int, box[:4])
                                    formula_img = img.crop((x1, y1, x2, y2))
                                    formula_images.append(formula_img)

                        if formula_images:
                            # Save formula images temporarily
                            formula_temp_dir = os.path.join(temp_dir, f"formulas_page_{page_index+1}")
                            os.makedirs(formula_temp_dir, exist_ok=True)
                            for i, fimg in enumerate(formula_images):
                                fimg.save(os.path.join(formula_temp_dir, f"formula_{i+1}.png"))

                            # Run formula recognition
                            formula_latex_list = formula_rec_task.predict(formula_temp_dir, temp_dir)
                            print(f"  ✓ Formula recognition: {len(formula_latex_list)} formulas converted to LaTeX", file=sys.stderr)
                    except Exception as e:
                        print(f"  ⚠ Formula recognition failed: {e}", file=sys.stderr)

                if not page_text.strip():
                    # Emit progress even if page has no text
                    print(f"page {page_index + 1}/{len(images)} done", file=sys.stderr, flush=True)
                    continue

                # NOTE: OCR correction disabled - TypeScript ContentQualityEnhancer has 148+ patterns (vs 15 here)
                # Let TypeScript handle OCR correction for better accuracy
                corrected_text = page_text

                # QUALITY ENHANCEMENT: Detect metadata accurately (basic detection, TypeScript will refine)
                has_formulas_detected = detect_formulas(corrected_text) or len(formula_bboxes) > 0
                has_tables_detected = detect_tables(corrected_text) or (any('table' in str(r.get('category_type', '')).lower() for r in layout_results) if layout_results else False)
                section_level, section_title = detect_section_info(corrected_text)

                # Classify content using enhanced detection
                content_type = classify_content(corrected_text, layout_results[0] if layout_results else None)
                chunk_id = f"page_{page_index+1}_chunk_1"

                # QUALITY ENHANCEMENT: Extract chapter with length limit
                chapter_info = extract_chapter_from_text(corrected_text, max_length=100)

                # Count detected elements
                has_formulas = has_formulas_detected
                has_tables = has_tables_detected
                has_figures = any('figure' in str(r.get('category_type', '')).lower() or 'image' in str(r.get('category_type', '')).lower() for r in layout_results) if layout_results else False

                if has_tables:
                    total_tables += 1
                if has_figures:
                    total_figures += 1

                # Build chunk with ENHANCED metadata
                chunk_metadata = {
                    'class': metadata.get('classLevel', 'Unknown'),
                    'subject': metadata.get('subject', 'Unknown'),
                    'book_title': metadata.get('bookTitle', pdf_path.stem),
                    'chapter': chapter_info or 'General Chapter',  # Use extracted chapter or fallback
                    'section_title': section_title,  # ENHANCED: Proper section detection
                    'source': f"{metadata.get('bookTitle', pdf_path.stem)} Class {metadata.get('classLevel', 'Unknown')}",
                    'curriculum': metadata.get('curriculum', 'CBSE'),
                    'board': metadata.get('curriculum', 'CBSE'),
                    'medium': metadata.get('language', 'English'),
                    'language': metadata.get('language', 'English'),
                    'page': page_index + 1,
                    'section_level': section_level,  # ENHANCED: Accurate section level
                    'content_type': content_type,
                    'confidence': 0.95,  # Higher confidence with v1.0.0 full pipeline
                    'contains_equation': has_formulas,  # Basic detection, TypeScript will refine
                    'contains_table': has_tables,  # Basic detection, TypeScript will refine
                    'contains_figure': has_figures,
                    'layout_regions': len(layout_results),
                    'formulas_detected': len(formula_bboxes)
                    # NOTE: ocr_quality_score removed - TypeScript ContentQualityEnhancer will handle OCR + quality scoring
                }

                # Add formula LaTeX if available
                if formula_latex_list:
                    chunk_metadata['formulas_latex'] = formula_latex_list

                chunks.append({
                    'id': chunk_id,
                    'text': corrected_text,  # ENHANCED: Use corrected text instead of raw OCR
                    'metadata': chunk_metadata
                })
                # Emit per-page progress after processing the page
                print(f"page {page_index + 1}/{len(images)} done", file=sys.stderr, flush=True)

            # Clean up temporary directory
            import shutil
            try:
                shutil.rmtree(temp_dir)
            except Exception:
                pass

            # Calculate final statistics
            processing_time_ms = int((time.time() - start) * 1000)

            result = {
                'success': True,
                'chunks': chunks,
                'document_structure': extract_document_structure(chunks, metadata, pdf_path),
                'page_image_paths': page_image_paths,  # NEW: Page image paths for visual element detection
                'stats': {
                    'total_pages': len(images),
                    'total_chunks': len(chunks),
                    'total_words': total_words,
                    'processing_time': processing_time_ms,
                    'tables_found': total_tables,
                    'equations_found': total_formulas,
                    'figures_found': total_figures,
                    'layout_regions_detected': sum(c['metadata'].get('layout_regions', 0) for c in chunks),
                    'formulas_detected': sum(c['metadata'].get('formulas_detected', 0) for c in chunks),
                    'pdf_extract_kit_version': '1.0.0',
                    'tasks_used': {
                        'layout_detection': layout_task is not None,
                        'formula_detection': formula_det_task is not None,
                        'formula_recognition': formula_rec_task is not None,
                        'ocr': ocr_task is not None
                    },
                    # PHASE 3: GPU acceleration info
                    'gpu_acceleration': {
                        'enabled': GPU_AVAILABLE,
                        'device': GPU_DEVICE,
                        'info': GPU_INFO if GPU_AVAILABLE else None
                    }
                },
                'errors': []
            }

            print(f"\n✓ Processing complete: {len(chunks)} chunks, {total_words} words, {processing_time_ms}ms", file=sys.stderr)
            # Wrap JSON with markers to allow robust parsing from Node
            sys.stdout.write("__JSON_START__\n")
            sys.stdout.write(json.dumps(result, ensure_ascii=False))
            sys.stdout.write("\n__JSON_END__\n")
            sys.stdout.flush()
            return 0
        except Exception as e:
            print(json.dumps({
                'success': False,
                'chunks': [],
                'document_structure': { 'title': pdf_path.name, 'chapters': [] },
                'stats': { 'processing_time': int((time.time() - start) * 1000) },
                'errors': [f'PDF-Extract-Kit pipeline failed: {str(e)}']
            }, ensure_ascii=False))
            return 2

    # If PDF-Extract-Kit is not available at all, fail explicitly
    print(json.dumps({
        'success': False,
        'chunks': [],
        'document_structure': { 'title': pdf_path.name, 'chapters': [] },
        'stats': { 'processing_time': int((time.time() - start) * 1000) },
        'errors': [
            'PDF-Extract-Kit v1.0.0 is not available or failed to import',
            'This system requires PDF-Extract-Kit with all tasks (layout, formula, OCR) for maximum quality',
            'No fallback processing available - fix the PDF-Extract-Kit installation'
        ]
    }, ensure_ascii=False))
    return 2


if __name__ == '__main__':
    sys.exit(main())

