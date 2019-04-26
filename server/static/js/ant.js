import Vec2 from './vec2.js';
import Entity from './entity.js';
import Packets from './packets-json.js';
import { TAU, PI_2, lerpAngle, normalizeAngle, peek, removeItem } from './utils.js';

const antNetNorms = {
	pos: Vec2.fromIter,
	rot: null,
	speech: null,
	gut: null,
	textActs: null,
	bellType: null,
};

const antNetLerps = {
	pos: Vec2.lerpPosition,
	rot: lerpAngle,
};

const antNetAppliers = {
	gut(entity, diff) {
		const gut = entity.gut || (entity.gut = Object.create(null));
		
		for (const char in diff) {
			const count = diff[char];
			
			if (count > 0) {
				const charInfo = this.ensureGutInfo(char);
				charInfo.fixed = count;
			} else {
				delete gut[char];
			}
		}
		entity.gutDirty = true;
	},
	textActs(entity, acts) {
		console.log(acts);
		for (const act of acts) {
			switch (act.type) {
			case 'eat':
				this.eatChar(act.char, Vec2.fromIter(act.pos), act.rot);
				break;
			case 'speak':
				this.speakChar(act.char);
				break;
			case 'untracked':
				this.speakUntracked(act.text);
				break;
			case 'unspeak':
				this.unspeakChar();
				break;
			case 'clear':
				this.unspeakAll();
				break;
			case 'destroy':
				this.destroySpeech();
				break;
			default:
				console.error('Unknown text action type:', act.type);
			}
		}
	}
};

const gutSize = 80;

const maxSpeechLength = 30;
const charSpace = 3;
const charSubWidth = 10;
const charWidth = charSubWidth + charSpace;
const maxSpeechWidth = charWidth * maxSpeechLength;
const speechHeight = 20;

const untrackedChars = ' ';

const buttLerpStart = new Vec2(0, 25);

