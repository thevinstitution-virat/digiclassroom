#!/usr/bin/env python3
"""
Smart Text Extraction with Text-First, OCR-Secondary Strategy

This module implements intelligent text extraction that:
1. Checks for embedded text quality in PDFs
2. Uses embedded text when available (fast, accurate)
3. Falls back to OCR only when necessary (slow, but handles scanned PDFs)

This avoids the inefficiency of PDF-Extract-Kit's default behavior which
ALWAYS converts PDFs to images and runs OCR, even on PDFs with perfect text.
"""

import fitz  # PyMuPDF
from PIL import Image
from typing import Tuple, List, Dict, Optional
import re


class TextQualityMetrics:
    """Metrics for assessing embedded text quality"""
    
    def __init__(self, text: str, page_area: float):
        self.text = text
        self.page_area = page_area
        self.word_count = len(text.split())
        self.char_count = len(text)
        self.has_text = bool(text.strip())
        
    @property
    def text_density(self) -> float:
        """Characters per square inch (rough estimate)"""
        if self.page_area == 0:
            return 0
        return self.char_count / self.page_area
    
    @property
    def has_meaningful_text(self) -> bool:
        """Check if text contains meaningful content"""
        if not self.has_text:
            return False
        
        # Check for minimum word count
        if self.word_count < 10:
            return False
        
        # Check for reasonable character distribution
        # (not just garbage characters)
        alphanumeric_ratio = sum(c.isalnum() for c in self.text) / max(len(self.text), 1)
        if alphanumeric_ratio < 0.5:
            return False
        
        return True
    
    @property
    def is_high_quality(self) -> bool:
        """Determine if embedded text is high quality"""
        if not self.has_meaningful_text:
            return False
        
        # Check text density (scanned PDFs often have sparse/garbled text)
        if self.text_density < 0.1:  # Very sparse text
            return False
        
        # Check for common OCR artifacts in embedded text
        # (Some PDFs have embedded OCR that's poor quality)
        ocr_artifacts = [
            r'[^\x00-\x7F]{10,}',  # Long sequences of non-ASCII
            r'(.)\1{10,}',  # Repeated characters (e.g., "aaaaaaaaaa")
            r'\s{5,}',  # Excessive whitespace
        ]
        
        for pattern in ocr_artifacts:
            if re.search(pattern, self.text):
                return False
        
        return True


def assess_page_text_quality(page: fitz.Page) -> TextQualityMetrics:
    """
    Assess the quality of embedded text in a PDF page
    
    Args:
        page: PyMuPDF page object
        
    Returns:
        TextQualityMetrics object with quality assessment
    """
    # Extract embedded text
    text = page.get_text()
    
    # Get page dimensions (in points, 72 points = 1 inch)
    rect = page.rect
    page_area = (rect.width / 72) * (rect.height / 72)  # Square inches
    
    return TextQualityMetrics(text, page_area)


