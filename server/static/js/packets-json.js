
// Just using JSON for now. Much simpler than a more
// efficient and complex data scheme.

class PacketType {
	constructor(name) {
		this.name = name;
	}
	
	unparse(values) {
		return JSON.stringify(
			Object.assign({_type: this.name}, values));
	}
	
	toJSON() {
		return this.name;
	}
}

export default class Packets {
	constructor() {
		throw new Error('Packets is a static class');
	}
	
	static parse(str) {
		const data = JSON.parse(str);
		data._type = Packets[data._type];
		return data;
	}
};

for (let name of [
	'S_OpenWorld',
	'S_UpdateWorld',
	'S_CloseWorld',
	'C_UpdateSelf',
	'C_MakeBox',
	'C_MakePlant',
	'C_MakeWord',
	'C_Destroy',
]) {
	Packets[name] = new PacketType(name);
}
