import configs from "../configs.json";

var annotations = {}, predictions = {};

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
    if (typeof annotations["classes"] === "undefined"){
      annotations["classes"] = {};
    }
    if (typeof annotations["classes"][className] === "undefined") {
      annotations["classes"][className] = [segId];
    }
    else{
      annotations["classes"][className].push(segId);
    }
    return annotations;
  };

  getAnnotation = () => {
    let annot_exp = {
      classes: annotations["classes"],
      changes: {
        instance_count: Array.from(annotations["changes"].instance_count)
      }
    }
    return annot_exp;
  };

  getPrediction = () => {
    return predictions;
  }

  removeAnnotation = (prevClassName, currClassName, segId) => {
    let seg_index = annotations["classes"][prevClassName].indexOf(segId);
    if (Object.keys(predictions).length !== 0){
      let pred_class_same;
      if (predictions["classes"][currClassName] === undefined){
        pred_class_same = false;
      }else{
        if (predictions["classes"][currClassName].indexOf(segId) === -1){
          pred_class_same = false;
        }else{
          pred_class_same = true;
        }
      }
      if (pred_class_same){
        annotations["changes"].instance_count.delete(segId);
      }else{
        annotations["changes"].instance_count.add(segId);
      }
    }

    if (seg_index !== -1){
      annotations["classes"][prevClassName].splice(seg_index, 1);
    }
    if (JSON.stringify(annotations["classes"][prevClassName]) === "[]"){
      delete annotations["classes"][prevClassName];
    }
    return annotations;
  };

  clearAnnotation = () => {
    annotations = {};
    predictions = {};
    return annotations;
  };

  loadAnnotationJson = async (filename) => {
    let req_path = basePath + '/load/' + filename;
    let result = await fetch(req_path)
      .then(async response => {
          const data = await response.json();
          if(data.status !== 200){
            return [data.message, {}, {}]
          }
          return [data.message, data.data, data.data_preds]
      })
      .catch(error => {
          return [error.toString(), {}, {}]
      });
    if (result[1]["changes"] !== undefined){
      result[1]["changes"].instance_count = new Set(result[1]["changes"].instance_count);
    }else{
      result[1]["changes"] = {
        instance_count: new Set()
      };
    }
    annotations = result[1];
    predictions = result[2];
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
    if (response_data[1]["changes"] !== undefined){
      response_data[1]["changes"].instance_count = new Set(response_data[1]["changes"].instance_count);
    }else{
      response_data[1]["changes"] = {
        instance_count: new Set()
      };
    }
    annotations = response_data[1];
    predictions = response_data[1];
    return response_data
  }

  getInfo = (mouse_segId) => {
    for (let className in annotations["classes"]) {
      if (annotations["classes"][className].indexOf(mouse_segId) !== -1){
        return className;
      }
    }
    return "none";
  };

}

export default LabelService;