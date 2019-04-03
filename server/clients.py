import asyncio
import server.packets_json as packets
from server.entity import Point
from server.box import Box

class WSClient:
	def __init__(self, ws, face):
		self.face = face
		self.ws = ws
		self.world = None
		self.entity = None
	
	def __hash__(self):
		return hash(self.face)
	
	async def send(self, packet):
		return await self.ws.send(packet)
	
	async def recv(self):
		return packets.unpack(self, await self.ws.recv())
	
	def close(self, reason):
		print('close')
		self.loop.cancel()
		self.ws.close(reason=reason)
		self._closed()
	
	def log(self, *args):
		print(f'[{self.face}]', *args)
	
	async def run(self):
		self.log('Start running')
		
		while True:
			p = await self.recv()
			
			if p.ptype == packets.C_UpdateSelf:
				if hasattr(p, 'pos'):
					self.entity.pos = Point(*p.pos)
				if hasattr(p, 'rot'):
					self.entity.rot = p.rot
				if hasattr(p, 'speech'):
					self.entity.speech = p.speech
			elif p.ptype == packets.C_MakeBox:
				box = Box(p.pos, p.rot, p.text)
				self.world.add_entity(box)
			else:
				self.log('UNEXPECTED PACKET:', p)
