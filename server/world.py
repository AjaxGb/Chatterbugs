
class ChatterUniverse:
	def __init__(self):
		self._worlds = {}
		self.add_world(ChatterWorld('default'))
	
	@property
	def default(self):
		return self._worlds['default']
	
	def add_world(self, world):
		if self._worlds.setdefault(world.id, world) != world:
			raise KeyError(f'{world.id} is already in use')

class ChatterWorld:
	def __init__(self, id):
		self.id = id
		self.clients = {}
		self.value = 0
	
	def add_client(self, client):
		#self.clients[client.face] = client
		pass # TODO
	
	def remove_client(self, client):
		#del self.clients[client.face]
		pass # TODO
	
	def tick(self):
		pass
