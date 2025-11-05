# DigiClassroom Pro - Model Inventory

**Last Updated:** 2025-11-03  
**PDF-Extract-Kit Version:** v1.0.0 (Released Oct 10, 2024)  
**GPU Status:** ✅ Enabled (NVIDIA GeForce GTX 1660 SUPER, 6GB VRAM)

---

## Complete Model Inventory

### 1. Layout Detection Models

#### DocLayout-YOLO (Primary - Latest)
- **Status:** ✅ Installed & GPU-Enabled
- **Release Date:** October 17, 2024
- **File:** `vendor/PDF-Extract-Kit/models/Layout/YOLO/doclayout_yolo_ft.pt`
- **Size:** 38.82 MB
- **Device:** CUDA (GPU)
- **Features:**
  - Enhanced document layout analysis
  - Faster and more accurate than previous versions
  - Detects: title, plain text, figures, tables, formulas, captions
  - Improved robustness to blurring and watermarks
- **Configuration:** `config/pdf-extract-kit/config.yaml` → `layout_detection`

#### YOLOv10 (Alternative - Available but not configured)
- **Status:** ⚪ Available in codebase (not configured as primary)
- **File:** Referenced in `configs/layout_detection_yolo.yaml`
- **Note:** DocLayout-YOLO is preferred for better accuracy

#### LayoutLMv3 (Alternative - Available but not configured)
- **Status:** ⚪ Available in codebase (not configured as primary)
- **Note:** Requires separate environment setup
- **Use Case:** Alternative for specific document types

---

### 2. Formula Detection Models

#### YOLOv8 (Fine-tuned)
- **Status:** ✅ Installed & GPU-Enabled
- **File:** `vendor/PDF-Extract-Kit/models/MFD/YOLO/yolo_v8_ft.pt`
- **Size:** 333.66 MB
- **Device:** CUDA (GPU)
- **Features:**
  - Detects inline formulas
  - Detects block formulas
  - Fine-tuned on diverse document types
  - High accuracy on both English and Chinese documents
- **Configuration:** `config/pdf-extract-kit/config.yaml` → `formula_detection`

---

### 3. Formula Recognition Models

#### UniMERNet Small
- **Status:** ✅ Installed & GPU-Enabled
- **Path:** `vendor/PDF-Extract-Kit/models/MFR/unimernet_small/`
- **Size:** 1,545.49 MB (9 files)
- **Device:** CUDA (GPU)
- **Features:**
  - Converts formula images to LaTeX
  - Handles complex long formulas
  - Recognizes handwritten formulas
  - Works with noisy screenshot formulas
  - Real-world scenario optimization
- **Files:**
  - `unimernet_small.pth` (model weights)
  - `pytorch_model.pth` (PyTorch model)
  - `config.json` (model configuration)
  - `tokenizer.json` (tokenizer)
  - `preprocessor_config.json` (preprocessing config)
- **Configuration:** `config/pdf-extract-kit/config.yaml` → `formula_recognition`

---

### 4. OCR Models

#### PaddleOCR
- **Status:** ✅ Installed & GPU-Enabled
- **Installation:** Via pip (paddleocr==2.7.3)
- **Device:** GPU Enabled
- **Features:**
  - Multi-language support (English + 10 Indian languages)
  - Text detection and recognition
  - Angle classification
  - High accuracy on educational content
- **Supported Languages:**
  - English (eng)
  - Hindi/Devanagari (hin)
  - Tamil (ta)
  - Telugu (te)
  - Marathi (mr)
  - Gujarati (gu)
  - Bengali (bn)
  - Kannada (kn)
  - Malayalam (ml)
  - Odia (or)
  - Punjabi (pa)
- **Configuration:** `config/pdf-extract-kit/config.yaml` → `ocr`

---

### 5. Table Recognition Models

