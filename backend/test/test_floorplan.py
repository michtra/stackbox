# test_floorplan.py
import sys
import os
import pytest
import numpy as np
import json
from pathlib import Path
import math

# Add the parent directory to the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from utilities.floor_plan import FloorGenerator

@pytest.mark.parametrize("center, scale, rotation", [
    ((-90, 30), (0.0001, 0.0001, 1.0), 45),
])
def test_floor_generator_offset(center, scale, rotation):
    generator = FloorGenerator(
        model="test/input/tower.stl",
        floors=5,
        base_elevation=0,
        center=center,
        scale=scale,
        rotation=rotation
    )
    generator.generateFloors()
    data = json.dumps(generator.getCoords(), indent=4)
    Path(f'test/output/test_floorplan_out_offset.json').write_text(data)
    assert generator.floors == 5
    assert generator.scale == scale
    print("✓ FloorGenerator initialization works")

def test_floor_generator_default():
    generator = FloorGenerator(
        model="test/input/tower.stl",
        floors=5
    )
    generator.generateFloors()
    data = json.dumps(generator.getCoords(), indent=4)
    Path(f'test/output/test_floorplan_out.json').write_text(data)
    assert generator.sections is not None
    assert len(generator.sections) > 0
    print("✓ Floor generation works")

if __name__ == "__main__":
    test_floor_generator_offset((-90, 30), (0.0001, 0.0001, 1.0), 45)
    test_floor_generator_default()