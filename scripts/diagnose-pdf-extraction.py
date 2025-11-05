#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF Extraction Diagnostic Tool

This script analyzes why specific paragraphs were not extracted from a PDF.
It checks:
1. Text extraction quality (embedded vs OCR)
2. Font encoding issues
3. Text layout and positioning
4. Image-based text regions
5. OCR confidence scores
"""

import sys
import fitz  # PyMuPDF
from pathlib import Path
import json
import re

# Target paragraph to find
TARGET_PARAGRAPH_1 = """The range lying to the south of the Himadri forms the most rugged mountain system and is known as Himachal or lesser Himalaya. The ranges are mainly composed of highly compressed and altered rocks. The altitude varies between 3,700 and 4,500 metres and the average width is of 50 Km. While the Pir Panjal range forms the longest and the most important range, the Dhauladhar and the Mahabharat ranges are also prominent ones. This range consists of the famous valley of Kashmir, the Kangra and Kullu Valley in Himachal Pradesh. This region is well-known for its hill stations."""

# Keywords to search for
KEYWORDS_P1 = ['Himachal', 'lesser Himalaya', 'Pir Panjal', 'Dhauladhar', 'Mahabharat', 'Kashmir', 'Kangra', 'Kullu']


def analyze_pdf(pdf_path: Path):
    """Comprehensive PDF analysis"""
    print("=" * 100)
    print("📄 PDF EXTRACTION DIAGNOSTIC TOOL")
    print("=" * 100)
    print(f"\nPDF: {pdf_path}")
    print(f"Size: {pdf_path.stat().st_size / 1024 / 1024:.2f} MB\n")
    
    doc = fitz.open(str(pdf_path))
    
    print(f"Total Pages: {len(doc)}")
    print(f"Metadata: {doc.metadata}")
    print(f"Is Encrypted: {doc.is_encrypted}")
    print(f"Is PDF: {doc.is_pdf}")
    print("")
    
    # Analyze each page
    for page_num in range(len(doc)):
        page = doc[page_num]
        print("=" * 100)
        print(f"📄 PAGE {page_num + 1}")
        print("=" * 100)
        
        # 1. Extract embedded text
        text = page.get_text()
        text_blocks = page.get_text("blocks")
        text_dict = page.get_text("dict")
        
        print(f"\n1️⃣ EMBEDDED TEXT EXTRACTION:")
        print(f"   - Text length: {len(text)} characters")
        print(f"   - Text blocks: {len(text_blocks)}")
        print(f"   - Words: {len(text.split())}")
        
        # 2. Check for target paragraph keywords
        keyword_matches = []
        for keyword in KEYWORDS_P1:
            if keyword.lower() in text.lower():
                keyword_matches.append(keyword)
        
        print(f"\n2️⃣ TARGET PARAGRAPH KEYWORDS:")
        print(f"   - Matched: {len(keyword_matches)}/{len(KEYWORDS_P1)}")
        if keyword_matches:
            print(f"   - Found: {', '.join(keyword_matches)}")
        
        # 3. Font analysis
        fonts = set()
        for block in text_dict.get("blocks", []):
            if "lines" in block:
                for line in block["lines"]:
                    for span in line.get("spans", []):
                        font = span.get("font", "Unknown")
                        fonts.add(font)
        
        print(f"\n3️⃣ FONT ANALYSIS:")
        print(f"   - Unique fonts: {len(fonts)}")
        if fonts:
            for font in sorted(fonts):
                print(f"     • {font}")
        
        # 4. Image analysis
        images = page.get_images()
        print(f"\n4️⃣ IMAGE ANALYSIS:")
        print(f"   - Images on page: {len(images)}")
        
        # 5. Text quality assessment
        has_unicode_issues = bool(re.search(r'[\ufffd\u0000-\u001f]', text))
        has_garbled_text = bool(re.search(r'[^\x00-\x7F]{10,}', text))
        
        print(f"\n5️⃣ TEXT QUALITY:")
        print(f"   - Unicode issues: {'Yes ⚠️' if has_unicode_issues else 'No ✅'}")
        print(f"   - Garbled text: {'Yes ⚠️' if has_garbled_text else 'No ✅'}")
        print(f"   - Extractable: {'Yes ✅' if len(text.strip()) > 100 else 'No ❌'}")
        
        # 6. If this page has many keyword matches, show the text
        if len(keyword_matches) >= 3:
            print(f"\n6️⃣ PAGE TEXT (First 2000 chars):")
            print("─" * 100)
            print(text[:2000])
            print("─" * 100)
            
            # Check if full paragraph is present
            paragraph_similarity = calculate_similarity(TARGET_PARAGRAPH_1, text)
            print(f"\n7️⃣ PARAGRAPH SIMILARITY: {paragraph_similarity:.1%}")
            
            if paragraph_similarity > 0.7:
                print("   ✅ TARGET PARAGRAPH LIKELY PRESENT")
            elif paragraph_similarity > 0.3:
                print("   ⚠️  PARTIAL MATCH - Paragraph may be fragmented")
            else:
                print("   ❌ TARGET PARAGRAPH NOT FOUND")
        
        # 7. Layout analysis
        print(f"\n8️⃣ LAYOUT ANALYSIS:")
        print(f"   - Page size: {page.rect.width:.1f} x {page.rect.height:.1f}")
        print(f"   - Rotation: {page.rotation}°")
        
        # Check for text in images (OCR needed)
        if len(images) > 0 and len(text.strip()) < 100:
            print(f"   ⚠️  WARNING: Page has images but little text - OCR may be needed")
        
        print("")
    
    doc.close()
    
    print("=" * 100)
    print("✅ DIAGNOSTIC COMPLETE")
    print("=" * 100)


def calculate_similarity(text1: str, text2: str) -> float:
    """Calculate text similarity using word overlap"""
    words1 = set(text1.lower().split())
    words2 = set(text2.lower().split())
    
    if not words1 or not words2:
        return 0.0
    
    intersection = words1 & words2
    union = words1 | words2
    
    return len(intersection) / len(union)


def main():
    if len(sys.argv) < 2:
        print("Usage: python diagnose-pdf-extraction.py <pdf_path>")
        sys.exit(1)
    
    pdf_path = Path(sys.argv[1])
    
    if not pdf_path.exists():
        print(f"❌ Error: PDF not found: {pdf_path}")
        sys.exit(1)
    
    analyze_pdf(pdf_path)


if __name__ == "__main__":
    main()

