from birdid import idenclass

import numpy as np
import pandas as pd

birdlist = pd.read_csv('birdclass.csv')

wav = input('File path: ')
if wav == '':
    wav = 'uploaded_file.wav'
class_list = idenclass(wav)

predicted = []
for (p, c) in class_list:
    bird = dict(birdlist.loc[c])
    bird['id'] = int(bird['id'])
    predicted.append((bird, p))

print(predicted)