def extract_text_smart(
    pdf_path: str,
    quality_threshold: float = 0.8,
    dpi: int = 144
) -> Tuple[List[Dict], Dict]:
    """
    Smart text extraction with text-first, OCR-secondary strategy
    
    Args:
        pdf_path: Path to PDF file
        quality_threshold: Minimum ratio of pages with good text to use text-only mode
        dpi: DPI for image conversion (only used if OCR is needed)
        
    Returns:
        Tuple of (pages_data, extraction_stats)
        
    pages_data format:
        [
            {
                'page_number': int,
                'text': str,
                'extraction_method': 'embedded_text' | 'ocr_required',
                'image': PIL.Image | None,  # Only if OCR required
                'quality_metrics': {
                    'word_count': int,
                    'char_count': int,
                    'text_density': float,
                    'is_high_quality': bool
                }
            },
            ...
        ]
    """
    doc = fitz.open(pdf_path)
    pages_data = []
    stats = {
        'total_pages': len(doc),
        'pages_with_good_text': 0,
        'pages_needing_ocr': 0,
        'extraction_mode': None,  # 'text_only', 'ocr_only', 'mixed'
        'text_quality_ratio': 0.0
    }
    
    # Phase 1: Assess text quality for all pages
    print(f"📊 Assessing text quality for {len(doc)} pages...", flush=True)
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        quality = assess_page_text_quality(page)
        
        page_data = {
            'page_number': page_num + 1,
            'text': quality.text,
            'extraction_method': 'embedded_text' if quality.is_high_quality else 'ocr_required',
            'image': None,
            'quality_metrics': {
                'word_count': quality.word_count,
                'char_count': quality.char_count,
                'text_density': quality.text_density,
                'is_high_quality': quality.is_high_quality,
                'has_meaningful_text': quality.has_meaningful_text
            }
        }
        
        pages_data.append(page_data)
        
        if quality.is_high_quality:
            stats['pages_with_good_text'] += 1
        else:
            stats['pages_needing_ocr'] += 1
    
    # Calculate text quality ratio
    stats['text_quality_ratio'] = stats['pages_with_good_text'] / max(stats['total_pages'], 1)
    
    # Phase 2: Determine extraction strategy
    if stats['text_quality_ratio'] >= quality_threshold:
        # Most pages have good text - use text-only mode
        stats['extraction_mode'] = 'text_only'
        print(f"✅ Using TEXT-ONLY mode: {stats['pages_with_good_text']}/{stats['total_pages']} pages have good embedded text")
        print(f"   ⚡ Performance: ~10-50x faster than OCR!")
        
    elif stats['text_quality_ratio'] == 0:
        # No pages have good text - use OCR-only mode
        stats['extraction_mode'] = 'ocr_only'
        print(f"📸 Using OCR-ONLY mode: No embedded text found (scanned PDF)")
        print(f"   Converting all pages to images for OCR...")
        
        # Convert all pages to images
        for page_num in range(len(doc)):
            page = doc[page_num]
            pix = page.get_pixmap(matrix=fitz.Matrix(dpi/72, dpi/72))
            image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            
            # Reduce image size if too large
            if pix.width > 3000 or pix.height > 3000:
                pix = page.get_pixmap(matrix=fitz.Matrix(1, 1), alpha=False)
                image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            
            pages_data[page_num]['image'] = image
            
    else:
        # Mixed quality - use hybrid mode
        stats['extraction_mode'] = 'mixed'
        print(f"🔀 Using MIXED mode: {stats['pages_with_good_text']} pages with text, {stats['pages_needing_ocr']} need OCR")
        
        # Convert only pages that need OCR to images
        for page_num in range(len(doc)):
            if pages_data[page_num]['extraction_method'] == 'ocr_required':
                page = doc[page_num]
                pix = page.get_pixmap(matrix=fitz.Matrix(dpi/72, dpi/72))
                image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                
                if pix.width > 3000 or pix.height > 3000:
                    pix = page.get_pixmap(matrix=fitz.Matrix(1, 1), alpha=False)
                    image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                
                pages_data[page_num]['image'] = image
    
    doc.close()
    
    return pages_data, stats


def get_images_for_ocr(pages_data: List[Dict]) -> List[Image.Image]:
    """
    Extract images that need OCR processing
    
    Args:
        pages_data: Output from extract_text_smart()
        
    Returns:
        List of PIL Images that need OCR (in page order)
    """
    images = []
    for page_data in pages_data:
        if page_data['image'] is not None:
            images.append(page_data['image'])
    return images


def get_text_pages(pages_data: List[Dict]) -> Dict[int, str]:
    """
    Extract pages that already have good embedded text
    
    Args:
        pages_data: Output from extract_text_smart()
        
    Returns:
        Dictionary mapping page_number -> text for pages with embedded text
    """
    text_pages = {}
    for page_data in pages_data:
        if page_data['extraction_method'] == 'embedded_text':
            text_pages[page_data['page_number']] = page_data['text']
    return text_pages


# Example usage
if __name__ == '__main__':
    import sys
    import json
    
    if len(sys.argv) < 2:
        print("Usage: python smart_text_extractor.py <pdf_path>")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    
    # Extract with smart strategy
    pages_data, stats = extract_text_smart(pdf_path)
    
    # Print statistics
    print("\n" + "="*70)
    print("EXTRACTION STATISTICS")
    print("="*70)
    print(json.dumps(stats, indent=2))
    
    # Print sample from first page
    if pages_data:
        print("\n" + "="*70)
        print("FIRST PAGE SAMPLE")
        print("="*70)
        first_page = pages_data[0]
        print(f"Page: {first_page['page_number']}")
        print(f"Method: {first_page['extraction_method']}")
        print(f"Quality: {first_page['quality_metrics']}")
        print(f"Text preview: {first_page['text'][:500]}...")

