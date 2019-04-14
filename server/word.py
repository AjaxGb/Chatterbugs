from server.entity import Point, EntityBase, dataprop

class Word(EntityBase):
	type_id = 'word'
	
	def __init__(self, pos, angle=0, text='word'):
		super().__init__(pos, angle)
		
		self.text = text
	
	text = dataprop('text')