const textOverscale = 3;

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
		
		const gutCanvas = document.createElement('canvas');
		gutCanvas.width = gutSize * textOverscale;
		gutCanvas.height = gutSize * textOverscale;
		this.gutCtx = gutCanvas.getContext('2d');
		this.gutCtx.font = '20px monospace';
		this.gutCtx.textAlign = 'center';
		this.gutCtx.textBaseline = 'middle';
		this.gutCtx.scale(textOverscale, textOverscale);
		
		//this.speechCursor = 0;
		this.speechPos = new Vec2(0, -70);
		const speechCanvas = document.createElement('canvas');
		speechCanvas.width = maxSpeechWidth;
		speechCanvas.height = speechHeight;
		this.speechCtx = speechCanvas.getContext('2d');
		this.speechCtx.font = '20px monospace';
		this.speechCtx.textAlign = 'center';
		this.speechCtx.textBaseline = 'middle';
		
		this.transits = [];
		this.transitSpeedIn = 10;
		this.transitSpeedOut = 15;
	}
	
	onStart({engine}) {
		this.engine = engine;
	}
	
	getCharAvailable(char) {
		const info = this.gut[char];
		if (!info) return 0;
		return info.fixed + info.inbound.length;
	}
	
	get speechLength() {
		if (!this.speechParts) return 0;
		
		return this.speechParts.reduce((length, part) => {
			switch (part.type) {
			case 'plain':
			case 'untracked':
				return length + part.text.length;
			case 'insert':
				return length + 1;
			default:
				return length;
			}
		}, 0);
	}
	
	get speech() {
		if (!this.speechParts) return null;
		
		return this.speechParts.reduce((text, part) => {
			switch (part.type) {
			case 'plain':
				return text + part.text;
			case 'untracked':
				if (part.text === ' ') return text + ' ';
				return text + '\0' + part.text + '\0';
			case 'insert':
				return text + part.transit.char;
			default:
				return text;
			}
		}, '');
	}
	
	set speech(value) {
		this.skipTransits();
		if (value == null) {
			this.speechParts = null;
		} else if (value === '') {
			this.speechParts = [];
		} else {
			this.speechParts = [];
			let untracked = false;
			for (const p of value.split('\0')) {
				if (untracked) {
					this.speechParts.push(
						{type: 'untracked', text: p, image: null});
				} else {
					for (const s of p.split(' ')) {
						if (s) this.speechParts.push(
							{type: 'plain', text: s, image: null});
						this.speechParts.push(
							{type: 'untracked', text: ' ', image: null});
					}
					this.speechParts.pop();
				}
				untracked = !untracked;
			}
		}
	}
	
	get gutImage() {
		if (this.gutDirty) {
			this.gutCtx.clearRect(0, 0, gutSize, gutSize);
			
			for (const char in this.gut) {
				for (let i = this.gut[char].fixed; i > 0; i--) {
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
					this.gutCtx.fillText(char, 0, 0, charSubWidth);
					this.gutCtx.restore();
				}
			}
			
			this.gutDirty = false;
		}
		
		return this.gutCtx.canvas;
	}
	
	// Relative to head
	speechCharPos(index) {
		return this.speechPos.addXY(
			charWidth * index - this.speechWidth / 2,
			speechHeight / 2);
	}
	
	// Relative to gut
	gutCharPosRot(char, index) {
		let hash = char.codePointAt(0) ^ (index << 24);
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
		
		return {
			pos: new Vec2(x - gutSize / 2, y + 18 - gutSize),
			rot: normalizeAngle(rot),
		};
	}
	
	get speechWidth() {
		return this.speechLength * charWidth;
	}
	
	skipTransits() {
		// TODO
	}
	
	ensureGutInfo(char) {
		return this.gut[char] || (this.gut[char] = {
			fixed: 0,
			inbound: [],
		});
	}
	
	playCharBell(char) {
		if (!this.bellType || !this.engine) return;
		this.engine.audio.playBellType(this.bellType, char.codePointAt(0), 1);
	}
	
	eatChar(char, pos=Vec2.zero, rot=0) {
		const availCount = this.getCharAvailable(char);
		const {pos: gutPos, rot: gutRot} = this.gutCharPosRot(char, availCount + 1);
		const transit = {
			char: char,
			t: 0,
			inPos: gutPos,
			inRot: gutRot,
			outPos: pos,
			outRot: rot,
			speechPart: null,
			inbound: true,
		};
		this.transits.push(transit);
		this.ensureGutInfo(char).inbound.push(transit);
		
		this.playCharBell(char);
	}
	
	speakChar(char) {
		if (!this.speechParts) return false;
		const availCount = this.getCharAvailable(char);
		if (availCount <= 0) return false;
		
		const speechPart = {
			type: 'insert',
		};
		
		const gutInfo = this.gut[char];
		if (gutInfo.inbound.length > 0) {
			// Reverse an existing transit
			const transit = gutInfo.inbound.pop();
			removeItem(this.transits, transit);
			removeItem(this.speechParts, transit.speechPart);
			transit.speechPart = speechPart;
			transit.inbound = false;
			speechPart.transit = transit;
		} else {
			// Start a transit
			const {pos: gutPos, rot: gutRot} = this.gutCharPosRot(char, availCount);
			gutInfo.fixed--;
			this.gutDirty = true;
			
			const transit = {
				char: char,
				t: this.segments.length + 1,
				inPos: gutPos,
				inRot: gutRot,
				outPos: this.speechCharPos(this.speechLength),
				outRot: 0,
				speechPart: speechPart,
				inbound: false,
			};
			
			speechPart.transit = transit;
		}
		
		this.speechParts.push(speechPart);
		this.transits.push(speechPart.transit);
		
		this.playCharBell(char);
		return true;
	}
	
	speakUntracked(text) {
		if (!this.speechParts) return false;
		this.speechParts.push({
			type: 'untracked',
			text: text,
			image: null,
		});
		
		this.playCharBell(text);
		return true;
	}
	
	unspeakChar() {
		if (!this.speechParts) return false;
		
		for (let i = this.speechParts.length - 1; i >= 0; i--) {
			const lastPart = this.speechParts[i];
			if (lastPart.type === 'delete') continue;
			
			let transit;
			if (lastPart.type === 'insert') {
				// Reverse the transit
				lastPart.type = 'delete';
				removeItem(this.transits, lastPart.transit);
				transit = lastPart.transit;
				transit.inbound = true;
				
				this.playCharBell(lastPart.transit.char);
			} else if (lastPart.type === 'plain') {
				const charArr = [...lastPart.text];
				const char = charArr.pop();
				
				// Make new transit
				const {pos: gutPos, rot: gutRot} = this.gutCharPosRot(char,
					this.getCharAvailable(char) + 1);
				const speechPart = {
					type: 'delete',
				};
				transit = {
					char: char,
					t: 0,
					inPos: gutPos,
					inRot: gutRot,
					outPos: this.speechCharPos(this.speechLength - 1),
					outRot: 0,
					speechPart: speechPart,
					inbound: true,
				};
				speechPart.transit = transit;
				
				if (charArr.length === 0) {
					// Replace empty speech part
					this.speechParts[i] = speechPart;
				} else {
					lastPart.text = charArr.join('');
					lastPart.image = null;
					this.speechParts.splice(i + 1, 0, speechPart);
				}
				
				this.playCharBell(char);
			} else if (lastPart.type === 'untracked') {
				this.speechParts.splice(i, 1);
				
				this.playCharBell(lastPart.text);
				return true;
			}
			
			this.transits.push(transit);
			const gutInfo = this.ensureGutInfo(transit.char);
			gutInfo.inbound.push(transit);
			
			return true;
		}
		
		return false;
	}
	
	unspeakAll() {
		if (!this.speechParts) return false;
		
		let bells = 3;
		let speechCharI = this.speechLength;
		for (let i = this.speechParts.length - 1; i >= 0; i--) {
			const speechPart = this.speechParts[i];
			
			if (speechPart.type === 'delete') continue;
			
			if (speechPart.type === 'insert') {
				speechCharI--;
				// Reverse the transit
				speechPart.type = 'delete';
				removeItem(this.transits, speechPart.transit);
				const transit = speechPart.transit;
				transit.inbound = true;
				transit.speechPart = null;
				this.transits.push(transit);
				const gutInfo = this.ensureGutInfo(transit.char);
				gutInfo.inbound.push(transit);
				
				if (--bells >= 0) this.playCharBell(transit.char);
			} else if (speechPart.type === 'plain') {
				const charArr = [...speechPart.text];
				for (let j = charArr.length - 1; j >= 0; j--) {
					const char = charArr[j];
					speechCharI--;
					// Make new transit
					const {pos: gutPos, rot: gutRot} = this.gutCharPosRot(char,
						this.getCharAvailable(char) + 1);
					const speechPart = {
						type: 'delete',
					};
					const transit = {
						char: char,
						t: 0,
						inPos: gutPos,
						inRot: gutRot,
						outPos: this.speechCharPos(speechCharI),
						outRot: 0,
						speechPart: null,
						inbound: true,
					};
					speechPart.transit = transit;
					
					this.transits.push(transit);
					const gutInfo = this.ensureGutInfo(transit.char);
					gutInfo.inbound.push(transit);
					
					if (--bells >= 0) this.playCharBell(char);
				}
			} else if (speechPart.type === 'untracked') {
				if (--bells >= 0) this.playCharBell(speechPart.text);
			}
		}
		
		this.speechParts = null;
		return true;
	}
	
	destroySpeech() {
		if (!this.speechParts) return false;
		this.speechParts = null;
		return true;
	}
	
	onTick({dt}) {
		for (let i = this.transits.length - 1; i >= 0; i--) {
			const tran = this.transits[i];
			
			if (tran.inbound) {
				tran.t += dt * this.transitSpeedIn;
				if (tran.t >= this.segments.length + 1) {
					// End transit, become fixed in gut
					const gutInfo = this.gut[tran.char];
					gutInfo.fixed++;
					removeItem(gutInfo.inbound, tran);
					if (tran.speechPart) {
						removeItem(this.speechParts, tran.speechPart);
					}
					this.gutDirty = true;
					this.transits.splice(i, 1);
				}
			} else {
				tran.t -= dt * this.transitSpeedOut;
				if (tran.t <= 0) {
					// End transit, become plain speech
					const speechIdx = this.speechParts.indexOf(tran.speechPart);
					if (speechIdx < 0) throw new Error('Letter reached speech box with invalid target');
					const prevSpeech = this.speechParts[speechIdx - 1];
					const nextSpeech = this.speechParts[speechIdx + 1];
					if (prevSpeech && prevSpeech.type === 'plain') {
						// Merge with previous
						prevSpeech.text += tran.char;
						prevSpeech.image = null;
						if (nextSpeech && nextSpeech.type === 'plain') {
							prevSpeech.text += nextSpeech.text;
							this.speechParts.splice(speechIdx, 2);
						} else {
							this.speechParts.splice(speechIdx, 1);
						}
					} else if (nextSpeech && nextSpeech.type === 'plain') {
						// Merge with next
						nextSpeech.text = tran.char + nextSpeech.text;
						nextSpeech.image = null;
						this.speechParts.splice(speechIdx, 1);
					} else {
						// Nothing to merge with, become solo plain speech
						tran.speechPart.type = 'plain';
						tran.speechPart.text = tran.char;
						delete tran.speechPart.transit;
					}
					this.transits.splice(i, 1);
				}
			}
		}
	}
	
	onDraw({engine, ctx, seconds}) {
		ctx.save();
		ctx.font = '20px monospace';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.translate(...this.pos);
		ctx.save();
		ctx.rotate(this.rot);
		
		for (const tran of this.transits) {
			if (!tran.image) {
				tran.image = document.createElement('canvas');
				tran.image.width = charSubWidth * textOverscale;
				tran.image.height = speechHeight * textOverscale;
				const ctx = tran.image.getContext('2d');
				ctx.font = '20px monospace';
				ctx.textBaseline = 'top';
				ctx.scale(textOverscale, textOverscale);
				ctx.fillText(tran.char, 0, 0, charSubWidth);
			}
		}
		
		let i = 0;
		for (; i < this.segments.length; i++) {
			ctx.save();
			ctx.translate(0, -25);
			ctx.rotate(this.segments[i]);
			ctx.translate(0, -25);
		}
		
		// Butt
		ctx.strokeRect(-gutSize / 2, 18 - gutSize, gutSize, gutSize);
		ctx.drawImage(this.gutImage, -gutSize / 2, 18 - gutSize, gutSize, gutSize);
		// Transits in butt
		for (const tran of this.transits) {
			const t = tran.t - i;
			if (t < 0) continue;
			ctx.save();
			ctx.translate(...Vec2.lerpPosition(
				buttLerpStart, tran.inPos, t));
			ctx.rotate(t * tran.inRot);
			ctx.drawImage(tran.image,
				-charSubWidth / 2, -speechHeight / 2,
				charSubWidth, speechHeight);
			ctx.restore();
		}
		
		for (; i > 1; i--) {
			ctx.restore();
			// Segment
			ctx.strokeRect(-18, -18, 36, 36);
			// Transits in segment
			for (const tran of this.transits) {
				const t = 1 - (tran.t - i + 1);
				if (t <= 0 || t > 1) continue;
				ctx.drawImage(tran.image,
					-charSubWidth / 2, t * 50 - 25 - speechHeight / 2,
					charSubWidth, speechHeight);
			}
		}
		ctx.restore();
		
		// Head
		ctx.strokeRect(-40, -18, 80, 36);
		ctx.fillText(this.id, 0, 0);
		
		ctx.restore();
		
		// Transits in head
		for (const tran of this.transits) {
			const t = tran.t;
			if (t >= 1) continue;
			ctx.save();
			ctx.translate(...Vec2.lerpPosition(
				tran.outPos, Vec2.fromAngle(this.rot - PI_2, 25), t));
			ctx.rotate(lerpAngle(tran.outRot, this.rot, t));
			ctx.drawImage(tran.image,
				-charWidth / 2, -speechHeight / 2,
				charSubWidth, speechHeight);
			ctx.restore();
		}
		
		if (this.speechParts) {
			const y = this.speechPos.y;
			let x = this.speechPos.x - this.speechWidth / 2;
			
			for (const part of this.speechParts) {
				switch (part.type) {
				case 'plain':
				case 'untracked':
					if (!part.image) {
						part.image = document.createElement('canvas');
						part.image.width = charWidth * part.text.length * textOverscale;
						part.image.height = speechHeight * textOverscale;
						const sctx = part.image.getContext('2d');
						sctx.scale(textOverscale, textOverscale);
						sctx.font = '20px monospace';
						sctx.textBaseline = 'middle';
						if (part.type === 'untracked') {
							sctx.globalAlpha = 0.5;
						}
						let x = 0;
						for (const c of part.text) {
							sctx.fillText(c, x, speechHeight / 2, charSubWidth);
							x += charWidth;
						}
					}
					ctx.drawImage(part.image, x, y,
						charWidth * part.text.length, speechHeight);
					x += charWidth * part.text.length;
					break;
				case 'insert':
					x += charWidth;
					break;
				}
			}
			
			if (seconds % 1 > 0.5) {
				ctx.fillRect(x - 2, y, 1, speechHeight);
			}
		}
		
		ctx.restore();
	}
	
	onDie() {
		this.speechBox.remove();
	}
}

