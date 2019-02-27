import asyncio
import server.packets as packets
from websockets.exceptions import ConnectionClosed

class WSClient:
	all_clients = {}
	
	def __init__(self, ws, face):
		self.face = face
		self.ws = ws
	
	async def __aenter__(self):
		if WSClient.all_clients.setdefault(self.face, self) != self:
			await self.ws.close(reason='Face already in use')
			raise KeyError('Face already in use')
		
		return self
	
	async def __aexit__(self, err_type, err, tb):
		del WSClient.all_clients[self.face]
		
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
		data = packet.pack()
		for client in cls.all_clients.values():
			if client == ignore:
				continue
			asyncio.create_task(client.ws.send(data))
	
	def close(self, reason):
		print('close')
		self.loop.cancel()
		self.ws.close(reason=reason)
		self._closed()
	
	async def run(self):
		sp = packets.S_SpawnPlayer(None, self.face, 10, 10)
		WSClient.broadcast(sp)
		
		while True:
			try:
				data = await self.ws.recv()
				p = packets.unpack(data)
			except Exception:
				print("Invalid packet received")
				break
			
			if type(p) == packets.R_MoveToPos:
				r = packets.S_MovePlayer(None, p.face, p.x, p.y)
				WSClient.broadcast(r)