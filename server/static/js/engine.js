import { removeWhere } from './utils.js';

export default class Engine {
	
	constructor(canvas, socket) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this.socket = socket;
		
		this.images = {};
		
		this.byNetID = {
			ant: new Map(),
		};
		this.objects = [];
		this.bgFill = null;
		
		this.onRender = this.onRender.bind(this);
		
		this.seconds = 0;
		this.frame = -1;
		
		this.timeCallbacks = [];
		this.conditionCallbacks = [];
		this.keyCallbacks = {
			down:  {},
			up:    {},
		};
		this.keyStates = {};
	}
	
	get width() {
		return this.canvas.width;
	}
	
	get height() {
		return this.canvas.height;
	}
	
	get aabb() {
		return [0, 0, this.width, this.height];
	}
	
	start() {
		this.nextRenderID = requestAnimationFrame(
			(ms) => {
				// Set the initial millis first time around
				this._realMillis = ms;
				this.onRender(ms);
			});
		
		const keyHandler = (e) => {
			if (e.type === 'keydown') {
				if (this.keyStates[e.code] === true) return;
				this.keyStates[e.code] = true;
			} else if (e.type === 'keyup') {
				if (this.keyStates[e.code] === false) return;
				this.keyStates[e.code] = false;
			} else {
				return;
			}
			
			const action = e.type.substr(3);
			const callbacks = this.keyCallbacks[action][e.code];
			if (!callbacks) return;
			
			removeWhere(callbacks, c => {
				if (c.ctrl != null && c.ctrl != e.ctrlKey)
					return false;
				if (c.shift != null && c.shift != e.shiftKey)
					return false;
				if (c.alt != null && c.alt != e.altKey)
					return false;
				c.callback();
				return true;
			});
			
			if (callbacks.length === 0) {
				delete this.keyCallbacks[action][e.code];
			}
		};
		
		window.addEventListener('keydown', keyHandler);
		window.addEventListener('keyup', keyHandler);
	}
	
	loadImages(urls, prefix='', suffix='') {
		const promises = [];
		
		for (let url of urls) {
			const img = this.images[url] = new Image();
			
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
	
	afterKey(action, key,
			ctrl=undefined, shift=undefined, alt=undefined) {
		return new Promise(resolve => {
			const actionMap = this.keyCallbacks[action];
			(actionMap[key] || (actionMap[key] = [])).push({
				callback: resolve,
				ctrl, shift, alt,
			});
		});
	}
	
	addObject(obj) {
		this.objects.push(obj);
		if (obj.netCategory && obj.netID) {
			const map = this.byNetID[obj.netCategory].set(obj.netID, obj);
		}
		return obj;
	}
	
	getNetObj(category, id) {
		return this.byNetID[category].get(id);
	}
	
	onRender(realMillis) {
		this.delta = Math.min(0.1,
			(realMillis - this._realMillis) / 1000);
		this._realMillis = realMillis;
		
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
		
		if (this.bgFill) {
			ctx.fillStyle = this.bgFill;
			ctx.fillRect(0, 0, this.width, this.height);
		} else {
			ctx.clearRect(0, 0, this.width, this.height);
		}
		
		for (let obj of this.objects) {
			if (!obj.disabled && !obj.isDead && obj.onUpdate) {
				obj.onUpdate(this.delta, this);
			}
		}
		
		removeWhere(this.objects, o => {
			if (o.isDead) {
				if (o.netCategory && o.netID) {
					this.byNetID[o.netCategory].delete(o.netID);
				}
				return true;
			}
			return false;
		});
		
		for (let obj of this.objects) {
			if (!obj.disabled && obj.onRender) {
				obj.onRender(ctx, this.delta, this);
			}
		}
	}
	
}
