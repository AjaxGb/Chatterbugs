import json

class PacketType:
	def __init__(self, name):
		self.name = name
	
	def __call__(self, **kwargs):
		return json.dumps({**kwargs, '_type': self.name})

class Packet:
	def __init__(self, ptype, **kwargs):
		for k, v in kwargs.items():
			setattr(self, k, v)
		self.ptype = ptype

def unpack(client, data):
	data = json.loads(data)
	pname = data.pop('_type')
	try:
		ptype = types[pname]
	except KeyError:
		raise ValueError(f'Invalid packet type {pname}')
	return Packet(ptype, **data)

types = {}

for name in [
	'S_OpenWorld',
	'S_CloseWorld',
	'S_UpdateWorld',
	'C_UpdateSelf',
	'C_MakeBox',
	]:
	packet = PacketType(name)
	types[name] = packet
	globals().setdefault(name, packet)
