import json
from uuid import UUID

from utilities.floorplan import FloorGenerator
from utilities.file_storage import save_processed_json


def excelLoader(filepath):
    """Processes and loads Excel files into DB.

    Args:
        filepath: Path to the Excel file.
    """


def stackplanLoader(filepath, floors, building_id: UUID):
    """Processes a 3D model file and saves extracted floor coordinates as JSON.

    Args:
        filepath: Path to the 3D model file.
        floors: Number of floors the building has.
        building_id: UUID of the building for organized storage.
    """
    stackingplan = FloorGenerator(filepath, floors)
    stackingplan.generateFloors()
    data = json.dumps(stackingplan.getCoords())
    save_processed_json(building_id, data)
