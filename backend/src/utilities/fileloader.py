from routers import models
import time

from floorplan import FloorGenerator

async def excelLoader(filepath):
    """Processes and loads Excel files into DB.

    Args:
        filename (str): Path to file or the URI to file.
    """

def stackplanLoader(filepath, floors):
    """Processes and loads Excel files into a JSON file.

    Args:
        filename (str): Path to the 3D model.
        floors (int): Number of floors the building has. TODO: We'll probably have to grab this from the DB if we eventually move there
    """
    stackingplan = FloorGenerator(filepath, floors)
    stackingplan.generateFloors()
    with open(f'resources/{time.time_ns()}', 'w') as f:
        f.write(stackingplan.getCoords())