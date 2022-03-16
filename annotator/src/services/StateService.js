import $ from "jquery";
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

  loadState = path => {
    $.ajaxSettings.async = false;
    $.getJSON (path, function (data)
      {
        state = data;
      });
    return state;
  };

  updateState = (data) => {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", basePath + '/update');
    xhr.send(data);
  };

  saveAnnotation = (data) => {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", basePath + '/save');
    xhr.send(data);
  };

  deleteAnnotation = (filename) => {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", basePath + '/delete');
    xhr.send(filename);
  };

}

export default StateService;