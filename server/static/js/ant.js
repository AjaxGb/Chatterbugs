import Vec2 from './vec2.js';
import Entity from './entity.js';
import Packets from './packets-json.js';
import { lerpAngle } from './utils.js';

const antNetNorms = {
	pos: Vec2.fromIter,
	rot: null,
};

const antNetLerps = {
	pos: Vec2.lerpPosition,
	rot: lerpAngle,
};

export class Ant extends Entity {
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
	
	onDraw({ctx}) {
		ctx.save();
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
		
		ctx.font = '20px monospace';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(this.id, 0, 0);
		
		ctx.restore();
	}
}

Ant.prototype.netNormalizers = antNetNorms;
Ant.prototype.netLerps = antNetLerps;
Ant.prototype.typeID = 'ant';

export class PlayerAnt extends Ant {
	constructor(face, {...data}) {
		super(face, data);
		
		this.secsSinceNet = 0;
		this.netDirty = false;
	}
	
	onTick({dt, engine}) {
		if (engine.keyStates.KeyA || engine.keyStates.ArrowLeft) {
			this.rot -= this.angSpeed;
			this.netDirty = true;
		}
		if (engine.keyStates.KeyD || engine.keyStates.ArrowRight) {
			this.rot += this.angSpeed;
			this.netDirty = true;
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
			this.pos = Vec2.add(this.pos, movement);
			this.netDirty = true;
		}
		
		this.secsSinceNet += dt;
		if (this.secsSinceNet > 0.05 && this.netDirty) {
			
			this.secsSinceNet = 0;
			this.netDirty = false;
			
			engine.socket.send(Packets.C_UpdateSelf.unparse({
				pos: this.pos,
				rot: this.rot,
			}));
		}
	}
}

PlayerAnt.prototype.noInterpolation = true;

export class RemoteAnt extends Ant {
	
}
