import configs from "../configs.json";

// import * as fs from "browserify-fs";
// // var fs = require("fs");
// console.log(fs);

var state;
var basePath = "http://" + configs["host"] + ":" + configs["inter_port"].toString();
// var fs = require("fs-js");

class StateService {
  static myInstance = null;
  static getInstance() {
    if (StateService.myInstance == null) {
      StateService.myInstance = new StateService();
    }
    return this.myInstance;
  }

  loadState = async () => {
    let req_path = basePath + '/loadstate';
    let result = await fetch(req_path)
      .then(async response => {
          const data = await response.json();
          if(data.status !== 200){
            return [data.message, {}]
          }
          return [data.message, data.data]
      })
      .catch(error => {
          return [error.toString(), {}]
      });
    state = result[1];
    return state
  };

  updateState = async (data) => {
    let response_data = await fetch(basePath + '/update', {
      method: 'POST',
      headers: {"Content-Type": "application/json"},
      body: data
    })
    .then(async response => {
        const data = await response.json();
        if (!response.ok){
          return 'Failed to save'
        }
        return data.message
    })
    .catch(error => {
        return error.toString();
    })

    return response_data
  };

  saveAnnotation = async (data) => {
    let response_data = await fetch(basePath + '/save', {
      method: 'POST',
      headers: {"Content-Type": "application/json"},
      body: data
    })
    .then(async response => {
        const data = await response.json();
        if (!response.ok){
          return 'Failed to save'
        }
        return data.message
    })
    .catch(error => {
        return error.toString();
    })

    return response_data
  };

  deleteAnnotation = async (data) => {
    let response_data = await fetch(basePath + '/delete', {
      method: 'POST',
      headers: {"Content-Type": "application/json"},
      body: data
    })
    .then(async response => {
        const data = await response.json();
        if (!response.ok){
          return 'Failed to delete'
        }
        return data.message
    })
    .catch(error => {
        return error.toString();
    })

    return response_data
  };

  checkPreannot = async (filename) => {
    let req_path = basePath + '/checkpreannot/' + filename;
    let result = await fetch(req_path)
      .then(async response => {
          const data = await response.json();
          if(data.status !== 200){
            return [data.message, []]
          }
          return [data.message, data.data]
      })
      .catch(error => {
          return [error.toString(), []]
      });
      
    return result
  }
}

export default StateService;