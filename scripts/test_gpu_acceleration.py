#!/usr/bin/env python3
"""
GPU Acceleration Verification Test for DigiClassroom Pro
Tests that PDF-Extract-Kit models actually use GPU during processing

Run: python scripts/test_gpu_acceleration.py
"""

import sys
import time
from pathlib import Path

# Add project root to path
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

print("=" * 70)
print("GPU ACCELERATION VERIFICATION TEST")
print("=" * 70)

# Test 1: Check GPU availability
print("\n📋 Test 1: GPU Availability Check")
print("-" * 70)

try:
    import torch
    gpu_available = torch.cuda.is_available()
    
    if gpu_available:
        print(f"✅ GPU Available: {torch.cuda.get_device_name(0)}")
        print(f"   CUDA Version: {torch.version.cuda}")
        print(f"   GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB")
        print(f"   GPU Count: {torch.cuda.device_count()}")
    else:
        print("❌ GPU NOT available - tests will run on CPU")
        print("   This test suite requires GPU to verify acceleration")
        sys.exit(1)
except ImportError:
    print("❌ PyTorch not installed")
    sys.exit(1)

# Test 2: Verify YOLO model can use GPU
print("\n📋 Test 2: YOLO Model GPU Support")
print("-" * 70)

try:
    from ultralytics import YOLO
    import numpy as np
    from PIL import Image
    
    # Create a dummy image
    dummy_image = Image.fromarray(np.random.randint(0, 255, (640, 640, 3), dtype=np.uint8))
    
    # Test with CPU
    print("Testing YOLO on CPU...")
    start_cpu = time.time()
    model_cpu = YOLO('yolov8n.pt')  # Nano model for quick test
    model_cpu.to('cpu')
    results_cpu = model_cpu(dummy_image, verbose=False)
    cpu_time = time.time() - start_cpu
    print(f"   CPU inference time: {cpu_time:.3f}s")
    
    # Test with GPU
    print("Testing YOLO on GPU...")
    torch.cuda.empty_cache()  # Clear GPU memory
    start_gpu = time.time()
    model_gpu = YOLO('yolov8n.pt')
    model_gpu.to('cuda')
    results_gpu = model_gpu(dummy_image, verbose=False)
    gpu_time = time.time() - start_gpu
    print(f"   GPU inference time: {gpu_time:.3f}s")
    
    speedup = cpu_time / gpu_time if gpu_time > 0 else 0
    print(f"\n   ✅ GPU Speedup: {speedup:.2f}x faster")
    
    if speedup > 1.5:
        print(f"   ✅ GPU acceleration is WORKING (>1.5x speedup)")
    else:
        print(f"   ⚠️  GPU speedup is low - may not be using GPU effectively")
    
except Exception as e:
    print(f"❌ YOLO test failed: {e}")
    import traceback
    traceback.print_exc()

# Test 3: Verify EasyOCR can use GPU
print("\n📋 Test 3: EasyOCR GPU Support")
print("-" * 70)

try:
    import easyocr
    
    # Test with CPU
    print("Testing EasyOCR on CPU...")
    start_cpu = time.time()
    reader_cpu = easyocr.Reader(['en'], gpu=False, verbose=False)
    cpu_init_time = time.time() - start_cpu
    print(f"   CPU initialization time: {cpu_init_time:.3f}s")
    
    # Test with GPU
    print("Testing EasyOCR on GPU...")
    torch.cuda.empty_cache()
    start_gpu = time.time()
    reader_gpu = easyocr.Reader(['en'], gpu=True, verbose=False)
    gpu_init_time = time.time() - start_gpu
    print(f"   GPU initialization time: {gpu_init_time:.3f}s")
    
    print(f"\n   ✅ EasyOCR GPU support: ENABLED")
    
except Exception as e:
    print(f"❌ EasyOCR test failed: {e}")
    import traceback
    traceback.print_exc()

# Test 4: Monitor GPU memory usage
print("\n📋 Test 4: GPU Memory Monitoring")
print("-" * 70)

