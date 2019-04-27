import Socket from './socket.js';
import { EntityTypeRegistry } from './entity.js';
import Engine from './engine.js';
import Ant from './ant.js';
import Box from './box.js';
import Plant from './plant.js';
import Word from './word.js';
import TerrBlock from './terrblock.js';
import { waitMillis } from './utils.js';

const faceInput = document.getElementById('face-input');
const connectForm = document.getElementById('connect');

const wsConnectUrl = new URL('connect', location);
wsConnectUrl.protocol = 'ws:';

connectForm.addEventListener('submit', runGame, {once: true});

async function runGame() {
	const playerFace = faceInput.value;
	connectForm.remove();
	
	if (playerFace.length !== 5) {
		alert('Face must be 5 characters long!');
		return;
	}
	
	const socket = new Socket(wsConnectUrl);
	window.socket = socket;
	
	await socket.send(playerFace);
	
	const entityTypes = new EntityTypeRegistry(playerFace)
		.register(Ant)
		.register(Box)
		.register(Plant)
		.register(Word)
		.register(TerrBlock)
		;
	
	const engine = window.engine = new Engine(
		document.getElementById('main-canvas'),
		socket,
		entityTypes);

	const [bgTile] = await engine.loadImages(['ChatterTile'], 'img/', '.png');
	engine.bgFill = engine.ctx.createPattern(bgTile, 'repeat');
	
	try {
		await engine.run();
	} catch (e) {
		if (e.type === 'close') {
			engine.ctx.textAlign = 'center';
			engine.ctx.textBaseline = 'middle';
			
			
			engine.ctx.font = '50px monospace';
			const mainWidth = engine.ctx.measureText('Connection to server lost.').width;
			engine.ctx.font = '30px monospace';
			const subWidth = engine.ctx.measureText('Attempting to reconnect...').width;
			const textWidth = Math.max(mainWidth, subWidth);
			
			engine.ctx.fillStyle = '#ddd';
			engine.ctx.fillRect(
				(engine.width - textWidth) / 2 - 30, engine.height / 2 - 110,
				textWidth + 60, 180);
			
			engine.ctx.fillStyle = '#000';
			
			engine.ctx.font = '50px monospace';
			engine.ctx.fillText('Connection to server lost.',
				engine.width / 2, engine.height / 2 - 50, engine.width);
			
			engine.ctx.font = '30px monospace';
			engine.ctx.fillText('Attempting to reconnect...',
				engine.width / 2, engine.height / 2 + 30, engine.width);
			
			await waitMillis(1000);
			
			// Wait for server to come back online
			while (true) {
				try {
					const resp = await fetch('', {method: 'HEAD', cache: 'no-store'});
					if (resp.ok) {
						console.log(resp);
						window.location = window.location;
						break;
					}
				} catch (e) {
					// Do nothing
				}
			}
		}
	}
}
