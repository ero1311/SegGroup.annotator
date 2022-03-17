import $ from "jquery";

var annotations = {};

class LabelService {
  static myInstance = null;
  static getInstance() {
    if (LabelService.myInstance == null) {
      LabelService.myInstance = new LabelService();
    }
    return this.myInstance;
  }

  addAnnotation = (className, segId) => {
    if (typeof annotations[className] === "undefined") {
      annotations[className] = [segId];
    }
    else{
      annotations[className].push(segId);
    }
    return annotations;
  };

  getAnnotation = () => {
    return annotations;
  };

  removeAnnotation = (className, segId) => {
    let seg_index = annotations[className].indexOf(segId);
    if (seg_index !== -1){
      annotations[className].splice(seg_index, 1);
    }
    if (JSON.stringify(annotations[className]) === "[]"){
      delete annotations[className];
    }
    return annotations;
  };

  clearAnnotation = () => {
    annotations = {};
    return annotations;
  };

  loadAnnotationJson = (filename) => {
    var path = "./data/label/" + filename + ".json";
    $.ajaxSettings.async = false; //必须加的，若不加返回的是""
    $.getJSON (path, function (data)
      {
        annotations = data;
      });
    if (typeof annotations === "undefined"){
      annotations = {};
    }
    return annotations;
  };

  getInfo = (mouse_segId) => {
    for (let className in annotations) {
      if (annotations[className].indexOf(mouse_segId) !== -1){
        return className;
      }
    }
    return "none";
  };

}

export default LabelService;