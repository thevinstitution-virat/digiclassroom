#!/usr/bin/env python3
"""
Check PDF fonts and text extraction to diagnose encoding issues
"""

import sys
import fitz  # PyMuPDF

def check_pdf_fonts(pdf_path):
    """Analyze fonts and text extraction in a PDF"""
    
    print(f"\n{'='*80}")
    print(f"PDF FONT ANALYSIS: {pdf_path}")
    print(f"{'='*80}\n")
    
    doc = fitz.open(pdf_path)
    
    # Check first page
    page = doc[0]
    
    print(f"📄 Page 1 Analysis\n")
    print(f"{'─'*80}\n")
    
    # Get font information
    print("🔤 FONTS USED ON PAGE 1:\n")
    font_list = page.get_fonts()
    
    if not font_list:
        print("   ⚠️  No fonts found (unusual!)\n")
    else:
        for font in font_list:
            xref, name, font_type, encoding = font[:4]
            print(f"   Font: {name}")
            print(f"      Type: {font_type}")
            print(f"      Encoding: {encoding}")
            print(f"      XRef: {xref}\n")
    
    # Extract text using different methods
    print(f"{'─'*80}\n")
    print("📝 TEXT EXTRACTION COMPARISON:\n")
    
    # Method 1: Simple text extraction
    print("Method 1: page.get_text() [Simple]")
    text_simple = page.get_text()
    print(f"First 200 chars: {repr(text_simple[:200])}\n")
    
    # Method 2: Text with layout
    print("Method 2: page.get_text('text') [Layout]")
    text_layout = page.get_text("text")
    print(f"First 200 chars: {repr(text_layout[:200])}\n")
    
    # Method 3: HTML (preserves more structure)
    print("Method 3: page.get_text('html') [HTML]")
    text_html = page.get_text("html")
    print(f"First 500 chars: {repr(text_html[:500])}\n")
    
    # Method 4: Dict with font info
    print("Method 4: page.get_text('dict') [Detailed]")
    text_dict = page.get_text("dict")
    
    if text_dict.get("blocks"):
        first_block = text_dict["blocks"][0]
        if "lines" in first_block:
            first_line = first_block["lines"][0]
            if "spans" in first_line:
                first_span = first_line["spans"][0]
                print(f"   First span text: {repr(first_span.get('text', ''))}")
                print(f"   Font: {first_span.get('font', 'N/A')}")
                print(f"   Size: {first_span.get('size', 'N/A')}")
                print(f"   Flags: {first_span.get('flags', 'N/A')}\n")
    
    # Check for encoding issues
    print(f"{'─'*80}\n")
    print("🔍 ENCODING ISSUE DETECTION:\n")
    
    # Check if text contains unusual characters
    unusual_chars = sum(1 for c in text_simple if ord(c) > 127 and c not in 'áéíóúñü')
    total_chars = len(text_simple)
    
    print(f"   Total characters: {total_chars}")
    print(f"   Unusual characters (>127): {unusual_chars}")
    print(f"   Percentage: {(unusual_chars/total_chars*100) if total_chars > 0 else 0:.1f}%\n")
    
    # Check if text looks corrupted
    sample = text_simple[:100].lower()
    common_words = ['the', 'and', 'of', 'to', 'a', 'in', 'is', 'that', 'for']
    found_words = sum(1 for word in common_words if word in sample)
    
    print(f"   Common English words found in first 100 chars: {found_words}/{len(common_words)}")
    
    if found_words < 2:
        print(f"   ❌ TEXT APPEARS CORRUPTED - likely custom font encoding issue!")
        print(f"   ✅ RECOMMENDATION: Use OCR-based extraction (force_pdf_extract_kit)")
    else:
        print(f"   ✅ TEXT APPEARS NORMAL - standard extraction should work")
    
    print(f"\n{'='*80}\n")
    
    doc.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python check_pdf_fonts.py <pdf_file>")
        sys.exit(1)
    
    check_pdf_fonts(sys.argv[1])

