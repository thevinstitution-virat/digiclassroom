import os
import json
from pathlib import Path
from typing import Any, Dict

# This adapter wraps the cloned PDF-Extract-Kit repo and exposes a stable
# extract_pdf(pdf_path, config_path, metadata) API that returns the JSON
# the Node bridge expects.

REPO_DIR = Path(__file__).resolve().parent.parent / 'vendor' / 'PDF-Extract-Kit'

# Lazy import of toolkit modules when available
_TOOLKIT_READY = False

def _ensure_toolkit_imported() -> None:
    global _TOOLKIT_READY
    if _TOOLKIT_READY:
        return
    # Here we would add REPO_DIR to sys.path and import toolkit entrypoints
    import sys
    if str(REPO_DIR) not in sys.path:
        sys.path.insert(0, str(REPO_DIR))
    _TOOLKIT_READY = True


def extract_pdf(pdf_path: str, config_path: str | None, metadata: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute PDF-Extract-Kit processing and map to DigiClassroom JSON.
    """
    _ensure_toolkit_imported()

    # Placeholder: integrate actual toolkit pipeline here.
    # For now, emit a minimal JSON that matches our TypeScript normalizer.
    pdf_name = Path(pdf_path).name
    chunks = []

    # Basic single-chunk placeholder so the pipeline is wired
    chunks.append({
        'id': 'chunk_1',
        'text': f'Processed content from {pdf_name} (placeholder)',
        'metadata': {
            'class': metadata.get('classLevel') or 'Unknown',
            'subject': metadata.get('subject') or 'Unknown',
            'source': metadata.get('bookTitle') or pdf_name,
            'curriculum': metadata.get('curriculum') or 'CBSE',
            'page': 1,
            'section_level': 2,
            'content_type': 'text',
            'confidence': 0.9,
        }
    })

    return {
        'success': True,
        'chunks': chunks,
        'document_structure': {
            'title': metadata.get('bookTitle') or Path(pdf_path).stem,
            'chapters': []
        },
        'stats': {
            'total_pages': 1,
            'total_chunks': len(chunks),
            'total_words': sum(len(c['text'].split()) for c in chunks),
            'processing_time': 0,
            'tables_found': 0,
            'equations_found': 0,
            'figures_found': 0,
            'extraction_method': 'doc-extract-engine'
        },
        'errors': []
    }