#### StructTable-InternVL2-1B (Primary - Latest)
- **Status:** ✅ Installed & GPU-Enabled
- **Release Date:** October 22, 2024
- **Path:** `vendor/PDF-Extract-Kit/models/TabRec/StructEqTable/`
- **Size:** 1,789.47 MB (17 files)
- **Device:** CUDA (GPU) - **REQUIRED** (will not work on CPU)
- **Features:**
  - Multi-format output: LaTeX, HTML, Markdown
  - Powered by InternVL2-1B foundation model
  - Improved Chinese recognition accuracy
  - High-quality table structure extraction
  - Handles complex table layouts
- **Files:**
  - `model.safetensors` (1,789.47 MB - main model weights)
  - `config.json` (model configuration)
  - `generation_config.json` (generation settings)
  - `preprocessor_config.json` (preprocessing config)
  - `tokenizer_config.json` (tokenizer config)
  - `vocab.json` (vocabulary - 3.23 MB)
  - `merges.txt` (BPE merges - 1.59 MB)
  - `modeling_internvl_chat.py` (model architecture)
  - `modeling_intern_vit.py` (vision transformer)
  - `configuration_internvl_chat.py` (config class)
  - `configuration_intern_vit.py` (ViT config)
  - `conversation.py` (conversation utilities)
  - Additional metadata files
- **Configuration:** `config/pdf-extract-kit/config.yaml` → `table_parsing`
- **GPU Memory Required:** ~2.5 GB VRAM

#### StructEqTable (Alternative - Not downloaded)
- **Status:** ⚪ Available but not downloaded
- **Note:** StructTable-InternVL2-1B is the newer, more capable version

---

## Model Statistics

### Total Storage Used
- **Layout Detection:** 38.82 MB
- **Formula Detection:** 333.66 MB
- **Formula Recognition:** 1,545.49 MB
- **Table Recognition:** 1,789.47 MB
- **Total:** ~3.7 GB

### GPU Memory Usage (Estimated)
- **Layout Detection:** ~500 MB
- **Formula Detection:** ~800 MB
- **Formula Recognition:** ~1.5 GB
- **OCR:** ~300 MB
- **Table Recognition:** ~2.5 GB
- **Peak Usage:** ~2.5 GB (sequential processing)

### Processing Speed (with GPU vs CPU)
| Task | CPU Speed | GPU Speed | Speedup |
|------|-----------|-----------|---------|
| Layout Detection | 1x | 5-10x | 5-10x faster |
| Formula Detection | 1x | 3-5x | 3-5x faster |
| Formula Recognition | 1x | 10-20x | 10-20x faster |
| OCR | 1x | 2-4x | 2-4x faster |
| Table Recognition | N/A | GPU Only | GPU Required |

---

## PDF-Extract-Kit v1.0.0 Updates

### ✅ All Three Major Updates Installed

1. **v1.0.0 Modular Architecture (Oct 10, 2024)**
   - Status: ✅ Active
   - Features: TASK_REGISTRY, MODEL_REGISTRY, YAML configs

2. **DocLayout-YOLO (Oct 17, 2024)**
   - Status: ✅ Installed & GPU-Enabled
   - Improvement: More accurate and faster layout detection

3. **StructTable-InternVL2-1B (Oct 22, 2024)**
   - Status: ✅ Installed & GPU-Enabled
   - Improvement: Multi-format table output, better Chinese support

---

## Configuration Files

### Primary Configuration: `config/pdf-extract-kit/config.yaml`

```yaml
tasks:
  layout_detection:
    model: layout_detection_yolo
    device: cuda  # ✅ GPU Enabled
    
  formula_detection:
    model: formula_detection_yolo
    device: cuda  # ✅ GPU Enabled
    
  formula_recognition:
    model: unimernet
    device: cuda  # ✅ GPU Enabled
    
  ocr:
    model: paddleocr
    use_gpu: true  # ✅ GPU Enabled
    
  table_parsing:
    model: struct_eqtable
    device: cuda  # ✅ GPU Enabled
```

### Secondary Configuration: `config/doc-extract-engine/config.json`

