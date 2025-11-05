#!/usr/bin/env python3
"""
GPU Detection and Configuration Check for DigiClassroom Pro
"""

import sys

print("=" * 60)
print("GPU DETECTION AND CONFIGURATION CHECK")
print("=" * 60)

# Check PyTorch
print("\n1. PyTorch GPU Support:")
print("-" * 60)
try:
    import torch
    print(f"✅ PyTorch installed: {torch.__version__}")
    print(f"   CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"   CUDA version: {torch.version.cuda}")
        print(f"   GPU count: {torch.cuda.device_count()}")
        print(f"   GPU device 0: {torch.cuda.get_device_name(0)}")
        print(f"   GPU memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB")
    else:
        print("   ⚠️  CUDA not available - PyTorch will use CPU")
        print("   Possible reasons:")
        print("      - PyTorch CPU-only version installed")
        print("      - CUDA drivers not compatible")
        print("      - GPU not detected by PyTorch")
except ImportError:
    print("❌ PyTorch not installed")
    sys.exit(1)

# Check Ultralytics (YOLOv8)
print("\n2. Ultralytics (YOLOv8) GPU Support:")
print("-" * 60)
try:
    import ultralytics
    print(f"✅ Ultralytics installed: {ultralytics.__version__}")
    # Check if YOLO can use GPU
    from ultralytics import YOLO
    print("   YOLO model loading test...")
    # Don't actually load model, just check import
    print("   ✅ YOLO import successful")
except ImportError as e:
    print(f"❌ Ultralytics not installed: {e}")

# Check EasyOCR
print("\n3. EasyOCR GPU Support:")
print("-" * 60)
try:
    import easyocr
    print(f"✅ EasyOCR installed")
    print(f"   GPU support: {torch.cuda.is_available()}")
except ImportError:
    print("❌ EasyOCR not installed")

# Check Transformers (for UniMERNet)
print("\n4. Transformers (UniMERNet) GPU Support:")
print("-" * 60)
try:
    import transformers
    print(f"✅ Transformers installed: {transformers.__version__}")
    print(f"   GPU support: {torch.cuda.is_available()}")
except ImportError:
    print("❌ Transformers not installed")

# Check PyMuPDF (fitz)
print("\n5. PyMuPDF (PDF Processing):")
print("-" * 60)
try:
    import fitz
    print(f"✅ PyMuPDF installed: {fitz.version}")
except ImportError:
    print("❌ PyMuPDF not installed")

# Summary
print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)

if torch.cuda.is_available():
    print("✅ GPU ACCELERATION AVAILABLE")
    print(f"   Device: {torch.cuda.get_device_name(0)}")
    print(f"   Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB")
    print(f"   CUDA Version: {torch.version.cuda}")
    print("\n📊 Expected Performance:")
    print("   - Layout Detection (YOLO): 5-10x faster")
    print("   - Formula Detection (YOLO): 5-10x faster")
    print("   - Formula Recognition (UniMERNet): 3-5x faster")
    print("   - OCR (EasyOCR): 2-4x faster")
else:
    print("⚠️  GPU ACCELERATION NOT AVAILABLE")
    print("   All models will run on CPU (slower)")
    print("\n💡 To enable GPU:")
    print("   1. Install PyTorch with CUDA support:")
    print("      pip uninstall torch torchvision")
    print("      pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118")
    print("   2. Ensure NVIDIA drivers are up to date")
    print("   3. Restart Python environment")

print("\n" + "=" * 60)

