import Vec2 from './vec2.js';

export default class Ant {
	constructor(face, pos, rot=0) {
		this.face = face;
		this.pos = pos;
		this.rot = rot;
		
		this.segments = [0.3, 0.4, -0.2];
		
		this.speed = 100;
		this.angSpeed = 0.05;
	}
	
	onUpdate(dt, engine) {
		
		if (engine.keyStates.KeyA || engine.keyStates.ArrowLeft) {
			this.rot -= this.angSpeed;
		}
		if (engine.keyStates.KeyD || engine.keyStates.ArrowRight) {
			this.rot += this.angSpeed;
		}
		
		if (engine.keyStates.KeyW || engine.keyStates.ArrowUp) {
			const movement = Vec2.fromAngle(this.rot + Math.PI / 2, this.speed * dt);
			this.pos = Vec2.add(this.pos, movement);
		}
	}
	
	onRender(ctx, dt, engine) {
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
		ctx.fillText(this.face, 0, 0);
		
		ctx.restore();
	}
}