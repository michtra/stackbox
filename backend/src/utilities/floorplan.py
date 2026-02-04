import numpy as np
import trimesh

class FloorGenerator:
    def __init__(self, model, floors):
        self.mesh = trimesh.load_mesh(model)
        self.floors = floors
    
    def generateFloors(self):
        # For some reason, the entire model shifts to be on the zero plane, heights are from 0 to (zmax - zmin)
        heights = np.linspace(0, self.mesh.bounds[1, 2] - self.mesh.bounds[0, 2], self.floors + 1)
        sections = self.mesh.section_multiplane(
            plane_origin=self.mesh.bounds[0],
            plane_normal=[0, 0, 1],
            heights=heights[:-1]
        )
        self.sections = sections
    
    def getCoords(self):
        coords = []
        for section in self.sections:
            coords.append([list(polygon.exterior.coords) for polygon in section.polygons_closed])
        return coords
    
    def getCoordsOuter(self):
        coords = []
        for section in self.sections:
            coords.append([list(polygon.exterior.coords) for polygon in section.polygons_full])
        return coords