import struct

by_key = {}

class Packet:
	__slots__ = ()
	
	def __init_subclass__(cls, key, **kwargs):
		super().__init_subclass__(**kwargs)
		
		assert 0 <= key <= 255
		cls.key = key
		assert by_key.setdefault(key, cls) == cls
		
		cls.struct = struct.Struct(cls.struct)
		cls.__slots__ = cls.slots = tuple(cls.slots)
		
		assert (len(cls.slots)
			== len(cls.struct.unpack(b'\x00' * cls.struct.size)))
	
	def __init__(self, client, *args):
		self.client = client
		slots = type(self).slots
		for k, v in zip(slots, args):
			setattr(self, k, v)
	
	def pack(self):
		cls = type(self)
		return bytes((cls.key,)) + cls.struct.pack(
			*(getattr(self, k) for k in cls.slots))

def unpack(client, data):
	key = data[0]
	packet_type = by_key[key]
	return packet_type(client,
		*packet_type.struct.unpack(data[1:]))

class R_MoveToPos(Packet, key=1):
	struct = '!2f'
	slots = ('x', 'y')

class S_SpawnPlayer(Packet, key=100):
	struct = '!5s2f'
	slots = ('face', 'x', 'y')

class S_MovePlayer(Packet, key=101):
	struct = '!5s2f'
	slots = ('face', 'x', 'y')
