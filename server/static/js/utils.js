
export const TAU  = 6.283185307179586477;
export const PI_2 = 1.570796326794896619;

export function drawSprite(ctx, img, x, y, rot=0, offx=0, offy=0) {
	if (rot) {
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(rot);
		ctx.drawImage(img,
			offx - img.width / 2,
			offy - img.height / 2);
		ctx.restore();
	} else {
		ctx.drawImage(img,
			(x + offx - img.width / 2)|0,
			(y + offy - img.height / 2)|0);
	}
}

export function drawText(ctx, text, x, y, rot=0, offx=0, offy=0) {
	if (rot) {
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(rot);
		ctx.fillText(text, offx, offy);
		ctx.restore();
	} else {
		ctx.fillText(text, x + offx, y + offy);
	}
}

export function peek(arr) {
	return arr[arr.length - 1];
}

export function randomAngle() {
	return Math.random() * TAU - Math.PI;
}

export function clamped(n, min, max) {
	return Math.min(Math.max(n, min), max);
}

export function clampedAbs(n, max) {
	return Math.min(Math.max(n, -max), max);
}

export function floorMod(n, d) {
	return (n % d + d) % d;
}

export function lerp(a, b, t) {
	return a + t * (b - a);
}

export function lerpAngle(a, b, t) {
	return a + t * normalizeAngle(b - a);
}

export function inverseLerp(a, b, x) {
	return (x - a) / (b - a);
}

export function normalizeAngle(a) {
	return floorMod(a + Math.PI, TAU) - Math.PI;
}

export function removeWhere(arr, cond) {
	let i = arr.length;
	while (i--) {
		if (cond(arr[i], i, arr)) {
			arr.splice(i, 1);
		}
	}
}

export function removeItem(arr, item) {
	const i = arr.indexOf(item);
	if (i < 0) return false;
	arr.splice(i, 1);
	return true;
}

export function waitMillis(ms) {
	return new Promise(resolve => {
		setTimeout(resolve, ms);
	});
}

export function approxEqual(a, b, epsilon=0.0001) {
	return Math.abs(a - b) <= epsilon;
}

export function defineConsts(obj, props) {
	for (const key in props) {
		Object.defineProperty(obj, key, {
			enumerable: true,
			value: props[key],
		});
	}
}

export function weightTowardsCenter(p, damping=5) {
	return Math.sin(TAU * p) / (TAU + damping) + p;
}

export function mergeNormalizer(name) {
	return function(diff) {
		for (const key in diff) {
			this[name][key] = diff;
		}
	}
}
