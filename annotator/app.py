from crypt import methods
from flask import Flask, request
import json
import os
from flask_cors import cross_origin

app = Flask(__name__)

@app.route('/update', methods=['POST'])
@cross_origin()
def update_state():
    data = json.loads(request.data)
    address = "./public/data/info.json"
    try:
        with open(address, 'w') as f:
            json.dump(data, f)
    except Exception as e:
        return {
            'message': "Failed to update state",
            'status': 400
        }
    return {
        'message': 'OK',
        'status': 200
    }

@app.route('/save', methods=['POST'])
@cross_origin()
def save_annots():
    data = json.loads(request.data)
    address = "./public/data/label/{}.json".format(data['file_name'])
    try:
        with open(address, 'w') as f:
            json.dump(data['annotations'], f)
    except Exception as e:
        return {
            'message': "Failed to save annotations",
            'status': 400
        }
    return {
        'message': 'OK',
        'status': 200
    }

@app.route('/delete', methods=['POST'])
@cross_origin()
def delete_annots():
    data = json.loads(request.data)
    try:
        os.remove("./public/data/label/{}.json".format(data['file_name']))
    except Exception as e:
        return {
            'message': "Failed to delete annotations",
            'status': 400
        }
    return {
        'message': 'OK',
        'status': 200
    }

@app.route('/load/')
@app.route('/load/<filename>')
@cross_origin()
def load_annots(filename=None):
    annots = {}
    try:
        address = "./public/data/label/{}.json".format(filename)
        with open(address) as f:
            annots = json.load(f)
    except Exception as e:
        return {
            'message': 'failed to load {}'.format(filename),
            'status': 400
        }
    
    return {
            'data': annots,
            'message': 'OK',
            'status': 200
        }