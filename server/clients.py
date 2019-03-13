import asyncio
import server.packets_json as packets
from websockets.exceptions import ConnectionClosed

class WSClient:
	all_clients = {}
	
	def __init__(self, ws, face, x, y):
		self.face = face
		self.ws = ws
		self.pos = (x, y)
	
	async def __aenter__(self):
		if WSClient.all_clients.setdefault(self.face, self) != self:
			await self.ws.close(reason='Face already in use')
			raise KeyError('Face already in use')
		
		return self
	
	async def __aexit__(self, err_type, err, tb):
		del WSClient.all_clients[self.face]
		WSClient.broadcast(
			packets.S_RemovePlayer(face=self.face))
		
		if self.ws.open:
			print('Client exited without closing socket!')
		
		if err_type == asyncio.CancelledError:
			print('Cancelled internally')
			return True
		if err_type == ConnectionClosed:
			print('Closed abnormally:', err.code, err.reason)
			return True
	
	@classmethod
	def broadcast(cls, packet, ignore=None):
		for client in cls.all_clients.values():
			if client == ignore:
				continue
			asyncio.create_task(client.ws.send(packet))
	
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
		
		# Notify all other clients of self
		WSClient.broadcast(
			packets.S_AddPlayer(face=self.face, pos=self.pos),
			ignore=self)
		self.log('Notified others')
		
		# Notify self of all clients (including self)
		for client in WSClient.all_clients.values():
			await self.send(
				packets.S_AddPlayer(face=client.face, pos=client.pos))
		self.log('Notified self')
		
		while True:
			p = await self.recv()
			
			if p.ptype == packets.C_MoveToPos:
				self.pos = tuple(p.pos)
				WSClient.broadcast(
					packets.S_MovePlayer(face=self.face, pos=self.pos),
					ignore=self)
			else:
				self.log('UNEXPECTED PACKET:', p)
