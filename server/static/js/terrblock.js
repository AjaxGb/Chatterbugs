import Vec2 from './vec2.js';
import Entity from './entity.js';
import Packets from './packets-json.js';
import { lerpAngle } from './utils.js';

const netNorms = {
    pos: Vec2.fromIter,
    scale: Vec2.fromIter,
	rot: null,
};

export default class TerrBlock extends Entity {
	onDraw({ctx}) {
		ctx.save();
		ctx.translate(...this.pos);
        ctx.rotate(this.rot);
		const offset = this.scale.scaled(-0.5);
		ctx.fillRect(...offset, ...this.scale);
		ctx.restore();
	}
}

TerrBlock.prototype.netNormalizers = netNorms;
TerrBlock.prototype.netLerps = {};
TerrBlock.prototype.typeID = 'terrblock';
