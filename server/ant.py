from server.entity import Point, EntityBase

class Ant(EntityBase):
	type_id = 'ant'
	
	def __init__(self, client, pos, angle=0):
		super().__init__(pos, angle, id=client.face,)
		self.client = client
