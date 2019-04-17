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
			
			const lerpDiff = loadDiff(this,
				this, data, this.netNormalizers,
				{}, this.netLerps);
			
			this.lerpSnapshots = [
				{
					millis: null,
					lerped: lerpDiff,
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
			loadDiff(this, this, data, this.netNormalizers);
			this.on('diff', noInterpolateOnDiff);
		}
		
		this.isDead = false;
		this.disabled = false;
		
		if (this.onStart) this.on('start', this.onStart, true);
		if (this.onTick) this.on('tick', this.onTick);
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

function loadDiff(entity, obj, diff, normalizers,
		lerpBase=undefined, lerps=undefined) {
	
	const lerpObj = Object.assign({}, lerpBase);
	
	for (const [key, norm] of Object.entries(normalizers)) {
		let value = diff[key];
		
		if (value !== undefined && norm) value = norm.call(entity, value);
		if (value === undefined) continue;
		
		if (lerps && lerps[key]) {
			lerpObj[key] = value;
		} else {
			obj[key] = value;
		}
	}
	
	return lerpObj;
}

function noInterpolateOnDiff({diff}) {
	loadDiff(this, this, diff, this.netNormalizers);
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
	const lerpDiff = loadDiff(this,
		otherDiff, diff, this.netNormalizers,
		lastSnap.lerped, this.netLerps);
	
	if (lastSnap.millis === millis) {
		lastSnap.lerped = lerpDiff;
		Object.assign(
			(this.lerpSnapshots.length === 1)
				? this
				: lastSnap.other,
			otherDiff);
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
		Object.assign(this, snapshots[0].other);
		snapshots[0].other = null;
	}
	
	this.displayedMillisT = inverseLerp(
		snapshots[0].millis,
		snapshots[1].millis,
		this.displayedMillis);
}
