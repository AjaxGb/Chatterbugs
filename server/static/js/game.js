import Engine from './engine.js';
import Vec2 from './vec2.js';
import { PlayerAnt, RemoteAnt } from './ant.js';
import Socket from './socket.js';
import { waitMillis } from './utils.js';
import Packets from './packets-json.js';

const faceInput = document.getElementById('face-input');
const connectButton = document.getElementById('connect');

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
	
	const engine = new Engine(document.getElementById('main-canvas'), socket);
	window.engine = engine;
	
	engine.start();
	
	while (true) {
		const mess = await socket.recv();
		const p = Packets.parse(mess.data);
		
		switch (p._type) {
			case Packets.S_AddPlayer: {
				const type = (p.face === playerFace)
					? PlayerAnt
					: RemoteAnt;
				engine.addObject(new type(p.face, new Vec2(...p.pos), p.rot));
				break;
			}
			case Packets.S_RemovePlayer: {
				if (p.face === playerFace) {
					throw new Error('Told to despawn self?');
				} else {
					engine.getNetObj('ant', p.face).isDead = true;
				}
				break;
			}
			case Packets.S_MovePlayer: {
				const ant = engine.getNetObj('ant', p.face);
				ant.pos = new Vec2(...p.pos);
				ant.rot = p.rot;
				break;
			}
			default: {
				console.error('Unexpected packet received!', p, mess);
			}
		}
	}
}
