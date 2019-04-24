import GameAudio from './audio.js';
import { removeWhere } from './utils.js';
import Packets from './packets-json.js';
import Vec2 from './vec2.js';

export class EngineEvent extends Event {
	constructor(type, engine, props={}, cancelable=false) {
		super(type, {cancelable});
		
		Object.assign(props, {
			engine: engine,
			realMillis: engine.realMillis,
			seconds: engine.seconds,
			frame: engine.frame,
		});
		
		for (const name in props) {
			Object.defineProperty(this, name, {
				enumerable: true,
				value: props[name],
			});
		}
	}
}

export class StartEvent extends EngineEvent {
	constructor(engine, late) {
		super('start', engine, {late});
	}
}

export class TickEvent extends EngineEvent {
	constructor(engine) {
		super('tick', engine, {dt: engine.delta});
	}
}

export class DrawEvent extends EngineEvent {
	constructor(engine) {
		super('draw', engine, {ctx: engine.ctx, dt: engine.delta});
	}
}

export class DiffEvent extends EngineEvent {
	constructor(engine, diff) {
		super('diff', engine, {diff: diff});
	}
}

export class DieEvent extends EngineEvent {
	constructor(engine) {
		super('die', engine, {}, true);
	}
}

export default class Engine {
	
	constructor(canvas, socket, entityTypes) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this.socket = socket;
		this.entityTypes = entityTypes;
		this.audio = new GameAudio();
		
		this.state = Engine.STATE_UNSTARTED;
		
		this.images = new Map();
		
		this.entities = new Map();
		
		this.bgFill = null;
		
		this.onRender = this.onRender.bind(this);
		
		this.cameraPos = Vec2.zero;
		
		this.lastRealMillis = 0;
		this.realMillis = 0;
		this.seconds = 0;
		this.frame = -1;
		
		this.timeCallbacks = [];
		this.conditionCallbacks = [];
		
		this.keyStates = {};
		this.ignoreInput = false;
		const preventKeys = {
			'ArrowDown': {},
			'ArrowLeft': {},
			'ArrowUp': {},
			'ArrowRight': {},
			'KeyW': {},
			'KeyA': {},
			'KeyS': {},
			'KeyD': {},
		};
		
