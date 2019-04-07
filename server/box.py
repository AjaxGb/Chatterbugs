from server.entity import Point, EntityBase, dataprop

class Box(EntityBase):
	type_id = 'box'
	
	def __init__(self, pos, angle=0, text=''):
		super().__init__(pos, angle)
		
		self.text = text
	
	text = dataprop('text')
