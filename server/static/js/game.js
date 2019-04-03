import Socket from './socket.js';
import { EntityTypeRegistry } from './entity.js';
import Engine from './engine.js';
import { Ant } from './ant.js';

const faceInput = document.getElementById('face-input');
const connectButton = document.getElementById('connect');
window.bellSelect = document.getElementById('bells');

const wsConnectUrl = new URL('connect', location);
wsConnectUrl.protocol = 'ws:';

connectButton.addEventListener('click', runGame);

async function runGame() {
	const playerFace = faceInput.value;
	connectButton.removeEventListener('click', runGame);
	connectButton.disabled = true;
	faceInput.disabled = true;
	
	if (playerFace.length !== 5) {
		alert('Face must be 5 characters long!');
		return;
	}
	
	const socket = new Socket(wsConnectUrl);
	window.socket = socket;
	
	await socket.send(playerFace);
	
	const entityTypes = new EntityTypeRegistry(playerFace)
		.register(Ant)
		;
	
	const engine = window.engine = new Engine(
		document.getElementById('main-canvas'),
		socket,
		entityTypes);
	
	await engine.run();
}
