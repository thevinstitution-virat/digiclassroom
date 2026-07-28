import os
import re

lib_dir = r"J:\Apps\DigiClassroomPro\src\lib\agents"

# Search for catch blocks returning empty strings or raw strings
for root, _, files in os.walk(lib_dir):
    for file in files:
        if not file.endswith('.ts'):
            continue
            
        filepath = os.path.join(root, file)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Add import if we need to throw AgentExecutionError
        if 'AgentExecutionError' not in content and 'catch (' in content:
            if re.search(r'catch \([^)]+\) {\s*logger\.error\([^\)]+\);\s*return [\'"][^\'"]*[\'"];?\s*}', content):
                 # Replace return '...' with throw
                 content = re.sub(
                     r'(catch \([^)]+\) {\s*logger\.error\([^)]+\);\s*)return [\'"][^\'"]*[\'"];?(\s*})',
                     r'\1throw new AgentExecutionError("Agent execution failed");\2',
                     content
                 )
                 
                 # Add import
                 lines = content.split('\n')
                 insert_idx = 0
                 for i, line in enumerate(lines[:15]):
                     if line.startswith('import { logger }'):
                         insert_idx = i + 1
                 lines.insert(insert_idx, "import { AgentExecutionError } from '@/lib/errors';")
                 content = '\n'.join(lines)
                 
                 with open(filepath, 'w', encoding='utf-8') as f:
                     f.write(content)
                 print(f"Patched {filepath}")

