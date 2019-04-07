from server.entity import Point, EntityBase, dataprop

class Ant(EntityBase):
	type_id = 'ant'
	
	def __init__(self, client, pos, angle=0):
		super().__init__(pos, angle, id=client.face,)
		self.client = client
		self.correcting = False
		
		self.speech = None
	
	speech = dataprop('speech')
