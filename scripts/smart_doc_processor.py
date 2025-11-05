#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Smart Document Processor - Intelligent Text Extraction Wrapper

This script wraps doc_extract_engine_processor.py with smart text extraction:
1. Assesses PDF text quality first
2. Uses direct text extraction for PDFs with good embedded text (10-50x faster)
3. Falls back to PDF-Extract-Kit full pipeline only when necessary

Usage:
  python scripts/smart_doc_processor.py <pdf_path> --metadata '{...}' [--strategy auto]

Strategy options:
  auto (default) - Automatically choose best strategy based on text quality
  text_only - Force text extraction only (fast, but may miss scanned content)
  ocr_only - Force PDF-Extract-Kit full pipeline (slow, but handles everything)
  mixed - Force hybrid approach
  force_pdf_extract_kit - Always use full pipeline (for testing)
"""

import argparse
import json
import os
import re
import sys
import io
import time
from pathlib import Path

# Set UTF-8 encoding for stdout/stderr on Windows to handle emojis
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Add project root to path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# GPU Detection and Configuration
GPU_AVAILABLE = False
GPU_DEVICE = 'cpu'
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
        print("⚠ GPU not available - using CPU (slower)", file=sys.stderr)
except ImportError:
    print("⚠ PyTorch not installed - using CPU", file=sys.stderr)

# Import smart processor
from scripts.smart_pdf_processor import SmartPDFProcessor, print_recommendation_report

# Import PyMuPDF for text extraction
try:
    import fitz
    HAVE_PYMUPDF = True
except ImportError:
    HAVE_PYMUPDF = False
    print("ERROR: PyMuPDF is required", file=sys.stderr)
    sys.exit(1)


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


def extract_with_text_only(pdf_path: Path, metadata: dict) -> dict:
    """
    Extract text directly from PDF using PyMuPDF (fast path)
    
    This bypasses PDF-Extract-Kit entirely and extracts embedded text.
    10-50x faster than OCR-based extraction.
    """
    print("📄 Using TEXT-ONLY extraction (embedded text)...", file=sys.stderr)
    
    doc = fitz.open(str(pdf_path))
    chunks = []
    total_words = 0
    total_pages = len(doc)
    
    for page_num in range(total_pages):
        page = doc[page_num]
        text = page.get_text()
        
        if not text.strip():
            continue
        
        # Split into chunks (500 words each with 50 word overlap)
        words = text.split()
        chunk_size = 500
        overlap = 50
        
        for i in range(0, len(words), chunk_size - overlap):
            chunk_words = words[i:i + chunk_size]
            if len(chunk_words) < 50:  # Skip very short chunks
                continue
            
            chunk_text = ' '.join(chunk_words)
            chunk_id = f"page_{page_num + 1}_chunk_{i // (chunk_size - overlap) + 1}"
            
            chunks.append({
                'id': chunk_id,
                'text': chunk_text,
                'metadata': {
                    # FIX #3: Add class level normalization
                    'class': normalize_class_level(metadata.get('classLevel', 'Unknown')),
                    'subject': metadata.get('subject', 'Unknown'),
                    # FIX #1: Add book_title field (not just source)
                    'book_title': metadata.get('bookTitle', pdf_path.stem),
                    # FIX #1: Add chapter field
                    'chapter': 'General Chapter',  # TODO: Implement chapter detection
                    # FIX #1: Add section_title field
                    'section_title': 'General Section',  # TODO: Implement section detection
                    'source': metadata.get('bookTitle', pdf_path.name),
                    'curriculum': metadata.get('curriculum', 'CBSE'),
                    # FIX #1: Add board field
                    'board': metadata.get('curriculum', 'CBSE'),
                    # FIX #1: Add medium field
                    'medium': metadata.get('language', 'English'),
                    'language': metadata.get('language', 'English'),
                    'page': page_num + 1,
                    # FIX #1: Add section_level field
                    'section_level': 0,  # 0 = unknown section level
                    'content_type': 'text',
                    'confidence': 0.95,  # High confidence for embedded text
                    'extraction_method': 'embedded_text',
                    'contains_equation': bool(re.search(r'[=+\-*/∑∫√π∆∇∂]', chunk_text)),
                    'contains_table': bool(re.search(r'\b(?:table|row|column)\b', chunk_text.lower())),
                    'contains_figure': bool(re.search(r'\b(?:figure|diagram|chart)\b', chunk_text.lower()))
                }
            })
            
            total_words += len(chunk_words)
        
        # Emit progress
        print(f"page {page_num + 1}/{total_pages} done", file=sys.stderr, flush=True)
    
    doc.close()
    
    return {
        'success': True,
        'chunks': chunks,
        'document_structure': {
            'title': metadata.get('bookTitle', pdf_path.name),
            'chapters': []
        },
        'stats': {
            'total_pages': total_pages,
            'total_chunks': len(chunks),
            'total_words': total_words,
            'tables_found': sum(1 for c in chunks if c['metadata']['contains_table']),
            'equations_found': sum(1 for c in chunks if c['metadata']['contains_equation']),
            'figures_found': sum(1 for c in chunks if c['metadata']['contains_figure']),
            'extraction_method': 'text_only',
            'processing_time': 0  # Will be set by caller
        },
        'errors': []
    }


def extract_with_pdf_extract_kit(pdf_path: Path, metadata: dict) -> dict:
    """
    Extract using PDF-Extract-Kit full pipeline (slow path)
    
    This invokes the full vision-based pipeline with GPU acceleration.
    Handles scanned PDFs, formulas, tables, and complex layouts.
    """
    print("🔧 Using PDF-Extract-Kit full pipeline (OCR + vision models)...", file=sys.stderr)
    
    # Import and call the original processor
    import subprocess
    
    args = [
        sys.executable,
        str(ROOT_DIR / 'scripts' / 'doc_extract_engine_processor.py'),
        str(pdf_path),
        '--metadata', json.dumps(metadata)
    ]
    
    result = subprocess.run(args, capture_output=True, text=True)
    
    if result.returncode != 0:
        return {
            'success': False,
            'chunks': [],
            'document_structure': {'title': pdf_path.name, 'chapters': []},
            'stats': {'processing_time': 0},
            'errors': [f'PDF-Extract-Kit failed: {result.stderr}']
        }
    
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return {
            'success': False,
            'chunks': [],
            'document_structure': {'title': pdf_path.name, 'chapters': []},
            'stats': {'processing_time': 0},
            'errors': ['Failed to parse PDF-Extract-Kit output']
        }


def main() -> int:
    parser = argparse.ArgumentParser(description='Smart PDF processor with text-first strategy')
    parser.add_argument('pdf_path', help='Path to input PDF file')
    parser.add_argument('--metadata', help='JSON metadata string', default='{}')
    parser.add_argument('--strategy', help='Extraction strategy', 
                       choices=['auto', 'text_only', 'ocr_only', 'mixed', 'force_pdf_extract_kit'],
                       default=None)
    args = parser.parse_args()
    
    start_time = time.time()
    pdf_path = Path(args.pdf_path)
    
    # Basic checks
    if not pdf_path.exists():
        print(json.dumps({
            'success': False,
            'chunks': [],
            'document_structure': {'title': pdf_path.name, 'chapters': []},
            'stats': {'processing_time': 0},
            'errors': [f'File not found: {pdf_path}']
        }))
        return 1
    
    try:
        metadata = json.loads(args.metadata or '{}')
    except Exception:
        metadata = {}
    
    # Get strategy from environment or argument
    strategy = args.strategy or os.environ.get('TEXT_EXTRACTION_STRATEGY', 'auto')
    
    # Create smart processor
    processor = SmartPDFProcessor(quality_threshold=0.8)
    
    # Get recommendation
    recommendation = processor.get_processing_recommendation(str(pdf_path), strategy if strategy != 'auto' else None)
    
    # Print recommendation to stderr (for logging)
    print_recommendation_report(recommendation)
    
    # Execute based on strategy
    final_strategy = recommendation['strategy']
    
    if final_strategy == 'text_only':
        result = extract_with_text_only(pdf_path, metadata)
    elif final_strategy in ['ocr_only', 'force_pdf_extract_kit']:
        result = extract_with_pdf_extract_kit(pdf_path, metadata)
    elif final_strategy == 'mixed':
        # TODO: Implement hybrid approach
        # For now, fall back to PDF-Extract-Kit
        print("⚠️  Mixed strategy not yet implemented, using PDF-Extract-Kit", file=sys.stderr)
        result = extract_with_pdf_extract_kit(pdf_path, metadata)
    else:
        result = extract_with_pdf_extract_kit(pdf_path, metadata)
    
    # Add processing time
    processing_time = int((time.time() - start_time) * 1000)
    result['stats']['processing_time'] = processing_time
    
    # Add strategy info
    result['stats']['extraction_strategy'] = final_strategy
    result['stats']['text_quality_ratio'] = recommendation['statistics']['text_quality_ratio']
    
    # Output JSON to stdout
    print(json.dumps(result, ensure_ascii=False))
    
    return 0 if result['success'] else 1


if __name__ == '__main__':
    # Import re for text extraction
    import re
    sys.exit(main())

