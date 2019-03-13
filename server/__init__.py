import os
import asyncio
from sanic import Sanic
from server.clients import WSClient
from server.world import ChatterUniverse, ChatterWorld

universe = ChatterUniverse()

app = Sanic()

os.chdir(os.path.dirname(__file__))
app.static('/js', './static/js', content_type='application/javascript')
app.static('/', './static/html/index.html')

@app.websocket('/connect')
async def client_connect(request, ws):
	face = await ws.recv()
	
	print('Receive connection:', face)
	
	async with WSClient(ws, face, 100, 100, 0) as client:
		await client.run()
