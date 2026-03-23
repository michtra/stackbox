#!/usr/bin/env python
"""Quick test script for Excel parsing."""
import sys
import json
from pathlib import Path
from uuid import UUID

from utilities.file_loader import excel_load_to_db

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / 'src'))

from utilities.file_loader import excel_loader

TEST_BUILDING_ID = UUID("8ba3b1d8-7ced-4777-9651-4ebe5cbe55c3")

def test_excel_json():
    result = excel_loader('test/input/Rent Roll Example.xlsx')
    print(json.dumps(result, indent=2))

def test_excel_load_to_db():
    excel_load_to_db("test/input/Rent Roll Example.xlsx", building_id=TEST_BUILDING_ID)