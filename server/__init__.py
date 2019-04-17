import os
import asyncio
from sanic import Sanic
from server.clients import WSClient
from server.world import ChatterUniverse, ChatterWorld

app = Sanic()

universe = ChatterUniverse()
app.add_task(universe.run())

os.chdir(os.path.dirname(__file__))
app.static('/js', './static/js', content_type='application/javascript')
app.static('/img', './static/img')
app.static('/', './static/html/index.html')

@app.websocket('/connect')
async def client_connect(request, ws):
	face = await ws.recv()
	
	print('Receive connection:', face)
	
	client = WSClient(ws, face)
	async with universe.add_client(client):
		await client.run()
	
	if client.ws.open:
		print('Client exited without closing socket!')
