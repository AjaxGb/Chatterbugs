import asyncio
import server.packets_json as packets
from websockets.exceptions import ConnectionClosed
from server.entity import Point
from server.box import Box
from server.plant import Plant

class WSClient:
	def __init__(self, ws, face):
		self.face = face
		self.ws = ws
		self.world = None
		self.entity = None
	
	def __hash__(self):
		return hash(self.face)
	
	async def send(self, packet):
		try:
			return await self.ws.send(packet)
		except ConnectionClosed:
			pass
	
	async def recv(self):
		return packets.unpack(self, await self.ws.recv())
	
	async def close(self, reason):
		print('close')
		await self.ws.close(reason=reason)
	
	def log(self, *args):
		print(f'[{self.face}]', *args)
	
	async def run(self):
		self.log('Start running')
		
		try:
			while True:
				if not self.ws.open:
					break
				
				p = await self.recv()
				
				if p.ptype == packets.C_UpdateSelf:
					if hasattr(p, 'pos'):
						self.entity.pos = Point(*p.pos)
					if hasattr(p, 'rot'):
						self.entity.rot = p.rot
					if hasattr(p, 'speech'):
						self.entity.speech = p.speech
					if hasattr(p, 'bellType'):
						self.entity.bell_type = p.bellType
					if hasattr(p, 'gut'):
						for char, count in p.gut.items():
							self.entity.gut[char] = count
					if hasattr(p, 'textActs'):
						for act in p.textActs:
							try:
								self.entity.add_text_act(act)
							except Exception as e:
								self.log('Failed to load text act', act, e)
				elif p.ptype == packets.C_MakeBox:
					box = Box(p.pos, p.rot, p.text)
					self.world.add_entity(box)
				elif p.ptype == packets.C_MakePlant:
					plant = Plant(p.pos, p.rot, p.text)
					self.world.add_entity(plant)
				else:
					self.log('UNEXPECTED PACKET:', p)
		except BaseException as e:
			self.log(e)
			raise
		finally:
			self.log('Stop running')
