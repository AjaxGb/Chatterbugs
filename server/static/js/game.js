import Engine from './engine.js';
import Vec2 from './vec2.js';
import Ant from './ant.js';
import Socket from './socket.js';
import { waitMillis } from './utils.js';

const faceInput = document.getElementById('face-input');
const connectButton = document.getElementById('connect');

const wsConnectUrl = new URL('connect', location);
wsConnectUrl.protocol = 'ws:';

const textEncoder = new TextEncoder('utf-8');
const textDecoder = new TextDecoder('utf-8');

connectButton.addEventListener('click', async function() {
	
	const face = faceInput.value;
	
	if (face.length !== 5) {
		alert('Face must be 5 characters long!');
		return;
	}
	
	const socket = new Socket(wsConnectUrl);
	window.socket = socket;
	
	await socket.send(textEncoder.encode(face));
	const spawnMess = await socket.recv(m => {
		console.log(m);
		const data = new DataView(m.data);
		return data.getUint8(0) === 100;
	});
	
	const engine = new Engine(document.getElementById('main-canvas'));
	window.engine = engine;
	
	engine.addObject(new Ant('o<w>o', new Vec2(70, 200), 0));
	
	engine.start();
});