Ant.prototype.netNormalizers = antNetNorms;
Ant.prototype.netLerps = antNetLerps;
Ant.prototype.netAppliers = antNetAppliers;
Ant.prototype.typeID = 'ant';

export class PlayerAnt extends Ant {
	constructor(face, {...data}) {
		super(face, data);
		
		this.secsSinceNet = 0;
		this.broadcastDiff = null;
		
		const bellSelect = document.getElementById('bells');
		bellSelect.addEventListener('input', e => {
			this.setNetProps({
				bellType: bellSelect.value || null,
			});
		});
		this.bellType = bellSelect.value || null;
	}
	
	setNetProps(diff, assignSelf=true) {
		this.broadcastDiff = Object.assign(
			this.broadcastDiff || {}, diff);
		if (assignSelf) Object.assign(this, diff);
	}
	
	addTextAct(act) {
		const diff = this.broadcastDiff || (this.broadcastDiff = {});
		const acts = diff.textActs || (diff.textActs = []);
		acts.push(act);
	}
	
	onInput({seconds, event}) {
		if (event.type !== 'keydown' || !this.speechParts || e.altKey) return;
		
		if (event.code === 'Escape') {
			this.unspeakAll();
			engine.inputTarget = null;
			event.preventDefault();
		} else if (event.code === 'Backspace') {
			if (this.unspeakChar()) {
				event.preventDefault();
			}
		} else if (event.code === 'KeyB' && event.ctrlKey) {
			this.speakUntracked('BOX:');
			event.preventDefault();
		} else if (event.code === 'KeyP' && event.ctrlKey) {
			this.speakUntracked('PLANT:');
			event.preventDefault();
		} else if (event.code === 'Enter') {
			const speech = this.speech;
			
			if (speech.startsWith('\0BOX:\0')) {
				const text = speech.substr(6).trim();
				if (text.includes('\0')) {
					this.unspeakAll();
				} else {
					engine.socket.send(
						Packets.C_MakeBox.unparse({
							pos: this.pos,
							rot: this.rot,
							text: text,
						}));
				}
			} else if (speech.startsWith('\0PLANT:\0')) {
				const text = speech.substr(8).trim();
				if (text.includes('\0')) {
					this.unspeakAll();
				} else {
					engine.socket.send(
						Packets.C_MakePlant.unparse({
							pos: this.pos,
							rot: this.rot,
							text: text,
						}));
				}
			} else {
				this.unspeakAll();
			}
			
			this.destroySpeech();
			engine.inputTarget = null;
			
			event.preventDefault();
		} else {
			if (e.ctrlKey) return;
			
			if (untrackedChars.includes(event.key)
				? this.speakUntracked(event.key)
				: this.speakChar(event.key)) {
				
				event.preventDefault();
			}
		}
	}
	
	eatChar(char, pos=Vec2.zero, rot=0) {
		super.eatChar(char, pos, rot);
		this.addTextAct({type: 'eat', char, pos, rot});
	}
	
	speakChar(char) {
		if (super.speakChar(char)) {
			this.addTextAct({type: 'speak', char});
		}
	}
	
	speakUntracked(text) {
		if (super.speakUntracked(text)) {
			this.addTextAct({type: 'untracked', text});
		}
	}
	
	unspeakChar() {
		if (super.unspeakChar()) {
			this.addTextAct({type: 'unspeak'});
		}
	}
	
	unspeakAll() {
		if (super.unspeakAll()) {
			this.addTextAct({type: 'clear'});
		}
	}
	
	destroySpeech() {
		if (super.destroySpeech()) {
			this.addTextAct({type: 'destroy'});
		}
	}
	
	onTick(event) {
		super.onTick(event);
		const {dt, engine} = event;
		
		if (engine.getKey('KeyT')) {
			this.setNetProps({speech: ''});
			engine.inputTarget = this;
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
