#!/usr/bin/env python
"""Quick test script for Excel parsing."""
import sys
import json
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / 'src'))

from utilities.file_loader import excel_loader

if __name__ == "__main__":
    result = excel_loader('test/Rent Roll Example.xlsx')
    print(json.dumps(result, indent=2))
