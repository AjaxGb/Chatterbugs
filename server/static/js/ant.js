import Vec2 from './vec2.js';
import Entity from './entity.js';
import Packets from './packets-json.js';
import { lerpAngle } from './utils.js';

const antNetNorms = {
	pos: Vec2.fromIter,
	rot: null,
	speech: null,
};

const antNetLerps = {
	pos: Vec2.lerpPosition,
	rot: lerpAngle,
};

export default class Ant extends Entity {
	static selectEntityClass(registry, id, data) {
		if (!registry.playerFace) {
			throw new Error(
				'Tried to spawn Ant before setting playerFace');
		}
		return (registry.playerFace === id)
			? PlayerAnt
			: RemoteAnt;
	}
	
	constructor(face, data) {
		super(face, data);
		
		this.segments = [0, 0];
		
		this.speed = 100;
		this.angSpeed = 0.05;
	}
	
	get speechBox() {
		if (!this._speechBox) {
			this._speechBox = document.createElement('textarea');
			this._speechBox.classList.add('ant-speech-box');
			this._speechBox.cols = 30;
			this._speechBox.disabled = true;
			document.body.appendChild(this._speechBox);
		}
		return this._speechBox;
	}
	
	get speech() {
		return (this.speechBox.classList.contains('typing'))
			? this.speechBox.value
			: null;
	}
	
	set speech(value) {
		if (value === undefined) value = null;
		
		const oldSpeech = this.speech;
		if (value === oldSpeech) return;
		
		if ((oldSpeech === null) !== (value === null)) {
			this.speechBox.classList.toggle('typing');
		}
		
		if (value !== null) {
			this.speechBox.value = value;
			this.speechBox.rows = value.split('\n').length;
		} else {
			this.speechBox.disabled = true;
		}
	}
	
	updateSpeechBoxPos(engine) {
		const rect = this.speechBox.getBoundingClientRect();
		const pagePos = engine.worldToPage(this.pos);
		this.speechBox.style.top = (pagePos.y - rect.height)+'px';
		this.speechBox.style.left = (pagePos.x - rect.width/2)+'px';
	}
	
	onDraw({engine, ctx}) {
		ctx.save();
		ctx.font = '20px monospace';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.translate(...this.pos);
		ctx.rotate(this.rot);
		
		let i = 0;
		for (; i < this.segments.length; i++) {
			ctx.save();
			ctx.translate(0, -25);
			ctx.rotate(this.segments[i]);
			ctx.translate(0, -25);
		}
		
		// Butt
		ctx.strokeRect(-40, 18 - 80, 80, 80);
		
		for (; i > 1; i--) {
			ctx.restore();
			// Segment
			ctx.strokeRect(-18, -18, 36, 36);
		}
		ctx.restore();
		
		// Head
		ctx.strokeRect(-40, -18, 80, 36);
		
		ctx.fillText(this.id, 0, 0);
		
		if (this.speech !== null) {
			this.updateSpeechBoxPos(engine);
		}
		ctx.restore();
	}
	
	onDie() {
		this.speechBox.remove();
	}
}

Ant.prototype.netNormalizers = antNetNorms;
Ant.prototype.netLerps = antNetLerps;
Ant.prototype.typeID = 'ant';

export class PlayerAnt extends Ant {
	constructor(face, {...data}) {
		super(face, data);
		
		this.secsSinceNet = 0;
		this.broadcastDiff = null;
		
		this.speechBox.addEventListener('input', e => {
			const speech = this.speech;
			if (speech === null) return;
			this.speechBox.rows = speech.split('\n').length;
			this.setNetProps({speech}, false);
		});
		
		this.speechBox.addEventListener('focusout', () => {
			if (this.speech !== null) {
				this.speechBox.focus({preventScroll: true});
			}
		});
		
		this.speechBox.addEventListener('keydown', e => {
			if (e.code === 'Escape') this.speech = null;
			
			if (e.code === 'Enter' && !e.shiftKey) {
				const speech = this.speech;
				this.speech = null;
				
				if (speech && speech.startsWith('BOX:')) {
					engine.socket.send(
						Packets.C_MakeBox.unparse({
							pos: this.pos,
							rot: this.rot,
							text: speech.substr(4),
						}));
				}
			}
			
			if (bellSelect.value) {
				// TODO: Fix hacks
				engine.audio[`play${bellSelect.value}Bell`](
					e.key.codePointAt(0), 1);
			}
		});
		
		addEventListener('keydown', e => {
			const tagName = e.target.tagName;
			if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
				return;
			}
			
			if (e.code === 'KeyT') {
				this.speech = '';
				this.speechBox.disabled = false;
				this.speechBox.focus({preventScroll: true});
				e.preventDefault();
			}
		});
	}
	
	setNetProps(diff, assignSelf=true) {
		this.broadcastDiff = Object.assign(
			this.broadcastDiff || {}, diff);
		if (assignSelf) Object.assign(this, diff);
	}
	
	onTick({dt, engine}) {
		if (engine.keyStates.KeyA || engine.keyStates.ArrowLeft) {
			this.setNetProps({
				rot: this.rot - this.angSpeed,
			});
		}
		if (engine.keyStates.KeyD || engine.keyStates.ArrowRight) {
			this.setNetProps({
				rot: this.rot + this.angSpeed,
			});
		}
		
		let walk = 0;
		if (engine.keyStates.KeyW || engine.keyStates.ArrowUp) {
			walk += 1;
		}
		if (engine.keyStates.KeyS || engine.keyStates.ArrowDown) {
			walk -= 1;
		}
		
		if (walk !== 0) {
			const movement = Vec2.fromAngle(this.rot + Math.PI / 2,
				walk * this.speed * dt);
			this.setNetProps({
				pos: Vec2.add(this.pos, movement),
			});
		}
		
		this.secsSinceNet += dt;
		if (this.secsSinceNet > 0.03 && this.broadcastDiff) {
			engine.socket.send(
				Packets.C_UpdateSelf.unparse(this.broadcastDiff));
			this.secsSinceNet = 0;
			this.broadcastDiff = null;
		}
	}
}

PlayerAnt.prototype.noInterpolation = true;

export class RemoteAnt extends Ant {
	
}
