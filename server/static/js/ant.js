import Vec2 from './vec2.js';
import Entity from './entity.js';
import Packets from './packets-json.js';
import { lerpAngle, TAU, weightTowardsCenter } from './utils.js';

const antNetNorms = {
	pos: Vec2.fromIter,
	rot: null,
	speech: null,
};

const antNetLerps = {
	pos: Vec2.lerpPosition,
	rot: lerpAngle,
};

const gutSize = 80;

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
		
		this.gut = Object.create(null);
		const gutCanvas = document.createElement('canvas');
		gutCanvas.width = gutSize;
		gutCanvas.height = gutSize;
		this.gutCtx = gutCanvas.getContext('2d');
		this.gutCtx.font = '20px monospace';
		this.gutCtx.textAlign = 'center';
		this.gutCtx.textBaseline = 'middle';
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
	
	rerenderGut() {
		this.gutCtx.clearRect(0, 0, gutSize, gutSize);
		
		for (const char in this.gut) {
			for (let i = this.gut[char]; i > 0; i--) {
				// Use a hash to get this char's pos and rot
				let hash = char.codePointAt(0) ^ (i << 24);
				hash = (hash ^ 61) ^ (hash >>> 16);
				hash = (hash + (hash << 3))|0;
				hash ^= hash >>> 4;
				hash = (hash * 0x27d4eb2d)|0;
				hash ^= hash >>> 15;
				
				const rot = (hash & 0xFF) / 0xFF * TAU;
				const x = ((hash >>> 8) & 0xFFF) / 0xFFF
					* (gutSize - 14) + 7;
				const y = (hash >>> 20) / 0xFFF
					* (gutSize - 14) + 7;
				
				this.gutCtx.save();
				this.gutCtx.translate(x, y);
				this.gutCtx.rotate(rot);
				this.gutCtx.fillText(char, 0, 0);
				this.gutCtx.restore();
			}
		}
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
		ctx.strokeRect(-gutSize / 2, 18 - gutSize, gutSize, gutSize);
		ctx.drawImage(this.gutCtx.canvas, -gutSize / 2, 18 - gutSize);
		
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
			if (e.code === 'Escape') {
				this.setNetProps({speech: null});
			}
			
			if (e.code === 'Enter' && !e.shiftKey) {
				const speech = this.speech;
				this.setNetProps({speech: null});
				
				if (speech) {
					if(speech.startsWith('BOX:')) {
						engine.socket.send(
							Packets.C_MakeBox.unparse({
								pos: this.pos,
								rot: this.rot,
								text: speech.substr(4).trim(),
							}));
					}
					else if(speech.startsWith('PLANT:')) {
						engine.socket.send(
							Packets.C_MakePlant.unparse({
								pos: this.pos,
								rot: this.rot,
								text: speech.substr(6).trim(),
							}));
					}
				}
			}
			
			if (bellSelect.value) {
				// TODO: Fix hacks
				engine.audio[`play${bellSelect.value}Bell`](
					e.key.codePointAt(0), 1);
			}
		});
	}
	
	setNetProps(diff, assignSelf=true) {
		this.broadcastDiff = Object.assign(
			this.broadcastDiff || {}, diff);
		if (assignSelf) Object.assign(this, diff);
	}
	
	onTick({dt, engine}) {
		if (engine.getKey('KeyT')) {
			this.setNetProps({speech: ''});
			this.speechBox.disabled = false;
			this.speechBox.focus({preventScroll: true});
		}
		
		if (engine.getKey('KeyA') || engine.getKey('ArrowLeft')) {
			this.setNetProps({
				rot: this.rot - this.angSpeed,
			});
		}
		if (engine.getKey('KeyD') || engine.getKey('ArrowRight')) {
			this.setNetProps({
				rot: this.rot + this.angSpeed,
			});
		}
		
		let walk = 0;
		if (engine.getKey('KeyW') || engine.getKey('ArrowUp')) {
			walk += 1;
		}
		if (engine.getKey('KeyS') || engine.getKey('ArrowDown')) {
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
