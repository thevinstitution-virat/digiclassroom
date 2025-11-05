#!/usr/bin/env python3
"""
Bridge script to invoke PDF-Extract-Kit and emit JSON for Node integration.
Usage:
  python scripts/pdf_extract_kit_processor.py <pdf_path> --metadata '{...}' [--config path]

Outputs a single JSON object to stdout with fields:
  success, chunks, document_structure, stats, errors

Environment variables:
  DOC_EXTRACT_ENGINE_MODELS_PATH (optional)
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path
import re

# Ensure project root is on sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Add vendor/PDF-Extract-Kit to path
PDF_EXTRACT_KIT_PATH = ROOT_DIR / 'vendor' / 'PDF-Extract-Kit'
if str(PDF_EXTRACT_KIT_PATH) not in sys.path:
    sys.path.insert(0, str(PDF_EXTRACT_KIT_PATH))

# Try to import PyMuPDF for reliable PDF processing
HAVE_PYMUPDF = False
try:
    import fitz
    HAVE_PYMUPDF = True
except Exception:
    pass


def load_config(config_path: str | None) -> dict:
    if not config_path:
        return {}
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}


def extract_text_with_pymupdf(pdf_path: Path, metadata: dict) -> dict:
    """Extract text using PyMuPDF - handles any number of pages"""
    try:
        doc = fitz.open(str(pdf_path))
        chunks = []
        total_words = 0
        total_pages = len(doc)

        print(f"Processing {total_pages} pages...", file=sys.stderr)

        for page_num in range(total_pages):
            page = doc[page_num]
            text = page.get_text()

            if not text.strip():
                continue

            # Split text into manageable chunks (approximately 400-600 words each)
            words = text.split()
            chunk_size = 500
            overlap = 50  # Small overlap between chunks

            for i in range(0, len(words), chunk_size - overlap):
                chunk_words = words[i:i + chunk_size]
                chunk_text = ' '.join(chunk_words)

                if len(chunk_text.strip()) < 100:  # Skip very short chunks
                    continue

                chunk_id = f"page_{page_num + 1}_chunk_{i // (chunk_size - overlap) + 1}"

                # Enhanced content type detection
                content_type = 'text'
                if re.search(r'\b(?:table|figure|diagram|chart|graph|image)\b', chunk_text.lower()):
                    content_type = 'mixed'
                elif re.search(r'[=+\-*/∑∫√π]', chunk_text):
                    content_type = 'equation'

                # Enhanced section level detection
                section_level = 4  # Default to paragraph level
                if re.search(r'^(Chapter|Unit|Part)\s+\d+', chunk_text, re.MULTILINE):
                    section_level = 1
                elif re.search(r'^\d+\.\s+[A-Z][^.]*$', chunk_text, re.MULTILINE):
                    section_level = 2
                elif re.search(r'^\d+\.\d+\s+[A-Z]', chunk_text, re.MULTILINE):
                    section_level = 3

                # Extract section title
                section_title = None
                title_match = re.search(r'^(Chapter|Unit|\d+\.(?:\d+\.)*)\s*([^\n]+)', chunk_text, re.MULTILINE)
                if title_match:
                    section_title = title_match.group(0).strip()

                chunks.append({
                    'id': chunk_id,
                    'text': chunk_text,
                    'metadata': {
                        'class': metadata.get('classLevel', 'Unknown'),
                        'subject': metadata.get('subject', 'Unknown'),
                        'source': metadata.get('bookTitle', pdf_path.name),
                        'curriculum': metadata.get('curriculum', 'CBSE'),
                        'language': metadata.get('language', 'English'),
                        'page': page_num + 1,
                        'section_level': section_level,
                        'section_title': section_title,
                        'content_type': content_type,
                        'confidence': 0.9,
                        'contains_equation': bool(re.search(r'[=+\-*/∑∫√π∆∇∂]', chunk_text)),
                        'contains_table': bool(re.search(r'\b(?:table|row|column|cell)\b', chunk_text.lower())),
                        'contains_figure': bool(re.search(r'\b(?:figure|diagram|chart|graph|image)\b', chunk_text.lower()))
                    }
                })

                total_words += len(chunk_words)

        doc.close()

        # Extract document structure
        document_structure = extract_document_structure(chunks, metadata, pdf_path)

        print(f"Extracted {len(chunks)} chunks from {total_pages} pages", file=sys.stderr)

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
                'figures_found': sum(1 for c in chunks if c['metadata']['contains_figure']),
                'extraction_method': 'PyMuPDF'
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

def extract_document_structure(chunks: list, metadata: dict, pdf_path: Path) -> dict:
    """Extract document structure from chunks"""
    structure = {
        'title': metadata.get('bookTitle', pdf_path.stem),
        'chapters': []
    }

    current_chapter = None
    chapter_num = 0

    for chunk in chunks:
        text = chunk['text']

        # Look for chapter markers
        chapter_match = re.search(r'(Chapter|Unit|Part)\s+(\d+)[:\s]*([^\n]*)', text, re.IGNORECASE)
        if chapter_match:
            chapter_num += 1
            current_chapter = {
                'id': f'chapter_{chapter_num}',
                'title': chapter_match.group(0).strip(),
                'page': chunk['metadata']['page'],
                'sections': []
            }
            structure['chapters'].append(current_chapter)

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
    except Exception as e:
        metadata = {}

    config = load_config(args.config)

    # Use PyMuPDF for reliable PDF processing
    if HAVE_PYMUPDF:
        result = extract_text_with_pymupdf(pdf_path, metadata)
        result['stats']['processing_time'] = int((time.time() - start) * 1000)
        print(json.dumps(result, ensure_ascii=False))
        return 0

    # If no extraction method available
    print(json.dumps({
        'success': False,
        'chunks': [],
        'document_structure': { 'title': pdf_path.name, 'chapters': [] },
        'stats': {
            'total_pages': 0,
            'total_chunks': 0,
            'total_words': 0,
            'processing_time': int((time.time() - start) * 1000),
            'tables_found': 0,
            'equations_found': 0,
            'figures_found': 0
        },
        'errors': ['No PDF processing library available (PyMuPDF required)']
    }))
    return 2


if __name__ == '__main__':
    sys.exit(main())

