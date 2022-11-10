import $ from "jquery";
import * as THREE from "three";

class MeshService {
  static myInstance = null;
  static getInstance() {
    if (MeshService.myInstance == null) {
      MeshService.myInstance = new MeshService();
    }
    return this.myInstance;
  }

  loadFileNames = path => {
    let filenames;
    $.ajaxSettings.async = false;
    $.get(path, function (data) {
      filenames = data.trim().split('\n');
      filenames.sort();
    });
    return filenames;
  };

  addBrushColor = (point, cylinder, mesh_mouse, rayDirection) => {
    var selected_pts = {};
    for (let i = 0; i < mesh_mouse.geometry.attributes.position.count; i++) {
      let x = mesh_mouse.geometry.attributes.position.getX(i);
      let y = mesh_mouse.geometry.attributes.position.getY(i);
      let z = mesh_mouse.geometry.attributes.position.getZ(i);
      let currPt = new THREE.Vector3(x, y, z);
      let minLoc = rayDirection.dot(currPt.sub(point));
      if (minLoc === Infinity || minLoc === -Infinity) {
        continue;
      }
      let minPt = rayDirection.multiplyScalar(minLoc);
      let dist = currPt.distanceTo(minPt);
      if (minLoc >= -0.5 && minLoc <= cylinder.geometry.parameters.height && dist <= cylinder.geometry.parameters.radiusTop) {
        selected_pts[i] = [
          mesh_mouse.geometry.attributes.color.getX(i),
          mesh_mouse.geometry.attributes.color.getY(i),
          mesh_mouse.geometry.attributes.color.getZ(i)
        ];
      }
    }
    return selected_pts;
  }

  removeBrushColor = (selected_pts, mesh_mouse) => {
    for (let point in selected_pts) {
      mesh_mouse.geometry.attributes.color.setXYZ(
        point,
        selected_pts[point][0],
        selected_pts[point][1],
        selected_pts[point][2]
      );
    }
    return mesh_mouse;
  }

  getSegAnnoMesh = (mesh, annotations, color_list, class_semantics) => {
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
      if (annotations["annots"][i] !== -1) {
        mesh.geometry.attributes.color.setXYZ(
          i,
          color_list[class_semantics[annotations["annots"][i]].label][0],
          color_list[class_semantics[annotations["annots"][i]].label][1],
          color_list[class_semantics[annotations["annots"][i]].label][2],
        );
      }
    }
    return mesh;
  }

}

export default MeshService;