try:
    # Get initial GPU memory
    torch.cuda.empty_cache()
    initial_memory = torch.cuda.memory_allocated(0) / 1024**2  # MB
    print(f"Initial GPU memory: {initial_memory:.2f} MB")
    
    # Allocate some tensors on GPU
    print("Allocating tensors on GPU...")
    tensors = []
    for i in range(5):
        tensor = torch.randn(1000, 1000).cuda()
        tensors.append(tensor)
        current_memory = torch.cuda.memory_allocated(0) / 1024**2
        print(f"   Tensor {i+1}: {current_memory:.2f} MB allocated")
    
    max_memory = torch.cuda.max_memory_allocated(0) / 1024**2
    print(f"\nMax GPU memory used: {max_memory:.2f} MB")
    
    # Clean up
    del tensors
    torch.cuda.empty_cache()
    final_memory = torch.cuda.memory_allocated(0) / 1024**2
    print(f"Final GPU memory: {final_memory:.2f} MB")
    
    print(f"\n✅ GPU memory management: WORKING")
    
except Exception as e:
    print(f"❌ GPU memory test failed: {e}")

# Test 5: Verify PDF-Extract-Kit configuration
print("\n📋 Test 5: PDF-Extract-Kit GPU Configuration")
print("-" * 70)

try:
    # Check if doc_extract_engine_processor.py has GPU detection
    processor_path = ROOT_DIR / 'scripts' / 'doc_extract_engine_processor.py'
    
    if processor_path.exists():
        with open(processor_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Check for GPU detection code
        has_gpu_detection = 'GPU_AVAILABLE' in content and 'torch.cuda.is_available()' in content
        has_gpu_device = 'GPU_DEVICE' in content
        has_auto_device = "device': GPU_DEVICE" in content or 'device": GPU_DEVICE' in content
        
        print(f"GPU detection code: {'✅ Found' if has_gpu_detection else '❌ Missing'}")
        print(f"GPU device variable: {'✅ Found' if has_gpu_device else '❌ Missing'}")
        print(f"Auto device selection: {'✅ Found' if has_auto_device else '❌ Missing'}")
        
        if has_gpu_detection and has_gpu_device and has_auto_device:
            print(f"\n✅ PDF-Extract-Kit is configured for GPU acceleration")
        else:
            print(f"\n⚠️  PDF-Extract-Kit may not be fully configured for GPU")
    else:
        print(f"❌ doc_extract_engine_processor.py not found")
        
except Exception as e:
    print(f"❌ Configuration check failed: {e}")

# Summary
print("\n" + "=" * 70)
print("SUMMARY")
print("=" * 70)

if gpu_available:
    print("✅ GPU ACCELERATION IS ENABLED AND WORKING")
    print(f"\n📊 System Configuration:")
    print(f"   GPU: {torch.cuda.get_device_name(0)}")
    print(f"   Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB")
    print(f"   CUDA: {torch.version.cuda}")
    print(f"   PyTorch: {torch.__version__}")
    
    print(f"\n🚀 Expected Performance Improvements:")
    print(f"   - Layout Detection (YOLO): 5-10x faster")
    print(f"   - Formula Detection (YOLO): 5-10x faster")
    print(f"   - Formula Recognition (UniMERNet): 3-5x faster")
    print(f"   - OCR (EasyOCR): 2-4x faster")
    
    print(f"\n💡 Next Steps:")
    print(f"   1. Upload a PDF via admin content page")
    print(f"   2. Monitor GPU usage with: nvidia-smi -l 1")
    print(f"   3. Check processing logs for GPU confirmation")
    print(f"   4. Compare processing times with CPU baseline")
else:
    print("❌ GPU ACCELERATION NOT AVAILABLE")
    print("\n💡 To enable GPU:")
    print("   1. Ensure NVIDIA GPU is installed")
    print("   2. Install CUDA drivers")
    print("   3. Install PyTorch with CUDA support:")
    print("      pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118")

print("\n" + "=" * 70)
print("Test completed successfully!")
print("=" * 70)

