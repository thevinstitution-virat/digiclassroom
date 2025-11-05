#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extract All Text from PDF - Show What's Actually Embedded

This script extracts and displays all embedded text from each page
to understand what the PDF actually contains.
"""

import sys
import fitz  # PyMuPDF
from pathlib import Path


def extract_all_text(pdf_path: Path):
    """Extract and display all text from PDF"""
    print("=" * 100)
    print("📄 PDF TEXT EXTRACTION - FULL CONTENT")
    print("=" * 100)
    print(f"\nPDF: {pdf_path}\n")
    
    doc = fitz.open(str(pdf_path))
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text()
        
        print("=" * 100)
        print(f"PAGE {page_num + 1} ({len(text)} characters, {len(text.split())} words)")
        print("=" * 100)
        print(text)
        print("\n")
    
    doc.close()


def main():
    if len(sys.argv) < 2:
        print("Usage: python extract-all-text-from-pdf.py <pdf_path>")
        sys.exit(1)
    
    pdf_path = Path(sys.argv[1])
    
    if not pdf_path.exists():
        print(f"❌ Error: PDF not found: {pdf_path}")
        sys.exit(1)
    
    extract_all_text(pdf_path)


if __name__ == "__main__":
    main()