```json
{
  "processing_options": {
    "gpu_enabled": true,  // ✅ GPU Enabled
    "do_ocr": true,
    "do_table_structure": true,
    "do_formula_recognition": true
  }
}
```

---

## Model Capabilities Matrix

| Capability | Layout | Formula Det. | Formula Rec. | OCR | Table |
|------------|--------|--------------|--------------|-----|-------|
| GPU Acceleration | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multi-language | ❌ | ❌ | ❌ | ✅ | ✅ |
| LaTeX Output | ❌ | ❌ | ✅ | ❌ | ✅ |
| HTML Output | ❌ | ❌ | ❌ | ❌ | ✅ |
| Markdown Output | ❌ | ❌ | ❌ | ❌ | ✅ |
| Handwriting Support | ❌ | ❌ | ✅ | ✅ | ❌ |
| Complex Layouts | ✅ | ✅ | ✅ | ✅ | ✅ |
| Batch Processing | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Supported Document Types

### Optimized For:
- ✅ Educational textbooks (NCERT, CBSE)
- ✅ Research papers
- ✅ Technical documents
- ✅ Financial reports
- ✅ Documents with tables
- ✅ Documents with mathematical formulas
- ✅ Multi-language documents (English + Indian languages)
- ✅ Scanned documents (with OCR)
- ✅ Documents with watermarks
- ✅ Complex layouts

### Document Features Supported:
- ✅ Text extraction
- ✅ Layout detection (titles, paragraphs, captions)
- ✅ Figure detection and extraction
- ✅ Table detection and extraction
- ✅ Formula detection and recognition
- ✅ Multi-column layouts
- ✅ Headers and footers
- ✅ Page numbers
- ✅ Footnotes

---

## Model Update History

| Date | Update | Status |
|------|--------|--------|
| Oct 10, 2024 | PDF-Extract-Kit v1.0.0 released | ✅ Installed |
| Oct 17, 2024 | DocLayout-YOLO integrated | ✅ Installed |
| Oct 22, 2024 | StructTable-InternVL2-1B integrated | ✅ Installed |
| Nov 3, 2024 | GPU acceleration enabled | ✅ Configured |

---

## Maintenance and Updates

### How to Update Models

1. **Check for new releases:**
   ```bash
   # Visit: https://github.com/opendatalab/PDF-Extract-Kit/releases
   ```

2. **Download new models:**
   ```bash
   # Use Hugging Face hub
   python scripts/download-structtable-model.py
   ```

3. **Verify installation:**
   ```bash
   python scripts/verify-gpu-setup.py
   ```

### Model Download Sources

- **Hugging Face:** https://huggingface.co/opendatalab/PDF-Extract-Kit-1.0
- **ModelScope:** https://modelscope.cn/models/opendatalab/pdf-extract-kit-1.0
- **GitHub Releases:** https://github.com/opendatalab/PDF-Extract-Kit/releases

---

## Performance Benchmarks

### Typical Processing Times (with GPU)

| Document Type | Pages | Processing Time | Speed |
|---------------|-------|-----------------|-------|
| Simple textbook | 10 | ~30 seconds | 3 sec/page |
| Complex textbook with formulas | 10 | ~60 seconds | 6 sec/page |
| Document with tables | 10 | ~90 seconds | 9 sec/page |
| Mixed content (text+formulas+tables) | 10 | ~120 seconds | 12 sec/page |

**Note:** Times vary based on document complexity and GPU load.

---

## Troubleshooting

### Model Not Loading
- Check model files exist in `vendor/PDF-Extract-Kit/models/`
- Verify GPU is available: `python scripts/check-gpu-availability.py`
- Check CUDA compatibility

### Out of Memory Errors
- Reduce batch size in configuration
- Process fewer pages at a time
- Close other GPU applications

### Slow Processing
- Verify GPU is being used (check nvidia-smi)
- Check GPU memory usage
- Ensure CUDA drivers are up to date

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-03  
**Maintained By:** DigiClassroom Pro Team

