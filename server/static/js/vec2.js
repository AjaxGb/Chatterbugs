import { randomAngle, clamped, lerp, lerpAngle } from './utils.js';

export default class Vec2 {
	constructor(x, y) {
		if (typeof x !== 'number' || typeof y !== 'number') {
			throw new Error('Vec2 only takes numbers');
		}
		
		Object.defineProperties(this, {
			x: {
				value: x,
				enumerable: true,
			},
			y: {
				value: y,
				enumerable: true,
			},
		});
	}
	
	static fromIter(vec) {
		if (vec instanceof Vec2) return vec;
		if ([...vec].length !== 2) {
			throw new Error('Argument is not of length 2');
		}
		return new Vec2(...vec);
	}
	
	static fromAngle(angle, length=1) {
		return new Vec2(
			Math.cos(angle) * length,
			Math.sin(angle) * length);
	}
	
	static randomOnCircle(radius=1) {
		return Vec2.fromAngle(randomAngle(), radius);
	}
	
	static lerpPosition(a, b, t) {
		return new Vec2(
			lerp(a.x, b.x, t),
			lerp(a.y, b.y, t));
	}
	
	static lerpDirection(a, b, t) {
		return Vec2.fromAngle(
			lerpAngle(a.toAngle(), b.toAngle(), t),
			lerp(a.magnitude, b.magnitude, t));
	}
	
	scaled(scale) {
		return new Vec2(this.x * scale, this.y * scale);
	}
	
	capped(maxMag) {
		const x = this.x;
		const y = this.y;
		const sqMag = this.sqrMagnitude;
		
		if (sqMag > maxMag * maxMag) {
			const mag = this.magnitude;
			return new Vec2(
				x / mag * maxMag,
				y / mag * maxMag);
		} else {
			return this;
		}
	}
	
	clamped(minX, minY, maxX, maxY) {
		if (minX <= this.x && this.x <= maxX
		&& minY <= this.y && this.y <= maxY) {
			return this;
		}
		return new Vec2(
			clamped(this.x, minX, maxX),
			clamped(this.y, minY, maxY));
	}
	
	distFromAABB(minX, minY, maxX, maxY) {
		const clamped = this.clamped(minX, minY, maxX, maxY);
		if (clamped === this) return Vec2.zero;
		return this.sub(clamped);
	}
	
	withinRadius(center, radius) {
		const dx = this.x - center.x;
		const dy = this.y - center.y;
		return dx * dx + dy * dy <= radius * radius;
	}
	
	add(vec) {
		return new Vec2(this.x + vec.x, this.y + vec.y);
	}
	
	static add(...vecs) {
		if (vecs.length === 0) {
			throw 'Vec2.add(...) cannot be called with 0 arguments';
		}
		if (vecs.length === 1) {
			return vecs[0];
		}
		
		let x = 0, y = 0;
		
		for (var i = vecs.length - 1; i >= 0; i--) {
			x += vecs[i].x;
			y += vecs[i].y;
		}
		
		return new Vec2(x, y);
	}
	
	sub(vec) {
		return new Vec2(this.x - vec.x, this.y - vec.y);
	}
	
	eq(vec) {
		return this.x === vec.x && this.y === vec.y;
	}
	
	get sqrMagnitude() {
		Object.defineProperty(this, 'sqrMagnitude', {
			value: this.x * this.x + this.y * this.y
		});
		return this.sqrMagnitude;
	}
	
	get magnitude() {
		Object.defineProperty(this, 'magnitude', {
			value: Math.sqrt(this.sqrMagnitude)
		});
		return this.magnitude;
	}
	
	toAngle() {
		return Math.atan2(this.y, this.x);
	}
	
	toString() {
		return `Vec2(${this.x}, ${this.y})`;
	}
	
	toJSON() {
		return [this.x, this.y];
	}
	
	*[Symbol.iterator]() {
		yield this.x;
		yield this.y;
	}
}

Object.defineProperties(Vec2, {
	zero: {
		value: new Vec2(0, 0),
		enumerable: true,
	},
	one: {
		value: new Vec2(1, 1),
		enumerable: true,
	},
});
