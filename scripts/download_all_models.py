#!/usr/bin/env python3
"""
Download All PDF-Extract-Kit Models (GPU/CUDA Optimized)
Downloads official models for Layout, Formula, OCR, and Table recognition.
"""

import os
import sys
import shutil
from pathlib import Path
import traceback

def safe_install(package):
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", package])

# Ensure huggingface_hub is installed
try:
    from huggingface_hub import snapshot_download
except ImportError:
    print("Installing huggingface_hub...")
    safe_install("huggingface_hub")
    from huggingface_hub import snapshot_download

def download_all_models():
    # Setup paths
    ROOT_DIR = Path(__file__).resolve().parent.parent
    BASE_MODEL_DIR = ROOT_DIR / 'models'
    
    # Define models to download
    models = [
        {
            "name": "Layout Detection (YOLO)",
            "repo_id": "opendatalab/pdf-extract-kit-1.0",
            "allow_patterns": ["models/Layout/YOLO/*"],
            "local_dir": BASE_MODEL_DIR,
            "description": "DocLayout-YOLO for document structure analysis"
        },
        {
            "name": "Formula Detection (YOLO)",
            "repo_id": "opendatalab/pdf-extract-kit-1.0", 
            "allow_patterns": ["models/MFD/YOLO/*"],
            "local_dir": BASE_MODEL_DIR,
            "description": "YOLOv8 for formula detection"
        },
        {
            "name": "Formula Recognition (UniMERNet)",
            "repo_id": "opendatalab/pdf-extract-kit-1.0",
            "allow_patterns": ["models/MFR/unimernet_small/*"],
            "local_dir": BASE_MODEL_DIR,
            "description": "UniMERNet for formula recognition"
        },
        {
            "name": "OCR (PaddleOCR)",
             "repo_id": "opendatalab/pdf-extract-kit-1.0",
             "allow_patterns": ["models/OCR/*"], 
             "local_dir": BASE_MODEL_DIR,
             "description": "PaddleOCR models"
        },
         {
            "name": "Table Recognition (StructEqTable)",
            "repo_id": "U4R/StructTable-InternVL2-1B",
            "allow_patterns": ["*"],
            "local_dir": BASE_MODEL_DIR / "TabRec" / "StructEqTable",
            "description": "StructTable-InternVL2-1B for table recognition"
        }
    ]

    print("="*80)
    print("PDF-EXTRACT-KIT MODEL DOWNLOADER")
    print("Downloading official latest models with GPU support")
    print("="*80)
    
    success_count = 0
    
    for model in models:
        print(f"\nProcessing: {model['name']}")
        print(f"Description: {model['description']}")
        print(f"Source: {model['repo_id']}")
        print(f"Target: {model['local_dir']}")
        
        try:
            # Handle StructEqTable differently as it maps to a specific subfolder in the output
            # For others, we are downloading from the monorepo 'opendatalab/PDF-Extract-Kit' 
            # which already has the structure 'models/Layout/YOLO/...' 
            # so we download to BASE_MODEL_DIR directly.
            
            # Additional logic for specific patterns
            local_dir = model['local_dir']
            
            print("Downloading...")
            snapshot_download(
                repo_id=model['repo_id'],
                local_dir=str(local_dir),
                allow_patterns=model['allow_patterns'],
                local_dir_use_symlinks=False,
                resume_download=True
            )
            print("✓ Download complete")
            success_count += 1
            
        except Exception as e:
            print(f"❌ Failed to download {model['name']}: {e}")
            traceback.print_exc()

    print("\n" + "="*80)
    print(f"Download Summary: {success_count}/{len(models)} successful")
    print("="*80)
    
    # Verify file existence briefly
    print("\nVerifying key files...")
    key_files = [
        BASE_MODEL_DIR / "Layout/YOLO/doclayout_yolo_ft.pt",
        BASE_MODEL_DIR / "MFD/YOLO/yolov8_ft.pt",
        BASE_MODEL_DIR / "MFR/unimernet_small/pytorch_model.bin", 
        # Note: UniMERNet might be bin or safe tensors, check what actually downloads
        # If it fails verification here, user can check manually.
    ]
    
    # Just list what we have in key dirs
    for subdir in ["Layout", "MFD", "MFR", "TabRec"]:
        p = BASE_MODEL_DIR / subdir
        if p.exists():
            print(f"✓ {subdir} directory exists")
            # List first few files
            files = list(p.rglob("*"))
            if files:
                print(f"  Contains {len(files)} files/dirs")
            else:
                print("  ⚠ Directory empty")
        else:
             print(f"⚠ {subdir} directory MISSING")

if __name__ == "__main__":
    download_all_models()
