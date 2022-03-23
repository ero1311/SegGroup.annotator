import configs from "../configs.json";

var annotations = {};

var basePath = "http://" + configs["host"] + ":" + configs["inter_port"].toString();

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

  loadAnnotationJson = async (filename) => {
    let req_path = basePath + '/load/' + filename;
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
    annotations = result[1];
    return result
  }

  preAnnotateScene = async (data) => {
    let response_data = await fetch(basePath + '/preannot', {
      method: 'POST',
      headers: {"Content-Type": "application/json"},
      body: data
    })
    .then(async response => {
        const data = await response.json();
        if (!response.ok){
          return ['Failed to preannotate', {}]
        }
        return [data.message, data.data]
    })
    .catch(error => {
        return [error.toString(), {}];
    });
    annotations = response_data[1];
    return response_data
  }

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