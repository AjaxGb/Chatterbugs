from server.entity import Point, EntityBase, dataprop
import random

class Plant(EntityBase):
    type_id = 'plant'

    def __init__(self, pos, angle=0, text='plant'):
        super().__init__(pos, angle)

        self.text = text
        self.words = []
    
    def branch(self):
        if self.world != None:
            if len(self.words) == 0:
                w = Word(super().pos, super().rot-90, self.text, self)
                self.text = ''
                self.words.append(w)
                self.world.add_entity(w)
            elif len(self.words) < 20:
                self.words[random.randint(0,len(self.words)-1)].branch()

    text = dataprop("text")
    words = []

class Word(EntityBase):
    type_id = 'word'
    
    def __init__(self, pos, angle=0, text='word', parent_plant=None):
        super().__init__(pos, angle)
        self.text = text
        self.parent_plant = parent_plant

    def branch(self):
        w = Word(super().pos, super().rot + random.randrange(-30,30,1), "-------------------")
        w.parent_plant = self.parent_plant
        self.branches.append(w)
        self.parent_plant.words.append(w)
        self.world.add_entity(w)
    
    text = dataprop('text')
    branches = []
    parent_plant = None