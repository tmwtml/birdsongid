from flask import Flask, request, jsonify
from birdid import idenclass
# from birdlist import birdlist
import numpy as np
import pandas as pd

app = Flask(__name__)
birdlist = pd.read_csv('birdclass.csv')

@app.route('/')
def hello():
    return {'tmsay': 'Hello World!'}

@app.route('/api/birdid', methods=['GET', 'POST'])
def birdid():
    try:
        if request.method == 'POST':
            f = request.files['file']
            print(type(f))
            print(f)

            f.save('uploaded_file.wav')
            class_list = idenclass('uploaded_file.wav')

            predicted = []
            for (p, c) in class_list:
                bird = dict(birdlist.loc[c])
                bird['id'] = int(bird['id'])
                predicted.append((bird, p))

            print(predicted)

            res = {'tmsay': 'Upload success!', 'predicted': predicted}
        else:
            res = {'tmsay': 'Upload failed!'}

        print(res)

    except Exception as e:
        print('Catch Error:', e)
        res = {'tmsay': 'Prediction error! Please try to record again.'}
    
    return jsonify(res)

if __name__ == '__main__':
    app.run(host='0.0.0.0')
