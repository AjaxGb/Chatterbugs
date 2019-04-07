from collections import Counter, defaultdict
import random
import string
import re
# markov.py - deals with branching of plants

# markov word class
class Word:
    def __init__(self):
        self.size = 0
        self.contents = Counter()
    
    def add_word(self, addition):
        self.contents[addition] += 1
        self.size += 1
    
    def get_word(self):
        index = random.randrange(self.size)
        c = 0
        for word, count in self.contents.items():
            c += count
            if c >= index:
                return word
            

# Load in file
with open("sourcetext/CowboySongs.txt", encoding="utf-8") as text_file:
    dictionary = defaultdict(Word)
    last_word = ""
    for line in text_file:
        for word in re.split("[_\"\-\-,. !?\n“”—1234567890]|(?<=\s)[\']|[\'](?=\s)", line):
            word = word.strip(string.punctuation)
            if len(word) == 0:
                break
            dictionary[last_word].add_word(word)
            # add it to "" if it starts with a capital letter.
            if word[0].isupper():
                if len(word) > 1:
                    if not word[1].isupper():
                        dictionary[""].add_word(word)
                else:
                    dictionary[""].add_word(word)
            last_word = word
    if __name__ == "__main__":
        print(dictionary[""].contents)
        str = ""
        for i in range(0,100):
            str = dictionary[str].get_word()
            print(str)