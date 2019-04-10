import Vec2 from './vec2.js';
import Entity from './entity.js';
import Packets from './packets-json.js';
import { lerpAngle } from './utils.js';

const netNorms = {
	pos: Vec2.fromIter,
	rot: null,
	text: null,
};

export default class Word extends Entity {
	onDraw({ctx}) {
		ctx.save();
		
		ctx.font = '18px monospace';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.translate(...this.pos);
		ctx.rotate(this.rot);
        
        // No rectangle.
		// ctx.strokeRect(-50, -50, 100, 100);
		ctx.fillText(this.text, 0, 0);
		
		ctx.restore();
	}
}

Word.prototype.netNormalizers = netNorms;
Word.prototype.netLerps = {};
Word.prototype.typeID = 'word';
