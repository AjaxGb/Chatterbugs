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
	
	const engine = window.engine = new Engine(
		document.getElementById('main-canvas'), socket);
	engine.start();
	
	function spawnEntity(id, data) {
		let cls = undefined;
		switch (data.type) {
			case 'ant': {
				if (id === playerFace) {
					cls = PlayerAnt;
				} else {
					cls = RemoteAnt;
				}
				break;
			}
		}
		
		if (cls === undefined) {
			console.error('Unknown entity type', data.type);
		} else {
			engine.addObject(new cls(id, data));
		}
	}
	
	while (true) {
		const mess = await socket.recv();
		const p = Packets.parse(mess.data);
		
		switch (p._type) {
			case Packets.S_OpenWorld: {
				engine.killAllObjects();
				
				for (let id in p.entities) {
					spawnEntity(id, p.entities[id]);
				}
				break;
			}
			case Packets.S_UpdateWorld: {
				for (let obj of engine.objects) {
					if (!obj.netID) continue;
					
					const diff = p.entities[obj.netID];
					if (!diff) {
						obj.isDead = true;
						continue;
					}
					
					delete p.entities[obj.netID];
					obj.loadDiff(diff);
				}
				
				for (let id in p.entities) {
					spawnEntity(id, p.entities[id]);
				}
				
				break;
			}
			case Packets.S_CloseWorld: {
				engine.killAllObjects();
				break;
			}
			default: {
				console.error('Unexpected packet received!', p, mess);
			}
		}
	}
}
