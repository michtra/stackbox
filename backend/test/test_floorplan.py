# test_floorplan.py
import sys
import os
import pytest
import numpy as np

# Add the parent directory to the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.utilities.floorplan import FloorGenerator

def test_floor_generator_initialization():
    generator = FloorGenerator(
        model="cylinder.stl",
        floors=5,
        base_elevation=0,
        center=(0, 0),
        scale=1.0,
        rotation=0
    )
    assert generator.floors == 5
    assert generator.scale == 1.0
    print("✓ FloorGenerator initialization works")

def test_generate_floors():
    generator = FloorGenerator(
        model="cylinder.stl",
        floors=5
    )
    generator.generateFloors()
    assert generator.sections is not None
    assert len(generator.sections) > 0
    print("✓ Floor generation works")

if __name__ == "__main__":
    test_floor_generator_initialization()
    test_generate_floors()