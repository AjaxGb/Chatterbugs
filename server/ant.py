from server.entity import Point, EntityBase, dataprop

class CounterNetProp:
	def __init__(self, entity, name):
		self.entity = entity
		self.name = name
	
	@property
	def data(self):
		return self.entity.data.setdefault(self.name, {})
	
	@property
	def diff(self):
		return self.entity.diff.setdefault(self.name, {})
	
	def __setitem__(self, key, count):
		if count > 0:
			self.data[key] = count
			self.diff[key] = count
		else:
			del self.data[key]
			self.diff[key] = 0
	
	def __getitem__(self, key):
		return self.data.get(key, 0)
	
	def __delitem__(self, key):
		del self.data[key]
		self.diff[key] = 0

class Ant(EntityBase):
	type_id = 'ant'
	
	def __init__(self, client, pos, angle=0):
		super().__init__(pos, angle, id=client.face,)
		self.client = client
		self.correcting = False
		
		self.speech = None
		self.gut = CounterNetProp(self, 'gut')
		self.gut['a'] = 5
	
	speech = dataprop('speech')
	bell_type = dataprop('bellType')
	
	def add_text_act(self, act):
		t = act['type']
		gut = self.data.setdefault('gut', {})
		
		if t == 'eat':
			char = act['char']
			gut[char] = gut.get(char, 0) + 1
		elif t == 'speak':
			char = act['char']
			gut[char] -= 1
			if gut[char] <= 0:
				del gut[char]
			self.data['speech'] = self.data['speech'] + char
		elif t == 'untracked':
			text = act['text']
			if text not in ' ':
				text = f'\0{text}\0'
			self.data['speech'] = self.data['speech'] + text
		elif t == 'unspeak':
			speech = self.data['speech']
			if speech[-1] == '\0':
				self.data['speech'] = speech[:speech.rfind('\0', 0, -1)]
			else:
				self.data['speech'] = speech[:-1]
				if speech[-1] != ' ':
					char = speech[-1]
					gut[char] = gut.get(char, 0) + 1
		elif t == 'clear':
			untracked = False
			for chunk in self.data['speech'].split('\0'):
				if untracked:
					continue
				
				for char in chunk:
					if char == ' ':
						continue
					gut[char] = gut.get(char, 0) + 1
				
				untracked = not untracked
			self.data['speech'] = None
		elif t == 'destroy':
			self.data['speech'] = None
		else:
			raise ValueError(f'Invalid text act type {t}')
		
		self.diff.setdefault('textActs', []).append(act)
