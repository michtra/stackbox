# test_floorplan.py
import sys
import os
import pytest
import numpy as np
import json
from pathlib import Path

# Add the parent directory to the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.utilities.floorplan import FloorGenerator

def test_floor_generator_initialization():
    generator = FloorGenerator(
        model="test/cylinder.stl",
        floors=5,
        base_elevation=0,
        center=(-96.345394436487, 30.609837208228242),
        scale=0.00000001,
        rotation=0
    )
    assert generator.floors == 5
    assert generator.scale == 0.00000001
    print("✓ FloorGenerator initialization works")

def test_generate_floors():
    generator = FloorGenerator(
        model="test/cylinder.stl",
        floors=5
    )
    generator.generateFloors()
    data = json.dumps(generator.getCoords())
    Path('test/test_floorplan_out.json').write_text(data)
    assert generator.sections is not None
    assert len(generator.sections) > 0
    print("✓ Floor generation works")

if __name__ == "__main__":
    test_floor_generator_initialization()
    test_generate_floors()