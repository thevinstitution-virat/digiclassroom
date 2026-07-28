import sys
from huggingface_hub import list_repo_files

repo_id = "opendatalab/pdf-extract-kit-1.0"
print(f"Listing files for {repo_id}...")
files = list_repo_files(repo_id)
for f in files:
    print(f)