		const keyHandler = e => {
			if (!this.ignoringInput && preventKeys[e.code]) {
				// TODO: Finer control, if needed
				e.preventDefault();
				e.stopPropagation();
			}
			
			const state = this.keyStates[e.code] || (this.keyStates[e.code] = {});
			
			if (e.type === 'keydown') {
				if (state.down === true) return;
				state.down = true;
				state.changeTime = performance.now();
			} else if (e.type === 'keyup') {
				if (state.down === false) return;
				state.down = false;
				state.changeTime = performance.now();
			} else {
				return;
			}
		};
		window.addEventListener('keydown', keyHandler);
		window.addEventListener('keyup',   keyHandler);
	}
	
	get ignoringInput() {
		const activeTag = document.activeElement.tagName;
		return this.ignoreInput || activeTag === 'INPUT' || activeTag === 'TEXTAREA';
	}
	
	getKey(code) {
		if (this.ignoringInput) return false;
		const state = this.keyStates[code];
		if (!state) return false;
		return state.down;
	}
	
	getKeyPushed(code) {
		if (this.ignoringInput) return false;
		const state = this.keyStates[code];
		if (!state) return false;
		return state.down && state.changeTime > this.lastRealMillis;
	}
	
	getKeyReleased(code) {
		if (this.ignoringInput) return false;
		const state = this.keyStates[code];
		if (!state) return false;
		return !state.down && state.changeTime > this.lastRealMillis;
	}
	
	get width() {
		return this.canvas.width;
	}
	
	get height() {
		return this.canvas.height;
	}

	get player() {
		return this.entities.get(this.entityTypes.playerFace);
	}
	
	get aabb() {
		return [0, 0, this.width, this.height];
	}
	
	worldToScreen(vec) {
		// Slight hack: DOMRect has an x and y, so we
		// can use it as a vector directly here.
		return vec.sub(this.canvas.getBoundingClientRect()).sub(this.cameraPos);
	}
	
	worldToPage(vec) {
		// Slight hack: DOMRect has an x and y, so we
		// can use it as a vector directly here.
		const rect = this.canvas.getBoundingClientRect();
		rect.x += window.pageXOffset;
		rect.y += window.pageYOffset;
		return vec.sub(rect).sub(this.cameraPos);
	}
	
	async run() {
		if (this.state === Engine.STATE_STARTED) return;
		
		this.state = Engine.STATE_STARTED;
		this.realMillis = performance.now();
		
		this.nextRenderID = requestAnimationFrame(this.onRender);
		
		const event = new StartEvent(this, false);
		for (const ent of this.entities.values()) {
			ent.dispatchEvent(event);
		}
		
		// Handle packets
		try {
			while (true) {
				await this._handlePacket();
			}
		} finally {
			this.pause();
		}
	}
	
	async _handlePacket() {
		const mess = await this.socket.recv();
		const p = Packets.parse(mess.data);
		
		switch (p._type) {
			case Packets.S_OpenWorld: {
				this.killAllEntities();
				
				for (const id in p.entities) {
					this.addEntityFromData(id, p.entities[id]);
				}
				break;
			}
			case Packets.S_UpdateWorld: {
				for (const [id, ent] of this.entities) {
					
					const diff = p.entities[id];
					if (!diff || ent.isDead) {
						// TODO: onDead callback?
						this.entities.delete(id);
						continue;
					}
					
					delete p.entities[id];
					ent.dispatchEvent(new DiffEvent(this, diff));
				}
				
				for (const id in p.entities) {
					this.addEntityFromData(id, p.entities[id]);
				}
				
				break;
			}
			case Packets.S_CloseWorld: {
				this.killAllEntities();
				break;
			}
			default: {
				console.error('Unexpected packet received!', p, mess);
			}
		}
	}
	
	pause() {
		if (this.state === Engine.STATE_UNSTARTED) {
			throw new Error('Game has not been started yet');
		}
		if (this.state === Engine.STATE_PAUSED) return;
		
		this.state = Engine.STATE_PAUSED;
		cancelAnimationFrame(this.nextRenderID);
	}
	
	loadImages(urls, prefix='', suffix='') {
		const promises = [];
		
		for (const url of urls) {
			const img = new Image();
			this.images.set(url, img);
			
			promises.push(new Promise((resolve, reject) => {
				img.onload = () => resolve(img);
				img.onerror = reject;
			}));
			
			img.src = prefix + url + suffix;
		}
		
		return Promise.all(promises);
	}
	
	img(url, w, h) {
		return new Promise((resolve, reject) => {
			const img = new Image(w, h);
			img.onload = () => resolve(img);
			img.onerror = reject;
			img.src = url;
		});
	}
	
	afterSeconds(secs) {
		return new Promise(resolve => {
			this.timeCallbacks.push({
				time: this.seconds + secs,
				callback: resolve,
			});
			this.timeCallbacks.sort(
				(a, b) => a.time - b.time);
		});
	}
	
	afterCondition(cond) {
		return new Promise(resolve => {
			this.conditionCallbacks.push({
				condition: cond,
				callback: resolve,
			});
		});
	}
	
	addEntityFromData(id, data) {
		return this.addEntity(
			this.entityTypes.createEntity(
				data.type, id, data));
	}
	
	addEntity(ent) {
		this.entities.set(ent.id, ent);
		
		if (this.state !== Engine.STATE_UNSTARTED) {
			ent.dispatchEvent(new StartEvent(this, true));
		}
		
		return ent;
	}
	
	killAllEntities() {
		for (const ent of this.entities.values()) {
			ent.isDead = true;
		}
	}
	
	onRender(realMillis) {
		this.delta = Math.min(0.1,
			(realMillis - this.realMillis) / 1000);
		this.lastRealMillis = this.realMillis;
		this.realMillis = realMillis;
		
		this.seconds += this.delta;
		this.frame++;
		
		this.nextRenderID = requestAnimationFrame(this.onRender);
		
		const ctx = this.ctx;
		
		const firstTimeCallback = this.timeCallbacks[0];
		if (firstTimeCallback && firstTimeCallback.time <= this.seconds) {
			this.timeCallbacks.shift().callback();
		}
		
		removeWhere(this.conditionCallbacks, c => {
			const done = c.condition(this);
			if (done) c.callback();
			return done;
		});

		const tickEvent = new TickEvent(this);
		for (const ent of this.entities.values()) {
			if (!ent.disabled && !ent.isDead) {
				ent.dispatchEvent(tickEvent);
			}
		}

		const player = this.player;
		if (player) {
			this.cameraPos = player.pos.sub(new Vec2(this.width / 2, this.height / 2));
		}
		ctx.save();
		ctx.translate(...this.cameraPos.scaled(-1));
		
		if (this.bgFill) {
			ctx.fillStyle = this.bgFill;
			ctx.fillRect(...this.cameraPos, this.width, this.height);
		} else {
			ctx.clearRect(...this.cameraPos, this.width, this.height);
		}

		ctx.fillStyle = 'black';
		
		const drawEvent = new DrawEvent(engine);
		for (const ent of this.entities.values()) {
			if (ent.isDead) {
				if (ent.dispatchEvent(new DieEvent(this))) {
					this.entities.delete(ent.id);
				} else {
					ent.isDead = false;
				}
			} else if (!ent.disabled) {
				ent.dispatchEvent(drawEvent);
			}
		}

		ctx.restore();
	}
}

Engine.STATE_UNSTARTED = 0;
Engine.STATE_STARTED   = 1;
Engine.STATE_PAUSED    = 2;
