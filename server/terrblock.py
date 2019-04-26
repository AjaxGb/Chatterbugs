from server.entity import Point, EntityBase, dataprop

class TerrBlock(EntityBase):
    type_id = 'terrblock'

    def __init__(self, pos, scale, angle=0):
        super().__init__(pos, angle)

        self.scale = scale
    
    scale = dataprop('scale')
