#!/usr/bin/env python3
"""
GPU Availability Check Script for DigiClassroom Pro
Verifies CUDA/GPU availability and PyTorch compatibility
"""

import sys
import json

def check_gpu_availability():
    """Check if GPU/CUDA is available and report details"""
    
    results = {
        "gpu_available": False,
        "cuda_available": False,
        "gpu_count": 0,
        "gpu_names": [],
        "cuda_version": None,
        "pytorch_version": None,
        "pytorch_cuda_version": None,
        "cudnn_version": None,
        "recommendations": []
    }
    
    # Check PyTorch
    try:
        import torch
        results["pytorch_version"] = torch.__version__
        results["cuda_available"] = torch.cuda.is_available()
        
        if results["cuda_available"]:
            results["gpu_available"] = True
            results["gpu_count"] = torch.cuda.device_count()
            results["gpu_names"] = [torch.cuda.get_device_name(i) for i in range(results["gpu_count"])]
            results["pytorch_cuda_version"] = torch.version.cuda
            
            if torch.backends.cudnn.is_available():
                results["cudnn_version"] = torch.backends.cudnn.version()
            
            # Get current device properties
            if results["gpu_count"] > 0:
                device = torch.cuda.current_device()
                props = torch.cuda.get_device_properties(device)
                results["gpu_memory_total_gb"] = props.total_memory / (1024**3)
                results["gpu_compute_capability"] = f"{props.major}.{props.minor}"
        else:
            results["recommendations"].append("PyTorch is installed but CUDA is not available")
            results["recommendations"].append("Install PyTorch with CUDA support: pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118")
            
    except ImportError:
        results["recommendations"].append("PyTorch is not installed")
        results["recommendations"].append("Install PyTorch with CUDA: pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118")
    
    # Check NVIDIA GPU using nvidia-smi
    try:
        import subprocess
        nvidia_smi = subprocess.run(['nvidia-smi', '--query-gpu=name,driver_version,memory.total', '--format=csv,noheader'],
                                   capture_output=True, text=True, timeout=5)
        if nvidia_smi.returncode == 0:
            results["nvidia_smi_available"] = True
            gpu_info = nvidia_smi.stdout.strip().split('\n')
            results["nvidia_gpu_info"] = gpu_info
            
            # Extract CUDA version from nvidia-smi
            cuda_version_output = subprocess.run(['nvidia-smi'], capture_output=True, text=True, timeout=5)
            if cuda_version_output.returncode == 0:
                # Parse CUDA version from output
                for line in cuda_version_output.stdout.split('\n'):
                    if 'CUDA Version:' in line:
                        cuda_ver = line.split('CUDA Version:')[1].strip().split()[0]
                        results["cuda_version"] = cuda_ver
                        break
        else:
            results["nvidia_smi_available"] = False
            results["recommendations"].append("nvidia-smi not available - NVIDIA drivers may not be installed")
    except (subprocess.TimeoutExpired, FileNotFoundError):
        results["nvidia_smi_available"] = False
        results["recommendations"].append("nvidia-smi command not found - NVIDIA drivers may not be installed")
    
    return results

def print_results(results):
    """Print formatted results"""
    print("\n" + "="*70)
    print("GPU AVAILABILITY CHECK FOR DIGICLASSROOM PRO")
    print("="*70)
    
    print(f"\n🔍 PyTorch Version: {results.get('pytorch_version', 'NOT INSTALLED')}")
    
    if results["gpu_available"]:
        print(f"\n✅ GPU AVAILABLE: YES")
        print(f"   GPU Count: {results['gpu_count']}")
        for i, name in enumerate(results['gpu_names']):
            print(f"   GPU {i}: {name}")
        if "gpu_memory_total_gb" in results:
            print(f"   Total GPU Memory: {results['gpu_memory_total_gb']:.2f} GB")
        if "gpu_compute_capability" in results:
            print(f"   Compute Capability: {results['gpu_compute_capability']}")
    else:
        print(f"\n❌ GPU AVAILABLE: NO")
    
    print(f"\n🔧 CUDA Available: {results['cuda_available']}")
    if results.get("cuda_version"):
        print(f"   CUDA Version (Driver): {results['cuda_version']}")
    if results.get("pytorch_cuda_version"):
        print(f"   CUDA Version (PyTorch): {results['pytorch_cuda_version']}")
    if results.get("cudnn_version"):
        print(f"   cuDNN Version: {results['cudnn_version']}")
    
    if results.get("nvidia_smi_available"):
        print(f"\n📊 NVIDIA Driver Info:")
        for info in results.get("nvidia_gpu_info", []):
            print(f"   {info}")
    
    if results["recommendations"]:
        print(f"\n⚠️  RECOMMENDATIONS:")
        for rec in results["recommendations"]:
            print(f"   - {rec}")
    
    print("\n" + "="*70)
    
    # Verdict
    if results["gpu_available"] and results["cuda_available"]:
        print("✅ VERDICT: GPU is available and ready for use!")
        print("   You can enable GPU acceleration in the configuration files.")
    else:
        print("❌ VERDICT: GPU is NOT available")
        print("   Table recognition with StructTable-InternVL2-1B requires GPU.")
        print("   Please install NVIDIA drivers and PyTorch with CUDA support.")
    
    print("="*70 + "\n")

if __name__ == "__main__":
    results = check_gpu_availability()
    print_results(results)
    
    # Output JSON for programmatic use
    print("\nJSON Output:")
    print(json.dumps(results, indent=2))
    
    # Exit code: 0 if GPU available, 1 if not
    sys.exit(0 if results["gpu_available"] else 1)

