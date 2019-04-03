
export class GameEventTarget extends EventTarget {
	
	on(type, listener, once=false) {
		if (listener) {
			this.addEventListener(type, listener, {once});
		} else {
			return new Promise(resolve => {
				this.addEventListener(type, resolve, {once: true});
			});
		}
	}
	
	off(type, listener) {
		this.removeEventListener(type, listener);
	}
}
