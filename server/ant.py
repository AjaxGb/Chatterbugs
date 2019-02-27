from collections import namedtuple

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

class TextEntityBase:
	def __init__(self, bounds, pos, angle=0):
		self.bounds = bounds
		self.pos = pos
		self.angle = angle

class AntSegment:
	def __init__(self, pos, angle):
		pass

class Ant:
	def __init__(self, face, num_segments):
		self.face = face
		self.segments = []

if __name__ == '__main__':
	a = Point(1, 2) + Point(-8, 4)
	print(a)