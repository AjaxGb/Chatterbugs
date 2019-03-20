import asyncio
from contextlib import asynccontextmanager
from server.entity import Point
from server.ant import Ant
import server.packets_json as packets

class ChatterUniverse:
	def __init__(self):
		self.worlds = {}
		self.clients = {}
		self.add_world(ChatterWorld('default'))
	
	async def run(self):
		while True:
			await asyncio.sleep(1 / 30)
			for world in self.worlds.values():
				try:
					world.broadcast_tick()
				except Exception as e:
					print('Exception while ticking world', world.id)
					print(e)
	
	@property
	def default(self):
		return self.worlds['default']
	
	def add_world(self, world):
		if self.worlds.setdefault(world.id, world) != world:
			raise KeyError(f'{world.id} is already in use')
		if world.universe:
			raise ValueError('World is already part of a universe')
		world.universe = self
	
	@asynccontextmanager
	async def add_client(self, client, world=None):
		if client.face in self.clients:
			raise KeyError(f'{client.face} is already in use')
		
		world = world or self.default
		
		if self.worlds.get(world.id) != world:
			raise ValueError('Asked to join unknown world')
		
		self.clients[client.face] = client
		world.add_client(client)
		
		try:
			yield client
		finally:
			del self.clients[client.face]
			if client.world:
				client.world.remove_client(client)
	
	def broadcast(self, packet, ignore=None):
		for client in self.clients.values():
			if client == ignore:
				continue
			asyncio.create_task(client.ws.send(packet))

class ChatterWorld:
	def __init__(self, id):
		self.id = id
		self.universe = None
		self.entities = {}
		self.clients = {}
	
	def add_client(self, client):
		if (client.world):
			client.world.remove_client(client)
		
		self.clients[client.face] = client
		client.world = self
		client.entity = Ant(client, Point(100, 100), 0)
		self.add_entity(client.entity)
		
		# TODO: Limit to nearby entities
		asyncio.create_task(client.send(packets.S_OpenWorld(entities={
			i: e.data for i, e in self.entities.items()
		})))
	
	def remove_client(self, client):
		result = False
		
		if self.clients.get(client.face) == client:
			del self.clients[client.face]
			client.world = None
			asyncio.create_task(client.send(packets.S_CloseWorld()))
			result = True
		
		if client.entity and self.remove_entity(client.entity):
			client.entity = None
			result = True
		
		return result
	
	def add_entity(self, entity):
		if self.entities.setdefault(entity.id, entity) != entity:
			raise KeyError(f'{entity.id} is already in use')
		entity.world = self
	
	def remove_entity(self, entity):
		if self.entities.get(entity.id) != entity:
			return False
		else:
			del self.entities[entity.id]
			return True
	
	def broadcast(self, packet, ignore=None):
		for client in self.clients.values():
			if client == ignore:
				continue
			asyncio.create_task(client.send(packet))
	
	def broadcast_tick(self):
		self._tick()
		
		# Assert: every entity's temp_seen_by is empty
		
		for client in self.clients.values():
			
			entity_diffs = {}
			# TODO: Limit to nearby entities
			for entity in self.entities.values():
				if client in entity.seen_by:
					entity_diffs[entity.id] = entity.diff
				else:
					entity_diffs[entity.id] = entity.data
				entity.temp_seen_by.add(client)
			
			asyncio.create_task(client.send(packets.S_UpdateWorld(
				entities=entity_diffs)))
		
		for entity in self.entities.values():
			# Swap seen_by and temp_seen_by, clear the new temp
			(
				entity.seen_by,
				entity.temp_seen_by
			) = (
				entity.temp_seen_by,
				entity.seen_by
			)
			entity.temp_seen_by.clear()
			
			entity.diff.clear()
	
	def _tick(self):
		pass
