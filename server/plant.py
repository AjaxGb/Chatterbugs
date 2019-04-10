from server.entity import Point, EntityBase, dataprop
from server.word import Word

class Plant(EntityBase):
    type_id = 'plant'

    def __init__(self, pos, angle=0, text='plant'):
        super().__init__(pos, angle)

        self.text = text

        # This might be a place to import a pre-existing implementation of trees.
        # For the moment a list will do fine, but it'll be a bit annoying to implement detaching trees
        self.words = []
    
    text = dataprop("text")