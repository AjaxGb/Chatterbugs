import Vec2 from './vec2.js';
import Entity from './entity.js';
import Packets from './packets-json.js';
import { lerpAngle } from './utils.js';

const netNorms = {
	pos: Vec2.fromIter,
	rot: null,
	text: null,
};

export default class Box extends Entity {
	onDraw({ctx}) {
		ctx.save();
		
		ctx.font = '10px monospace';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.translate(...this.pos);
		ctx.rotate(this.rot);
		
		ctx.strokeRect(-100, -100, 100, 100);
		ctx.fillText(this.text, 0, 0);
		
		ctx.restore();
	}
}

Box.prototype.netNormalizers = netNorms;
Box.prototype.netLerps = {};
Box.prototype.typeID = 'box';
