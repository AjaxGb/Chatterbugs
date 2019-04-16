from server.entity import Point, EntityBase, dataprop
from server.markov import MarkovSource
import random
import math

class Plant(EntityBase):
    type_id = 'plant'

    def __init__(self, pos, angle=0, text='plant'):
        super().__init__(pos, angle)

        self.text = text
        self.words = []
    
    def branch(self):
        if self.world != None:
            if len(self.words) == 0:
                length = (len(self.text)+1)*5
                angle = super().rot-math.pi/2
                x, y = super().pos
                newpos = (x + math.cos(angle)*(length+15), y + math.sin(angle)*(length+15))
                w = Word(newpos, angle, self.text, self)
                self.text = ''
                self.words.append(w)
                self.world.add_entity(w)
            elif len(self.words) < 25:
                # Structural determination. x^y A tree may be best represented by y of around 0.5; a shrub by y = 3
                # index = random.randint(0, len(self.words)-1)
                index = int(math.pow(random.random(),0.5)*(len(self.words)-0.001)) # converts to int via truncation
                self.words[index].branch()
                self.words[-1].parent_word = self.words[index].text

    text = dataprop("text")
    words = []

class Word(EntityBase):
    type_id = 'word'
    
    def __init__(self, pos, angle=0, text='word', parent_plant=None):
        super().__init__(pos, angle)
        self.text = text
        self.parent_plant = parent_plant
        self.branches = []

    def branch(self):
        # 2 branch limit for trees.
        if len(self.branches) < 2:
            # First, calculate offset based on current word
            x, y = super().pos
            x = x+math.cos(super().rot)*(len(self.text)+1)*5
            y = y+math.sin(super().rot)*(len(self.text)+1)*5
            # next, calculate offset based on future word.
            next_word = self.world.markov.chain(self.text, self.parent_word) # Markov goes here!

            # This should be tree-only code.
            new_angle = 0
            if len(self.branches) == 1:
                new_angle = super().rot + (super().rot - self.branches[0].rot)*5*random.random()
            else:
                new_angle = super().rot + (random.random()-0.5)*0.5
            if abs(new_angle - self.parent_plant.rot - math.pi/2) > math.pi/3:
                new_angle = (new_angle*2+self.parent_plant.rot-math.pi/2)/3
            
            good = True
            for b in self.branches:
                if abs(b.rot - new_angle) < 0.3:
                    good = False
            if good:
                w = Word((x+math.cos(new_angle)*(len(next_word)+1)*5, y+math.sin(new_angle)*(len(next_word)+1)*5), new_angle, next_word)
                w.parent_plant = self.parent_plant
                self.branches.append(w)
                self.parent_plant.words.append(w)
                self.world.add_entity(w)
    
    text = dataprop('text')
    branches = []
    parent_plant = None
    parent_word = ''