from crypt import methods
from flask import Flask, request
import json
import os
app = Flask(__name__)

@app.route('/update', methods=['POST'])
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
def delete_annots():
    try:
        os.remove("./public/data/label/{}.json".format(request.data.decode('utf-8')))
    except Exception as e:
        return {
            'message': "Failed to delete annotations",
            'status': 400
        }
    return {
        'message': 'OK',
        'status': 200
    }