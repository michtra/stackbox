import numpy as np
import trimesh

class FloorGenerator:
    def __init__(self, model, floors, base_elevation = 0.0, center = (0, 0), scale = 1.0, rotation = 0.0):
        self.mesh = trimesh.load_mesh(model)
        self.floors = floors
        self.base_elevation = base_elevation
        self.center = center
        self.scale = scale
        self.rotation = rotation

        self._apply_transformation()
    
    def _apply_transformation(self):
        # Applying scale, rotation, and centering
        if self.scale != 1.0:
            self.mesh.apply_scale(self.scale)
        
        if self.rotation != 0:
            rotation_matrix = trimesh.transformations.rotation_matrix(
                np.radians(self.rotation),
                [0, 0, 1],
                self.mesh.centroid
            )
            self.mesh.apply_transform(rotation_matrix)

    def generateFloors(self):
        # Find center
        plane_origin = (
            (self.mesh.bounds[0, 0] + self.mesh.bounds[1, 0]) / 2 + self.center[0],
            (self.mesh.bounds[0, 1] + self.mesh.bounds[1, 1]) / 2 + self.center[1],
            self.mesh.bounds[0, 2]
        )
        
        # For some reason, the entire model shifts to be on the zero plane, heights are from 0 to (zmax - zmin)
        heights = np.linspace(0, self.mesh.bounds[1, 2] - self.mesh.bounds[0, 2], self.floors + 1)
        sections = self.mesh.section_multiplane(
            plane_origin=plane_origin,
            plane_normal=[0, 0, 1],
            heights=heights[:-1]
        )

        heights = heights + self.base_elevation
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
    
    def getFloorAreas(self):
        areas = []
        for section in self.sections:
            areas.append(sum(polygon.area for polygon in section.polygons_full))
        return areas
        
    def getMetadata(self):
        return {
            "num_floors": len(self.sections),
            "total_height": self.mesh.bounds[1, 2] - self.mesh.bounds[0,2],
            "base_elevation": self.base_elevation,
            'scale': self.scale,
            'rotation': self.rotation,
            'center': self.center,
            'bounds': self.mesh.bounds.tolist()
        }