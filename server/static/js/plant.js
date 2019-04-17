import Vec2 from './vec2.js';
import Entity from './entity.js';
import Packets from './packets-json.js';
import { lerpAngle } from './utils.js';

const netNorms = {
	pos: Vec2.fromIter,
	rot: null,
	text: null,
};

export default class Plant extends Entity {
	onDraw({ctx}) {
		ctx.save();
		
		ctx.font = '18px monospace';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.translate(...this.pos);
		ctx.rotate(this.rot);
		
		ctx.strokeRect(-15, -15, 30, 30);
		ctx.fillText(this.text, 0, 0);
		
		ctx.restore();
	}
}

Plant.prototype.netNormalizers = netNorms;
Plant.prototype.netLerps = {};
Plant.prototype.typeID = 'plant';
