import * as THREE from "three";
import $ from "jquery";

var segIndices;
var segDicts;

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
    $.get (path, function (data)
      {
        filenames = data.trim().split('\n');
        filenames.sort();
      });
    return filenames;
  };

  loadSegIndices = path => {
    segIndices = [];
    segDicts = {};
    $.ajaxSettings.async = false;
    $.getJSON (path, function (data)
      {
        segIndices = data.segIndices;
      });
    this.updateSegDicts();
    return segIndices;
  };

  updateSegDicts = () =>{
    for (var i = 0; i < segIndices.length; i++){
      if (typeof segDicts[segIndices[i]] === "undefined"){
        segDicts[segIndices[i]] = [i];
      }
      else{
        segDicts[segIndices[i]].push(i);
      }
    }
  };

  segId2Dict = segId => {
    return segDicts[segId];
  };

  index2segId = i => {
    return segIndices[i];
  };

  index2Dict = i => {
    return segDicts[segIndices[i]];
  };

  addSegmentColor = (segId, mesh_mouse, color) =>{
    var dict = this.segId2Dict(segId);
    if (typeof dict !== "undefined"){
      for (var i = 0; i < dict.length; i++){
        mesh_mouse.geometry.attributes.color.setXYZ(dict[i], color[0], color[1], color[2]);
      }
    }
    return mesh_mouse;
  };

  removeSegmentColor = (segId, mesh_mouse, color_dict) =>{
    var dict = this.segId2Dict(segId);
    if (typeof dict !== "undefined"){
      for (var i = 0; i < dict.length; i++){
        mesh_mouse.geometry.attributes.color.setXYZ(
          dict[i], 
          color_dict[i][0],
          color_dict[i][1],
          color_dict[i][2]
        );
      }
    }
    return mesh_mouse;
  };

  getSegmentMesh = (mesh_seg) => {
    for (var i = 0; i < segIndices.length; i++){
      mesh_seg.geometry.attributes.color.setXYZ(i, 1, 1, 1);
    }
    var color;
    for (var segId in segDicts){
      color = [Math.random(), Math.random(), Math.random()];
      for (var k = 0; k < segDicts[segId].length; k++){
        mesh_seg.geometry.attributes.color.setXYZ(segDicts[segId][k], color[0], color[1], color[2]);
      }
    }
    return mesh_seg;
  };

  getSegAnnoMesh = (mesh_seg_anno, annos, color_list) => {
    /*for (var i = 0; i < segIndices.length; i++){
      mesh_seg_anno.geometry.attributes.color.setXYZ(i, 1, 1, 1);
    }*/
    for (var insId in annos) {
      for (var segId in annos[insId]){
        mesh_seg_anno = this.addSegmentColor(segId, mesh_seg_anno, color_list[annos[insId][segId].semantic]);
      }
    }
    return mesh_seg_anno;
  };

  getSegColors = (segId, mesh_mouse) => {
    let idx2colors = {}, dict = this.segId2Dict(segId);
    if (typeof dict !== "undefined"){
      for (let i=0; i < dict.length; i++){
        idx2colors[i] = [
          mesh_mouse.geometry.attributes.color.getX(dict[i]),
          mesh_mouse.geometry.attributes.color.getY(dict[i]), 
          mesh_mouse.geometry.attributes.color.getZ(dict[i])
        ];
      }
    }
    return idx2colors;
  }

  getPointAnno = (mesh, annos) => {
    var pointAnnoList = [];
    for (var insId in annos) {
      for (var segId in annos[insId]){
        var sphereGeometry = new THREE.SphereBufferGeometry(0.04, 32, 32);
        var sphereMaterial = new THREE.MeshBasicMaterial({ color: "#FF0000" });
        var sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.x = mesh.geometry.attributes.position.getX(annos[insId][segId].pointIndex);
        sphere.position.y = mesh.geometry.attributes.position.getY(annos[insId][segId].pointIndex);
        sphere.position.z = mesh.geometry.attributes.position.getZ(annos[insId][segId].pointIndex);
        pointAnnoList.push(sphere);
      }
    }
    return pointAnnoList;
  };

  changeSegmentColor = (mesh, annos, color_list) => {
    for (var insId in annos){
      for (var segId in annos[insId]){
        mesh = this.addSegmentColor(Number(segId), mesh, color_list[Number(insId)]);
      }
    }
    return mesh;
  };

}

export default MeshService;