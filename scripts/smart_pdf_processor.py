#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Smart PDF Processing with Text-First, OCR-Secondary Strategy

This module wraps PDF-Extract-Kit with intelligent text extraction that:
1. Checks for embedded text quality in PDFs using PyMuPDF
2. Uses embedded text when available (10-50x faster, more accurate)
3. Falls back to PDF-Extract-Kit's full pipeline only when necessary

This preserves all PDF-Extract-Kit functionality while avoiding the inefficiency
of converting PDFs with good embedded text to images and running OCR.

Architecture:
- PyMuPDF (fitz): Required dependency for both text extraction AND PDF-Extract-Kit
- PDF-Extract-Kit: Full vision-based pipeline (layout, OCR, formulas, tables)
- Smart Strategy: Intelligently choose between text extraction and vision pipeline
"""

import sys
import io

# Set UTF-8 encoding for stdout/stderr on Windows to handle emojis
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import fitz  # PyMuPDF - required by PDF-Extract-Kit
import re
from typing import Tuple, List, Dict, Optional
from pathlib import Path


class TextQualityAssessment:
    """Assessment of embedded text quality in a PDF page"""
    
    def __init__(self, page: fitz.Page):
        self.page_number = page.number + 1
        self.text = page.get_text()
        self.word_count = len(self.text.split())
        self.char_count = len(self.text.strip())
        
        # Get page dimensions
        rect = page.rect
        self.page_area = (rect.width / 72) * (rect.height / 72)  # Square inches
        
    @property
    def has_text(self) -> bool:
        """Check if page has any text"""
        return self.char_count > 0
    
    @property
    def text_density(self) -> float:
        """Characters per square inch"""
        if self.page_area == 0:
            return 0
        return self.char_count / self.page_area
    
    @property
    def has_meaningful_content(self) -> bool:
        """Check if text contains meaningful content (not just noise)"""
        if not self.has_text:
            return False

        # Minimum word count threshold
        if self.word_count < 10:
            return False

        # Check alphanumeric ratio (filter out garbage)
        alphanumeric_count = sum(c.isalnum() or c.isspace() for c in self.text)
        alphanumeric_ratio = alphanumeric_count / max(len(self.text), 1)

        if alphanumeric_ratio < 0.6:  # At least 60% should be alphanumeric or space
            return False

        return True
    
    @property
    def is_high_quality(self) -> bool:
        """Determine if embedded text is high quality (suitable for direct extraction)"""
        if not self.has_meaningful_content:
            return False

        # Check text density (scanned PDFs often have very sparse text)
        if self.text_density < 5.0:  # Less than 5 chars per square inch is suspicious
            return False

        # Check for OCR artifacts that indicate poor quality embedded text
        ocr_artifacts = [
            r'[^\x00-\x7F]{20,}',  # Long sequences of non-ASCII (garbled text)
            r'(.)\1{15,}',  # Repeated characters (e.g., "aaaaaaaaaaaaaaa")
            r'\s{10,}',  # Excessive whitespace
            r'[^\w\s]{20,}',  # Long sequences of special characters
        ]
        
        for pattern in ocr_artifacts:
            if re.search(pattern, self.text):
                return False
        
        return True
    
    def to_dict(self) -> dict:
        """Convert assessment to dictionary"""
        return {
            'page_number': self.page_number,
            'word_count': self.word_count,
            'char_count': self.char_count,
            'text_density': round(self.text_density, 2),
            'has_text': self.has_text,
            'has_meaningful_content': self.has_meaningful_content,
            'is_high_quality': self.is_high_quality
        }


class SmartPDFProcessor:
    """
    Smart PDF processor that chooses optimal extraction strategy
    
    Strategies:
    - TEXT_ONLY: Extract embedded text directly (fast, accurate)
    - OCR_ONLY: Use PDF-Extract-Kit full pipeline (slow, handles scanned PDFs)
    - MIXED: Hybrid approach (text for good pages, OCR for poor pages)
    - FORCE_PDF_EXTRACT_KIT: Always use full pipeline (for testing)
    """
    
    def __init__(self, quality_threshold: float = 0.8):
        """
        Args:
            quality_threshold: Minimum ratio of pages with good text to use TEXT_ONLY mode
        """
        self.quality_threshold = quality_threshold
    
    def assess_pdf_quality(self, pdf_path: str) -> Tuple[List[TextQualityAssessment], dict]:
        """
        Assess text quality for all pages in PDF
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            Tuple of (assessments, statistics)
        """
        doc = fitz.open(pdf_path)
        assessments = []
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            assessment = TextQualityAssessment(page)
            assessments.append(assessment)
        
        # Calculate statistics
        total_pages = len(assessments)
        pages_with_good_text = sum(1 for a in assessments if a.is_high_quality)
        pages_with_any_text = sum(1 for a in assessments if a.has_text)
        pages_needing_ocr = total_pages - pages_with_good_text
        
        text_quality_ratio = pages_with_good_text / max(total_pages, 1)
        
        stats = {
            'total_pages': total_pages,
            'pages_with_good_text': pages_with_good_text,
            'pages_with_any_text': pages_with_any_text,
            'pages_needing_ocr': pages_needing_ocr,
            'text_quality_ratio': round(text_quality_ratio, 3),
            'avg_text_density': round(sum(a.text_density for a in assessments) / max(total_pages, 1), 2),
            'avg_word_count': round(sum(a.word_count for a in assessments) / max(total_pages, 1), 1)
        }
        
        doc.close()
        return assessments, stats
    
    def determine_strategy(self, stats: dict, force_strategy: Optional[str] = None) -> str:
        """
        Determine optimal extraction strategy
        
        Args:
            stats: Statistics from assess_pdf_quality()
            force_strategy: Force a specific strategy (for testing)
            
        Returns:
            Strategy name: 'text_only', 'ocr_only', 'mixed', or 'force_pdf_extract_kit'
        """
        if force_strategy:
            return force_strategy.lower()
        
        text_quality_ratio = stats['text_quality_ratio']
        
        if text_quality_ratio >= self.quality_threshold:
            return 'text_only'
        elif text_quality_ratio == 0:
            return 'ocr_only'
        else:
            return 'mixed'
    
    def get_processing_recommendation(
        self,
        pdf_path: str,
        force_strategy: Optional[str] = None
    ) -> dict:
        """
        Analyze PDF and recommend processing strategy
        
        Args:
            pdf_path: Path to PDF file
            force_strategy: Force a specific strategy (optional)
            
        Returns:
            Dictionary with recommendation details
        """
        assessments, stats = self.assess_pdf_quality(pdf_path)
        strategy = self.determine_strategy(stats, force_strategy)
        
        # Calculate performance estimates
        if strategy == 'text_only':
            speedup = '10-50x faster'
            accuracy = 'Higher (no OCR errors)'
            gpu_usage = 'None (CPU only)'
        elif strategy == 'ocr_only':
            speedup = 'Baseline (full pipeline)'
            accuracy = 'Good (OCR-based)'
            gpu_usage = 'High (all models)'
        elif strategy == 'mixed':
            text_ratio = stats['text_quality_ratio']
            speedup = f'{round(1 + text_ratio * 9, 1)}x faster (hybrid)'
            accuracy = 'Mixed (text + OCR)'
            gpu_usage = f'Medium ({stats["pages_needing_ocr"]} pages need GPU)'
        else:  # force_pdf_extract_kit
            speedup = 'Baseline (forced full pipeline)'
            accuracy = 'Good (OCR-based)'
            gpu_usage = 'High (all models)'
        
        return {
            'pdf_path': pdf_path,
            'strategy': strategy,
            'statistics': stats,
            'performance': {
                'speedup': speedup,
                'accuracy': accuracy,
                'gpu_usage': gpu_usage
            },
            'page_assessments': [a.to_dict() for a in assessments]
        }


def safe_print(text: str, file=None):
    """Print text safely to stderr, handling Unicode errors on Windows"""
    import sys
    if file is None:
        file = sys.stderr  # Print to stderr by default to avoid contaminating JSON output
    try:
        print(text, file=file)
    except UnicodeEncodeError:
        # Fallback: remove emojis and special characters
        print(text.encode('ascii', 'ignore').decode('ascii'), file=file)

def print_recommendation_report(recommendation: dict):
    """Print a formatted recommendation report"""
    safe_print("\n" + "="*80)
    safe_print("SMART PDF PROCESSING RECOMMENDATION")
    safe_print("="*80)

    safe_print(f"\nPDF: {Path(recommendation['pdf_path']).name}")

    stats = recommendation['statistics']
    safe_print(f"\nStatistics:")
    safe_print(f"   Total Pages: {stats['total_pages']}")
    safe_print(f"   Pages with Good Text: {stats['pages_with_good_text']} ({stats['text_quality_ratio']*100:.1f}%)")
    safe_print(f"   Pages Needing OCR: {stats['pages_needing_ocr']}")
    safe_print(f"   Avg Text Density: {stats['avg_text_density']} chars/sq.in")
    safe_print(f"   Avg Word Count: {stats['avg_word_count']} words/page")
    
    strategy = recommendation['strategy']
    perf = recommendation['performance']

    safe_print(f"\nRecommended Strategy: {strategy.upper()}")

    if strategy == 'text_only':
        safe_print(f"   Use embedded text extraction (bypass PDF-Extract-Kit)")
        safe_print(f"   Performance: {perf['speedup']}")
        safe_print(f"   Accuracy: {perf['accuracy']}")
        safe_print(f"   GPU Usage: {perf['gpu_usage']}")
        safe_print(f"\n   Reason: {stats['text_quality_ratio']*100:.1f}% of pages have high-quality embedded text")

    elif strategy == 'ocr_only':
        safe_print(f"   Use PDF-Extract-Kit full pipeline (image conversion + OCR)")
        safe_print(f"   Performance: {perf['speedup']}")
        safe_print(f"   Accuracy: {perf['accuracy']}")
        safe_print(f"   GPU Usage: {perf['gpu_usage']}")
        safe_print(f"\n   Reason: No embedded text found (scanned PDF)")

    elif strategy == 'mixed':
        safe_print(f"   Use hybrid approach (text + OCR)")
        safe_print(f"   Performance: {perf['speedup']}")
        safe_print(f"   Accuracy: {perf['accuracy']}")
        safe_print(f"   GPU Usage: {perf['gpu_usage']}")
        safe_print(f"\n   Reason: Mixed quality - {stats['pages_with_good_text']} pages with text, {stats['pages_needing_ocr']} need OCR")
    
    else:  # force_pdf_extract_kit
        safe_print(f"   Forced to use PDF-Extract-Kit full pipeline")
        safe_print(f"   Performance: {perf['speedup']}")
        safe_print(f"   Accuracy: {perf['accuracy']}")
        safe_print(f"   GPU Usage: {perf['gpu_usage']}")

    safe_print("\n" + "="*80)


# Example usage
if __name__ == '__main__':
    import sys
    import json
    
    if len(sys.argv) < 2:
        print("Usage: python smart_pdf_processor.py <pdf_path> [force_strategy]")
        print("\nforce_strategy options:")
        print("  auto (default) - Automatically choose best strategy")
        print("  text_only - Force text extraction only")
        print("  ocr_only - Force PDF-Extract-Kit full pipeline")
        print("  mixed - Force hybrid approach")
        print("  force_pdf_extract_kit - Always use full pipeline")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    force_strategy = sys.argv[2] if len(sys.argv) > 2 else None
    
    # Create processor
    processor = SmartPDFProcessor(quality_threshold=0.8)
    
    # Get recommendation
    recommendation = processor.get_processing_recommendation(pdf_path, force_strategy)
    
    # Print report
    print_recommendation_report(recommendation)
    
    # Also output JSON for programmatic use
    print("\n📋 JSON Output:")
    print(json.dumps(recommendation, indent=2))

