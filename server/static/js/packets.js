
const textDecoder = new TextDecoder('utf-8');

class PacketType {
	constructor(name, key, spec) {
		this.name = name;
		this.key = key;
		this.struct = spec.split(',').map(s => s.split(':'));
		
		this.length = 0;
		for (let [name, type, ...extra] of this.struct) {
			switch (type) {
				case 'f':
					this.length += 4;
					break;
				case 'S':
					this.length += +extra[0] * 4;
					break;
				default:
					throw new Error('Invalid packet spec: Unknown type ' + type);
			}
		}
	}
	
	/**
	 * @param {DataView} data
	 */
	parse(data, i=1) {
		const packet = { _type = this };
		
		for (let [name, type, ...extra] of this.struct) {
			switch (type) {
			case 'f':
				packet[name] = data.getFloat32(i);
				i += 4;
				break;
			case 'S':
				packet[name] = textDecoder.decode(
					data.buffer.slice(data.byteOffset + i));
				i = data.byteLength;
				break;
			}
		}
		
		return packet;
	}
	
	unparse(values) {
		
	}
}

export default Packets = {
	byKey: [],
	parse: function parse(buffer) {
		const data = new DataView(buffer);
		const key = data.getUint8(0);
		return byKey[key].parse(data);
	}
};

new PacketType('S_SpawnPlayer', 100, 'x:f,y:f,face:s*');
new PacketType('S_MovePlayer', 100, 'x:f,y:f,face:s*');
