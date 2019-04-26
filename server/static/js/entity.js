import { GameEventTarget } from './events.js';
import { peek, inverseLerp, clamped } from './utils.js';

export class EntityTypeRegistry {
	constructor(playerFace) {
		this.playerFace = playerFace;
		this._typeMap = new Map();
	}
	
	register(cls) {
		const typeID = cls.prototype.typeID;
		if (!typeID) {
			throw new Error('Entity type must have a net ID');
		}
		if (this._typeMap.has(typeID)) {
			throw new Error(
				`Entity type ID '${typeID}' already registered`);
		}
		this._typeMap.set(typeID, cls);
		return this;
	}
	
	createEntity(typeID, id, data) {
		let cls = this._typeMap.get(typeID);
		if (!cls) {
			throw new Error(`Unknown entity type ID '${typeID}'`);
		} else if (cls.selectEntityClass) {
			cls = cls.selectEntityClass(this, id, data);
		}
		
		return new cls(id, data);
	}
}

export default class Entity extends GameEventTarget {
	constructor(id, data) {
		super();
		
		Object.defineProperty(this, 'id', {
			enumerable: true,
			value: id,
		});
		
		if (this.netLerps && !this.noInterpolation) {
			// Use lerping
			
			const lerpInit = {};
			
			for (const [key, norm] of Object.entries(this.netNormalizers)) {
				let value = data[key];
				
				if (value !== undefined && norm) value = norm.call(this, value);
				if (value === undefined) continue;
				
				if (this.netLerps[key]) {
					lerpInit[key] = value;
				} else if (this.netAppliers && this.netAppliers[key]) {
					this.netAppliers[key].call(this, this, value, key);
				} else {
					this[key] = value;
				}
			}
			
			this.lerpSnapshots = [
				{
					millis: null,
					lerped: lerpInit,
					other: null,
				}
			];
			this.lerpCache = {};
			this.displayedMillis = null;
			this.displayedMillisT = null;
			
			for (const key in this.netLerps) {
				Object.defineProperty(this, key, {
					enumerable: true,
					get: () => {
						if (key in this.lerpCache) {
							return this.lerpCache[key];
						}
						return (this.lerpCache[key]
							= netLerp(this, key));
					}
				});
			}
			
			this.on('start', interpolateOnStart, true);
			this.on('diff', interpolateOnDiff);
			this.on('tick', interpolateOnTick);
		} else {
			// Do not use lerping
			for (const [key, norm] of Object.entries(this.netNormalizers)) {
				let value = data[key];
				
				if (value !== undefined && norm) value = norm.call(this, value);
				if (value === undefined) continue;
				
				if (this.netAppliers && this.netAppliers[key]) {
					this.netAppliers[key].call(this, this, value, key);
				} else {
					this[key] = value;
				}
			}
			this.on('diff', noInterpolateOnDiff);
		}
		
		this.isDead = false;
		this.disabled = false;
		
		if (this.onStart) this.on('start', this.onStart, true);
		if (this.onTick) this.on('tick', this.onTick);
		if (this.onInput) this.on('input', this.onInput);
		if (this.onDraw) this.on('draw', this.onDraw);
		if (this.onDie) this.on('die', this.onDie);
	}
	
	skipInterpolation() {
		if (!this.lerpSnapshots) return;
		
		let lastSnap;
		for (lastSnap of this.lerpSnapshots) {
			Object.assign(this, lastSnap.other);
		}
		
		this.lerpSnapshots = [lastSnap];
		this.displayedMillis = lastSnap.millis;
		this.displayedMillisT = 0;
	}
}

function noInterpolateOnDiff({diff}) {
	for (const [key, norm] of Object.entries(this.netNormalizers)) {
		let value = diff[key];
		
		if (value !== undefined && norm) value = norm.call(this, value);
		if (value === undefined) continue;
		
		if (this.netAppliers && this.netAppliers[key]) {
			this.netAppliers[key].call(this, this, value, key);
		} else {
			this[key] = value;
		}
	}
}

function netLerp(entity, key) {
	const snapshots = entity.lerpSnapshots;
	
	if (snapshots.length < 1) {
		throw new Error('No snapshots available');
	}
	
	if (snapshots.length === 1) {
		return snapshots[0].lerped[key];
	}
	
	return entity.netLerps[key](
		snapshots[0].lerped[key],
		snapshots[1].lerped[key],
		entity.displayedMillisT);
}

function interpolateOnStart({realMillis: millis}) {
	this.lerpSnapshots[0].millis = millis;
	this.displayedMillis = millis;
	this.displayedMillisT = 0;
}

function interpolateOnDiff({diff, realMillis: millis}) {
	const lastSnap = peek(this.lerpSnapshots);
	
	const otherDiff = {};
	const lerpDiff = Object.assign({}, lastSnap.lerped);
	
	for (const [key, norm] of Object.entries(this.netNormalizers)) {
		let value = diff[key];
		
		if (value !== undefined && norm) value = norm.call(this, value);
		if (value === undefined) continue;
		
		if (this.netLerps[key]) {
			lerpDiff[key] = value;
		} else {
			otherDiff[key] = value;
		}
	}
	
	if (lastSnap.millis === millis) {
		lastSnap.lerped = lerpDiff;
		if (this.lerpSnapshots.length === 1) {
			for (const [key, value] of Object.entries(otherDiff)) {
				if (this.netAppliers && this.netAppliers[key]) {
					this.netAppliers[key].call(this, this, value, key);
				} else {
					this[key] = value;
				}
			}
		} else {
			Object.assign(lastSnap, otherDiff);
		}
	} else {
		this.lerpSnapshots.push({
			millis,
			lerped: lerpDiff,
			other: otherDiff,
		});
	}
}

function interpolateOnTick({dt, realMillis}) {
	this.lerpCache = {};
	
	const snapshots = this.lerpSnapshots;
	
	if (snapshots.length === 0) {
		return;
	} else if (snapshots.length === 1) {
		// Only one option
		this.displayedMillis = snapshots[0].millis;
		this.displayedMillisT = 0;
		return;
	}
	
	const offsetFromReal = realMillis - this.displayedMillis;
	let deltaMillis = dt * 1000;
	
	if (snapshots.length === 2) {
		if (offsetFromReal < 100) {
			// Slow down if we're about to run out of data
			deltaMillis *= Math.sin(Math.PI * offsetFromReal / 200);
		}
	} else if (offsetFromReal > 33) {
		// Speed up if we're behind
		deltaMillis *= 1 +
			((offsetFromReal - 33) / 1000)**2;
	}
	
	this.displayedMillis = clamped(
		this.displayedMillis + deltaMillis,
		0, peek(snapshots).millis);
	
	while (snapshots.length > 2
			&& this.displayedMillis > snapshots[1].millis) {
		snapshots.shift();
		for (const [key, value] of Object.entries(snapshots[0].other)) {
			if (this.netAppliers && this.netAppliers[key]) {
				this.netAppliers[key].call(this, this, value, key);
			} else {
				this[key] = value;
			}
		}
		snapshots[0].other = null;
	}
	
	this.displayedMillisT = inverseLerp(
		snapshots[0].millis,
		snapshots[1].millis,
		this.displayedMillis);
}
