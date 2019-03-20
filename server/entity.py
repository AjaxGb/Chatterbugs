from collections import namedtuple
from uuid import uuid4

class Point(namedtuple('_Point', ['x', 'y'])):
	__slots__ = ()
	
	def __add__(self, other):
		return Point(self[0] + other[0], self[1] + other[1])
	
	def __sub__(self, other):
		return Point(self[0] - other[0], self[1] - other[1])
	
	@property
	def sqr_magnitude(self):
		return self[0] * self[0] + self[1] * self[1]
	
	@property
	def magnitude(self):
		return (self[0] * self[0] + self[1] * self[1]) ** 0.5

def dataprop(name):
	def getter(self):
		return self.data.get(name)
	
	def setter(self, value):
		self.data[name] = value
		self.diff[name] = value
	
	return property(getter, setter)

class EntityBase:
	def __init__(self, pos, rot=0, *, id=None):
		self.world = None
		self.data = {'type': type(self).type_id}
		self.diff = {}
		self.seen_by = set()
		self.temp_seen_by = set()
		self.id = id or str(uuid4())
		
		self.pos = pos
		self.rot = rot
	
	pos = dataprop('pos')
	rot = dataprop('rot')
