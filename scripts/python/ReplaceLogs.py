import os
import re

lib_dir = r"J:\Apps\DigiClassroomPro\src\lib"
logger_import = "import { logger } from '@/lib/logger';\n"

for root, _, files in os.walk(lib_dir):
    for file in files:
        if not file.endswith(('.ts', '.tsx')):
            continue
            
        filepath = os.path.join(root, file)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if 'console.log' in content or 'console.error' in content or 'console.warn' in content:
            # Need to replace
            content = content.replace('console.log', 'logger.info')
            content = content.replace('console.error', 'logger.error')
            content = content.replace('console.warn', 'logger.warn')
            
            # Check if logger is already imported
            if "import { logger }" not in content:
                # Add to the top after 'use server' or 'use client' if present
                lines = content.split('\n')
                insert_idx = 0
                for i, line in enumerate(lines[:10]):
                    if line.startswith(('"use server"', "'use server'", '"use client"', "'use client'")):
                        insert_idx = i + 1
                
                lines.insert(insert_idx, logger_import)
                content = '\n'.join(lines)
                
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated {filepath}")
