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

  initAnnotation = (nPoints) => {
    annotations["annots"] = []
    for (let i = 0; i < nPoints; i++) {
      annotations["annots"][i] = -1;
    }
    return annotations;
  }

  addAnnotation = (classId, selectedPts, color) => {
    for (let point in selectedPts) {
      annotations["annots"][point] = classId - 1;
      selectedPts[point] = color;
    }
    return [annotations, selectedPts];
  };

  getAnnotation = () => {
    let annot_exp = {
      annots: annotations["annots"],
      time: annotations["time"]
    }
    return annot_exp;
  };

  getPrediction = () => {
    return predictions;
  }

  updateTime = time => {
    annotations["time"] = time;
    return annotations;
  }

  removeAnnotation = (selectedPts, origMesh) => {
    for (let point in selectedPts) {
      annotations["annots"][point] = -1;
      selectedPts[point] = [
        origMesh.geometry.attributes.color.getX(point),
        origMesh.geometry.attributes.color.getY(point),
        origMesh.geometry.attributes.color.getZ(point)
      ];
    }
    return [annotations, selectedPts];
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
        if (data.status !== 200) {
          return [data.message, {}, {}]
        }
        return [data.message, data.data, data.data_preds]
      })
      .catch(error => {
        return [error.toString(), {}, {}]
      });
    if (result[1]["changes"] !== undefined) {
      result[1]["changes"].instance_count = new Set(result[1]["changes"].instance_count);
    } else {
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
      headers: { "Content-Type": "application/json" },
      body: data
    })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) {
          return ['Failed to preannotate', {}, {}]
        }
        return [data.message, data.data, data.preds]
      })
      .catch(error => {
        return [error.toString(), {}, {}];
      });

    annotations = response_data[1];
    predictions = response_data[2];
    return response_data
  }

  getInfo = (pointId, semantics) => {
    if (pointId === -1)
      return "none"
    return semantics[pointId].label;
  };

}

export default LabelService;