from collections import Counter, defaultdict
import random
import string
import re
# markov.py - deals with branching of plants

# markov word class
class Phrase:
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

class MarkovSource:
    def __init__(self):
        # Dictionaries should persist after the sourcetexts.
        self.dictionary = defaultdict(Phrase)
        self.dictionary2 = defaultdict(Phrase)
    
    def load(self, fileName):
        with open(fileName, encoding="utf-8") as text_file:

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
                    self.dictionary[last_word].add_word(word)
                    #print(last_last_word + last_word)
                    self.dictionary2[last_last_word + last_word].add_word(word)
                    # add it to "" if it starts with a capital letter.
                    if word[0].isupper():
                        if len(word) > 1:
                            if not word[1].isupper():
                                self.dictionary[""].add_word(word)
                                self.dictionary2[""].add_word(word)
                        else:
                            self.dictionary[""].add_word(word)
                            self.dictionary2[""].add_word(word)
                    last_last_word = last_word
                    last_word = word
    
    def chain(self, word_curr, word_prev):
        st = self.dictionary2[word_prev+word_curr].get_word()
        if st == "" or random.randrange(7) < 2:
            st = self.dictionary[word_curr].get_word()
        if st == "":
            st = self.dictionary[""].get_word()
        return st

# Old output block
#if __name__ == "__main__":
#    #print(dictionary[""].contents)
#    print(dictionary2[""].contents)
#    laststr = ""
#    st = ""
#    for i in range(0,100):
#        key = laststr+st
#        laststr = st
#        st = dictionary2[key].get_word()
#        if st == "" or random.randrange(7) < 2: # Mixed order
#            st = dictionary[laststr].get_word()
#        print(st)