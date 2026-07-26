#!/usr/bin/env python3
"""
Download StructTable-InternVL2-1B Model for DigiClassroom Pro
Downloads the model from Hugging Face: U4R/StructTable-InternVL2-1B
Released: October 22, 2024
"""

import os
import sys
from pathlib import Path

def download_model():
    """Download StructTable-InternVL2-1B model from Hugging Face"""
    
    # Set up paths
    ROOT_DIR = Path(__file__).resolve().parent.parent
    MODEL_DIR = ROOT_DIR / 'vendor' / 'PDF-Extract-Kit' / 'models' / 'TabRec' / 'StructEqTable'
    
    print("="*70)
    print("DOWNLOADING STRUCTTABLE-INTERNVL2-1B MODEL")
    print("="*70)
    print(f"\nModel: U4R/StructTable-InternVL2-1B")
    print(f"Release Date: October 22, 2024")
    print(f"Target Directory: {MODEL_DIR}")
    print(f"\nThis model supports LaTeX/HTML/Markdown table output")
    print(f"Model size: ~2.5GB (InternVL2-1B foundation model)")
    print("="*70 + "\n")
    
    # Create directory if it doesn't exist
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    print(f"✓ Created directory: {MODEL_DIR}\n")
    
    # Check if huggingface_hub is installed
    try:
        from huggingface_hub import snapshot_download
        print("✓ huggingface_hub is installed\n")
    except ImportError:
        print("❌ huggingface_hub is not installed")
        print("Installing huggingface_hub...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "huggingface_hub"])
        from huggingface_hub import snapshot_download
        print("✓ huggingface_hub installed successfully\n")
    
    # Download the model
    try:
        print("📥 Downloading model from Hugging Face...")
        print("   This may take several minutes depending on your internet connection...")
        print("   Model repository: U4R/StructTable-InternVL2-1B\n")
        
        snapshot_download(
            repo_id="U4R/StructTable-InternVL2-1B",
            local_dir=str(MODEL_DIR),
            local_dir_use_symlinks=False,
            resume_download=True
        )
        
        print("\n✅ Model downloaded successfully!")
        
        # Verify downloaded files
        print("\n📋 Verifying downloaded files...")
        required_files = [
            "config.json",
            "generation_config.json",
            "preprocessor_config.json",
            "tokenizer_config.json",
            "tokenizer.json"
        ]
        
        model_files = list(MODEL_DIR.glob("*"))
        print(f"\n   Found {len(model_files)} files in {MODEL_DIR.name}/:")
        
        for file in sorted(model_files):
            if file.is_file():
                size_mb = file.stat().st_size / (1024 * 1024)
                print(f"   ✓ {file.name} ({size_mb:.2f} MB)")
        
        # Check for required files
        missing_files = []
        for req_file in required_files:
            if not (MODEL_DIR / req_file).exists():
                missing_files.append(req_file)
        
        if missing_files:
            print(f"\n⚠️  Warning: Some expected files are missing:")
            for mf in missing_files:
                print(f"   - {mf}")
        else:
            print(f"\n✅ All required configuration files are present!")
        
        # Check for model weight files
        weight_files = list(MODEL_DIR.glob("*.safetensors")) + list(MODEL_DIR.glob("*.bin"))
        if weight_files:
            print(f"\n✅ Model weight files found:")
            for wf in weight_files:
                size_mb = wf.stat().st_size / (1024 * 1024)
                print(f"   ✓ {wf.name} ({size_mb:.2f} MB)")
        else:
            print(f"\n⚠️  Warning: No model weight files (.safetensors or .bin) found")
        
        print("\n" + "="*70)
        print("✅ DOWNLOAD COMPLETE!")
        print("="*70)
        print(f"\nModel location: {MODEL_DIR}")
        print(f"Configuration: config/doc-extract-engine/config.json")
        print(f"GPU Status: Enabled (required for this model)")
        print("\nThe model is now ready to use for table recognition!")
        print("="*70 + "\n")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error downloading model: {e}")
        print(f"\nTroubleshooting:")
        print(f"1. Check your internet connection")
        print(f"2. Verify you have enough disk space (~3GB required)")
        print(f"3. Try running the script again (download will resume)")
        print(f"4. Manual download: https://huggingface.co/U4R/StructTable-InternVL2-1B")
        return False

if __name__ == "__main__":
    success = download_model()
    sys.exit(0 if success else 1)

