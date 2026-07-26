@echo off
REM Install tested package versions for DigiClassroom Pro
REM Python 3.11.9 + PaddlePaddle 2.6.1.post117 + PaddleOCR 2.7.3

echo.
echo ========================================
echo Installing Tested Package Configuration
echo ========================================
echo.
echo Python: 3.11.9
echo PaddlePaddle: 2.6.1.post117 (CUDA 11.7)
echo PaddleOCR: 2.7.3
echo.

REM Step 1: Install PyTorch with CUDA 11.8 support
echo [1/6] Installing PyTorch 2.7.1+cu118...
.venv-py311\Scripts\pip.exe install torch==2.7.1 torchvision==0.22.1 torchaudio==2.7.1 --index-url https://download.pytorch.org/whl/cu118
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: PyTorch installation failed
    exit /b 1
)

REM Step 2: Install PaddlePaddle GPU 2.6.1.post117 with CUDA 11.7
echo.
echo [2/6] Installing PaddlePaddle 2.6.1.post117 (CUDA 11.7)...
.venv-py311\Scripts\pip.exe install paddlepaddle-gpu==2.6.1.post117 -f https://www.paddlepaddle.org.cn/whl/windows/mkl/avx/stable.html
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: PaddlePaddle installation failed
    exit /b 1
)

REM Step 3: Install PaddleOCR 2.7.3
echo.
echo [3/6] Installing PaddleOCR 2.7.3...
.venv-py311\Scripts\pip.exe install paddleocr==2.7.3
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: PaddleOCR installation failed
    exit /b 1
)

REM Step 4: Install Ultralytics (YOLO)
echo.
echo [4/6] Installing Ultralytics...
.venv-py311\Scripts\pip.exe install ultralytics>=8.0.0
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Ultralytics installation failed
    exit /b 1
)

REM Step 5: Install PyMuPDF
echo.
echo [5/6] Installing PyMuPDF...
.venv-py311\Scripts\pip.exe install PyMuPDF>=1.23.0
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: PyMuPDF installation failed
    exit /b 1
)

REM Step 6: Install remaining dependencies from requirements.txt
echo.
echo [6/6] Installing remaining dependencies...
.venv-py311\Scripts\pip.exe install transformers opencv-python pillow numpy scipy scikit-learn pyyaml
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Remaining dependencies installation failed
    exit /b 1
)

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Verifying installation...
.venv-py311\Scripts\python.exe -c "import torch; import paddle; import paddleocr; import ultralytics; import fitz; print('All packages imported successfully!')"

echo.
echo Next steps:
echo   1. Test PyTorch/PaddlePaddle compatibility
echo   2. Update .env.local to use .venv-py311
echo   3. Restart the application
echo.

