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
        if(self.size > 0):
            index = random.randrange(self.size)
            c = 0
            for word, count in self.contents.items():
                c += count
                if c >= index:
                    return word
        else:
            return ""

# Load in file
with open("sourcetext/CowboySongs.txt", encoding="utf-8") as text_file:
    dictionary = defaultdict(Word)
    dictionary2 = defaultdict(Word)
    last_last_word = ""
    last_word = ""
    for line in text_file:
        line = line.strip("\n")
        if len(line) == 0:
            continue
        #print(line)
        for word in re.split("[_\"\-\-,. !?“”—1234567890]|\s+| |(?<=\s\r)[\']|[\'](?=\s)", line):
            word = word.strip(string.punctuation)
            if len(word) == 0:
                #print("length 0")
                continue
            dictionary[last_word].add_word(word)
            #print(last_last_word + last_word)
            dictionary2[last_last_word + last_word].add_word(word)
            # add it to "" if it starts with a capital letter.
            if word[0].isupper():
                if len(word) > 1:
                    if not word[1].isupper():
                        dictionary[""].add_word(word)
                        dictionary2[""].add_word(word)
                else:
                    dictionary[""].add_word(word)
                    dictionary2[""].add_word(word)
            last_last_word = last_word
            last_word = word
    if __name__ == "__main__":
        #print(dictionary[""].contents)
        print(dictionary2[""].contents)
        laststr = ""
        st = ""
        for i in range(0,100):
            key = laststr+st
            laststr = st
            st = dictionary2[key].get_word()
            if st == "" or random.randrange(7) < 2: # Mixed order
                st = dictionary[laststr].get_word()
            print(st)