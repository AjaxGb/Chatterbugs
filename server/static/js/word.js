import Vec2 from './vec2.js';
import Entity from './entity.js';
import Packets from './packets-json.js';
import { lerpAngle } from './utils.js';

const netNorms = {
	pos: Vec2.fromIter,
	rot: null,
	text: null,
};

const textOverscale = 3;

export default class Word extends Entity {

	constructor(id, data) {
		super(id, data);
		this.cachedImg = null;
	}

	onDraw({ctx}) {
		
		if(!this.cachedImg) {
			this.cachedImg = document.createElement("canvas");
			
			this.width = this.text.length * 10;
			
			this.cachedImg.width = this.width * textOverscale;
			this.cachedImg.height = 20 * textOverscale;
			
			const ctx2 = this.cachedImg.getContext("2d");
			ctx2.scale(textOverscale, textOverscale);
			ctx2.font = '18px monospace';
			ctx2.textAlign = 'left';
			ctx2.textBaseline = 'top';
			ctx2.fillText(this.text, 0, 0, this.width);
		}
		ctx.save();
		ctx.translate(...this.pos);
		ctx.rotate(this.rot);
		ctx.drawImage(this.cachedImg, -this.width / 2, -20 / 2, this.width, 20);
		ctx.restore();
	}
}

Word.prototype.netNormalizers = netNorms;
Word.prototype.netLerps = {};
Word.prototype.typeID = 'word';
