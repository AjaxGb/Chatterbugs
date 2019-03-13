const CONNECTING = 0;
const OPEN       = 1;
const CLOSING    = 2;
const CLOSED     = 3;

export default class Socket {
	constructor(url) {
		this._ws = new WebSocket(url);
		this._ws.binaryType = 'arraybuffer';
		
		this._onOpen = [];
		this._onMess = [];
		
		this._sendQueue = [];
		this._recvQueue = [];
		
		this._ws.onopen = () => {
			for (let {resolve} of this._onOpen) {
				resolve();
			}
			this._onOpen = [];
			
			for (let {data, resolve, reject} of this._sendQueue) {
				try {
					resolve(this._ws.send(data));
				} catch (e) {
					reject(e);
				}
			}
			this._sendQueue = [];
		};
		
		this._ws.onmessage = mess => {
			if (this._onMess.length > 0) {
				const i = this._onMess.findIndex(on =>
					on.filter == null || on.filter(mess));
				
				if (i >= 0) {
					const {resolve} = this._onMess.splice(i, 1)[0];
					resolve(mess);
					return;
				}
			}
			this._recvQueue.push(mess);
		};
		
		this._ws.onerror = err => {
			console.error(err);
			
			if (this._ws.readyState >= CLOSING) {
				for (let {reject} of this._onOpen) {
					reject(err);
				}
				this._onOpen = [];
				
				for (let {reject} of this._onMess) {
					reject(err);
				}
				this._onMess = [];
			}
		};
		
		this._ws.onclose = e => {
			if (e.wasClean) {
				console.log('Closed', e.code, e.reason);
			} else {
				console.error('Closed', e.code, e.reason);
			}
		}
	}
	
	opened() {
		switch (this._ws.readyState) {
		case OPEN:
			return Promise.resolve(this);
		case CONNECTING:
			return new Promise((resolve, reject) => {
				this._onOpen.push({resolve, reject});
			});
		default:
			return Promise.reject(new Error('Already closed'));
		}
	}
	
	send(data) {
		switch (this._ws.readyState) {
		case OPEN:
			try {
				return Promise.resolve(this._ws.send(data));
			} catch (e) {
				return Promise.reject(e);
			}
		case CONNECTING:
			return new Promise((resolve, reject) => {
				this._sendQueue.push({data, resolve, reject});
			});
		default:
			return Promise.reject(new Error('Already closed'));
		}
	}
	
	recv({wait=true, filter=null} = {}) {
		// TODO: Abort
		
		if (this._recvQueue.length > 0) {
			
			const i = (filter == null)
				? 0
				: this._recvQueue.findIndex(filter);
			
			if (i >= 0) {
				return Promise.resolve(
					this._recvQueue.splice(i, 1)[0]);
			}
		}
		
		if (this._ws.readyState >= CLOSING) {
			return Promise.reject(new Error('Already closed'));
		}
		
		if (wait) {
			return new Promise((resolve, reject) => {
				this._onMess.push({resolve, reject, filter});
			});
		} else {
			return Promise.resolve(null);
		}
	}
}
