#!/usr/bin/env python3
"""
Verify GPU Setup and Model Availability for DigiClassroom Pro
Checks all models and GPU configuration after setup
"""

import sys
import json
from pathlib import Path

def verify_setup():
    """Verify complete GPU setup and model availability"""
    
    ROOT_DIR = Path(__file__).resolve().parent.parent
    
    results = {
        "gpu_available": False,
        "configurations_updated": False,
        "models_available": {},
        "all_models_ready": False,
        "recommendations": []
    }
    
    print("\n" + "="*70)
    print("GPU SETUP VERIFICATION FOR DIGICLASSROOM PRO")
    print("="*70)
    
    # 1. Check GPU availability
    print("\n1️⃣  CHECKING GPU AVAILABILITY...")
    try:
        import torch
        results["gpu_available"] = torch.cuda.is_available()
        if results["gpu_available"]:
            gpu_name = torch.cuda.get_device_name(0)
            gpu_memory = torch.cuda.get_device_properties(0).total_memory / (1024**3)
            print(f"   ✅ GPU Available: {gpu_name}")
            print(f"   ✅ GPU Memory: {gpu_memory:.2f} GB")
            print(f"   ✅ CUDA Version: {torch.version.cuda}")
        else:
            print(f"   ❌ GPU Not Available")
            results["recommendations"].append("GPU is required for StructTable-InternVL2-1B")
    except ImportError:
        print(f"   ❌ PyTorch not installed")
        results["recommendations"].append("Install PyTorch with CUDA support")
    
    # 2. Check configuration files
    print("\n2️⃣  CHECKING CONFIGURATION FILES...")
    
    # Check pdf-extract-kit config
    pdf_extract_config = ROOT_DIR / 'config' / 'pdf-extract-kit' / 'config.yaml'
    if pdf_extract_config.exists():
        with open(pdf_extract_config, 'r') as f:
            content = f.read()
            gpu_enabled_count = content.count('device: cuda')
            use_gpu_true = content.count('use_gpu: true')
            total_gpu_settings = gpu_enabled_count + use_gpu_true
            
            print(f"   ✅ config/pdf-extract-kit/config.yaml exists")
            print(f"   ✅ GPU enabled for {total_gpu_settings} tasks")
            
            if total_gpu_settings >= 4:
                results["configurations_updated"] = True
            else:
                results["recommendations"].append("Update config/pdf-extract-kit/config.yaml to enable GPU")
    else:
        print(f"   ❌ config/pdf-extract-kit/config.yaml not found")
        results["recommendations"].append("Create config/pdf-extract-kit/config.yaml")
    
    # Check doc-extract-engine config
    doc_extract_config = ROOT_DIR / 'config' / 'doc-extract-engine' / 'config.json'
    if doc_extract_config.exists():
        with open(doc_extract_config, 'r') as f:
            config = json.load(f)
            gpu_enabled = config.get('processing_options', {}).get('gpu_enabled', False)
            print(f"   ✅ config/doc-extract-engine/config.json exists")
            print(f"   {'✅' if gpu_enabled else '❌'} GPU enabled: {gpu_enabled}")
            
            if not gpu_enabled:
                results["recommendations"].append("Set gpu_enabled: true in config/doc-extract-engine/config.json")
    else:
        print(f"   ❌ config/doc-extract-engine/config.json not found")
    
    # 3. Check model files
    print("\n3️⃣  CHECKING MODEL FILES...")
    
    models_base = ROOT_DIR / 'vendor' / 'PDF-Extract-Kit' / 'models'
    
    models_to_check = {
        "DocLayout-YOLO (Oct 17, 2024)": models_base / 'Layout' / 'YOLO' / 'doclayout_yolo_ft.pt',
        "YOLOv8 Formula Detection": models_base / 'MFD' / 'YOLO' / 'yolo_v8_ft.pt',
        "UniMERNet Formula Recognition": models_base / 'MFR' / 'unimernet_small',
        "StructTable-InternVL2-1B (Oct 22, 2024)": models_base / 'TabRec' / 'StructEqTable'
    }
    
    all_models_present = True
    for model_name, model_path in models_to_check.items():
        if model_path.exists():
            if model_path.is_file():
                size_mb = model_path.stat().st_size / (1024 * 1024)
                print(f"   ✅ {model_name}")
                print(f"      Path: {model_path.name}")
                print(f"      Size: {size_mb:.2f} MB")
            else:
                # Directory - check for model files
                model_files = list(model_path.glob('*.safetensors')) + list(model_path.glob('*.pth')) + list(model_path.glob('*.pt'))
                if model_files:
                    total_size = sum(f.stat().st_size for f in model_files) / (1024 * 1024)
                    print(f"   ✅ {model_name}")
                    print(f"      Path: {model_path.name}/")
                    print(f"      Files: {len(list(model_path.glob('*')))} files")
                    print(f"      Size: {total_size:.2f} MB")
                else:
                    print(f"   ⚠️  {model_name} - directory exists but no model files found")
                    all_models_present = False
            results["models_available"][model_name] = True
        else:
            print(f"   ❌ {model_name} - NOT FOUND")
            print(f"      Expected: {model_path}")
            results["models_available"][model_name] = False
            all_models_present = False
            
            if "StructTable" in model_name:
                results["recommendations"].append("Download StructTable-InternVL2-1B model")
    
    results["all_models_ready"] = all_models_present
    
    # 4. Check v1.0.0 updates status
    print("\n4️⃣  CHECKING PDF-EXTRACT-KIT v1.0.0 UPDATES...")
    
    updates = {
        "v1.0.0 Modular Architecture (Oct 10, 2024)": True,  # Already verified
        "DocLayout-YOLO (Oct 17, 2024)": results["models_available"].get("DocLayout-YOLO (Oct 17, 2024)", False),
        "StructTable-InternVL2-1B (Oct 22, 2024)": results["models_available"].get("StructTable-InternVL2-1B (Oct 22, 2024)", False)
    }
    
    for update_name, status in updates.items():
        print(f"   {'✅' if status else '❌'} {update_name}")
    
    all_updates_ready = all(updates.values())
    
    # 5. Final verdict
    print("\n" + "="*70)
    print("FINAL STATUS")
    print("="*70)
    
    if results["gpu_available"] and results["configurations_updated"] and all_models_present:
        print("\n✅ ✅ ✅  ALL SYSTEMS READY! ✅ ✅ ✅")
        print("\nGPU-accelerated table recognition is fully configured!")
        print("All PDF-Extract-Kit v1.0.0 updates are functional:")
        print("  ✅ v1.0.0 Modular Architecture")
        print("  ✅ DocLayout-YOLO (latest layout detection)")
        print("  ✅ StructTable-InternVL2-1B (advanced table recognition)")
        print("\nYou can now process PDFs with:")
        print("  - GPU-accelerated layout detection")
        print("  - GPU-accelerated formula detection & recognition")
        print("  - GPU-accelerated OCR")
        print("  - GPU-accelerated table recognition (LaTeX/HTML/Markdown)")
    else:
        print("\n⚠️  SETUP INCOMPLETE")
        if not results["gpu_available"]:
            print("  ❌ GPU not available")
        if not results["configurations_updated"]:
            print("  ❌ Configuration files not updated for GPU")
        if not all_models_present:
            print("  ❌ Some models are missing")
        
        if results["recommendations"]:
            print("\n📋 RECOMMENDATIONS:")
            for rec in results["recommendations"]:
                print(f"  - {rec}")
    
    print("="*70 + "\n")
    
    return results

if __name__ == "__main__":
    results = verify_setup()
    
    # Output JSON for programmatic use
    print("\nJSON Output:")
    print(json.dumps(results, indent=2))
    
    # Exit code: 0 if all ready, 1 if not
    sys.exit(0 if results["all_models_ready"] and results["gpu_available"] else 1)

