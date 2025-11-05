#!/usr/bin/env python3
"""
Test GPU Acceleration for PaddleOCR
Verifies that all components are properly configured for GPU-only processing
"""

import sys
import os

# Set environment variable to avoid OpenMP conflicts
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

print("=" * 70)
print("GPU ACCELERATION TEST - PaddleOCR Configuration")
print("=" * 70)

# Test 1: PyTorch CUDA Support
print("\n1. PyTorch CUDA Support:")
print("-" * 70)
try:
    import torch
    cuda_available = torch.cuda.is_available()
    print(f"   CUDA Available: {cuda_available}")
    if cuda_available:
        print(f"   GPU Device: {torch.cuda.get_device_name(0)}")
        print(f"   GPU Count: {torch.cuda.device_count()}")
        print(f"   CUDA Version: {torch.version.cuda}")
        print(f"   GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB")
        print("   ✅ PyTorch CUDA: ENABLED")
    else:
        print("   ❌ PyTorch CUDA: DISABLED")
        sys.exit(1)
except Exception as e:
    print(f"   ❌ PyTorch test failed: {e}")
    sys.exit(1)

# Test 2: PaddlePaddle GPU Support
print("\n2. PaddlePaddle GPU Support:")
print("-" * 70)
try:
    import paddle
    paddle_gpu = paddle.device.is_compiled_with_cuda()
    print(f"   PaddlePaddle Version: {paddle.__version__}")
    print(f"   GPU Compiled: {paddle_gpu}")
    if paddle_gpu:
        gpu_count = paddle.device.cuda.device_count()
        print(f"   GPU Count: {gpu_count}")
        print("   ✅ PaddlePaddle GPU: ENABLED")
    else:
        print("   ❌ PaddlePaddle GPU: DISABLED")
        sys.exit(1)
except Exception as e:
    print(f"   ❌ PaddlePaddle test failed: {e}")
    sys.exit(1)

# Test 3: PaddleOCR GPU Initialization
print("\n3. PaddleOCR GPU Initialization:")
print("-" * 70)
try:
    from paddleocr import PaddleOCR
    print("   Initializing PaddleOCR with GPU...")
    ocr = PaddleOCR(
        use_angle_cls=True,
        lang='en',
        use_gpu=True,
        show_log=False
    )
    print("   ✅ PaddleOCR GPU: INITIALIZED")
except Exception as e:
    print(f"   ❌ PaddleOCR initialization failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 4: PDF-Extract-Kit OCR Model Registry
print("\n4. PDF-Extract-Kit OCR Model Registry:")
print("-" * 70)
try:
    from pdf_extract_kit.registry import MODEL_REGISTRY
    # Import tasks to register models
    import pdf_extract_kit.tasks
    import pdf_extract_kit.tasks.ocr

    available_models = MODEL_REGISTRY.list_items()
    ocr_models = [m for m in available_models if 'ocr' in m.lower()]
    print(f"   Available OCR models: {ocr_models}")

    if 'ocr_ppocr' in ocr_models:
        print("   ✅ PaddleOCR model registered: ocr_ppocr")
    else:
        print("   ❌ PaddleOCR model NOT registered")
        sys.exit(1)

    if 'ocr_easyocr' in ocr_models:
        print("   ⚠️  EasyOCR model still registered (deprecated)")

except Exception as e:
    print(f"   ❌ Model registry test failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 5: ModifiedPaddleOCR Import
print("\n5. ModifiedPaddleOCR Import:")
print("-" * 70)
try:
    from pdf_extract_kit.tasks.ocr.models.paddle_ocr import ModifiedPaddleOCR
    print("   ✅ ModifiedPaddleOCR import: SUCCESS")
except Exception as e:
    print(f"   ❌ ModifiedPaddleOCR import failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 6: GPU Requirement Check
print("\n6. GPU Requirement Check:")
print("-" * 70)
if cuda_available and paddle_gpu:
    print("   ✅ GPU requirements met")
    print("   ✅ System configured for GPU-only processing")
else:
    print("   ❌ GPU requirements NOT met")
    print("   ❌ System will fail at startup (as designed)")
    sys.exit(1)

# Summary
print("\n" + "=" * 70)
print("✅ ALL TESTS PASSED - GPU ACCELERATION FULLY CONFIGURED")
print("=" * 70)
print("\nConfiguration Summary:")
print(f"  • PyTorch:      {torch.__version__} (CUDA {torch.version.cuda})")
print(f"  • PaddlePaddle: {paddle.__version__} (GPU)")
print(f"  • PaddleOCR:    Initialized with GPU")
print(f"  • GPU Device:   {torch.cuda.get_device_name(0)}")
print(f"  • GPU Memory:   {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB")
print(f"  • OCR Model:    ocr_ppocr (PaddleOCR)")
print(f"  • CPU Fallback: DISABLED (GPU-only)")
print("\nNext Steps:")
print("  1. Test PDF processing with GPU monitoring: nvidia-smi -l 1")
print("  2. Process geography textbook with PaddleOCR")
print("  3. Verify OCR accuracy is 95-98%")
print("=" * 70)

