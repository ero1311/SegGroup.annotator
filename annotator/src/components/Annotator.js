import React, { Component } from "react";

import * as THREE from "three";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { AmbientLight } from "three/src/lights/AmbientLight.js";
import { PointLight } from "three/src/lights/PointLight.js";
import Stats from "three/examples/jsm/libs/stats.module.js";

import $ from "jquery";

import "../static/Annotator.css";
import configs from "../configs.json";

import LabelService from "../services/LabelService";
import MeshService from "../services/MeshService";
import StateService from "../services/StateService";
let labelService = LabelService.getInstance();
let meshService = MeshService.getInstance();
let stateService = StateService.getInstance();

// load user state
var userState;
const filenames = meshService.loadFileNames(configs["filename_path"]);
var selected_filename;
var semantics = configs["labels"];
semantics.sort(function(a,b){
  return a.label.localeCompare(b.label)
});
var selected_sem;
var selected_sem_index = 0;
var sem2id = {};
for (let i = 0; i < semantics; i++){
  sem2id[semantics[i].label] = semantics[i].id;
}
userState = stateService.loadState("./data/info.json");
if (userState.current_filename === "") {
  selected_filename = filenames[0];
  userState.current_filename = selected_filename;
}
else {
  selected_filename = userState.current_filename;
}
var Marked = 0;

// define variables
var camera, controls, light, scene, stats, renderer, loader;
var mesh, mesh_hid, mesh_mouse, mesh_overseg, mesh_seg_anno;
var segId2Color, oversegId2Color;

// initialize raycaster
var raycaster = new THREE.Raycaster();
raycaster.params.Points.threshold = 0.01;
var mouse = new THREE.Vector2();
var meshes, pointSelectIndex;

// initialize annotation states
var segId = -1;
var segId_new = -1;
var class_selected = false;
var class_selected_lastLabeled = false;
var color_list = {};
for(let i=0; i < configs["labels"].length; i++){
  let r, g, b;
  [r, g, b] = configs["labels"][i]["color"];
  r = r/255;
  g = g/255;
  b = b/255;
  color_list[configs["labels"][i]["label"]] = [r, g, b];
}

var mouse_semantic = "none";

// initialize key states
var keySpace = 0;
var keyQ = 0;
var remove_anno = 0;

const datasetFolder = configs["dataset_folder"];

// initialize timer
var StarTime, EndTime;
var IntTime = 0;
var IntTimePast = 0;
var timeButton = ["Stop Timer", "Continue Timer"];
var timeButtonState = 0;

// initialize annotation
var annotations = {};

class Annotator extends Component {
  constructor(props) {
    super(props);

    this.state = {
      loaded: 0,
      point: [],
    };
  }

  componentDidMount() {
    this.init();

    this.animate();
  }

  init = () => {
    $(".alert-success").hide();

    const width = 0.84 * window.innerWidth;
    const height = 0.83 * window.innerHeight;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    // renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.dofAutofocus = true;
    renderer.setClearColor(0xffffff);
    document.body.appendChild(renderer.domElement);
    this.mount.appendChild(renderer.domElement);

    // camera
    camera = new THREE.PerspectiveCamera(65, width / height, 1, 1000);
    camera.position.set(2, 2, 2);
    camera.up.set(0, 0, 1);

    // controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false; // an animation loop is required when either damping or auto-rotation are enabled
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 1;
    controls.maxDistance = 10;
    controls.maxPolarAngle = Math.PI / 2;

    // light
    scene.add(new AmbientLight(0x888888));
    light = new PointLight(0x888888);
    light.position.set(0,0,3);
    light.castShadow = true;
    scene.add(light);

    // get annotation state
    var index = userState.labeled_file.indexOf(selected_filename);
    if (index !== -1){
      $(".alert-success").show();
      Marked = 1;
      IntTime = userState.scene_time[index];
    }

    // mesh
    this.addMesh();

    // stats
    stats = new Stats();

    window.addEventListener("resize", this.onWindowResize, false);

    window.addEventListener("keypress", this.onKeyPress);
    window.addEventListener("keyup", this.onKeyUp);

    window.addEventListener("mousemove", this.onMouseMove, false);

    window.addEventListener("click", this.onMouseClick, false);
  };

  cameraMatrix2npString = cameraMatrix => {
    var npString = "np.array([";
    for (var i = 0; i < 4; i++) {
      npString += "[";
      for (var j = 0; j < 4; j++) {
        var pos = i * 4 + j;
        npString +=
          cameraMatrix.elements[pos] === 0
            ? cameraMatrix.elements[pos]
            : cameraMatrix.elements[pos].toFixed(4);
        if (j !== 3) {
          npString += ", ";
        }
      }
      npString += "]";
      if (i !== 3) {
        npString += ", ";
      }
    }
    npString += "])";
    return npString;
  };

  addMesh = () => {
    mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.Material());
    mesh_hid = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.Material());
    mesh_mouse = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.Material());
    mesh_overseg = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.Material());
    mesh_seg_anno = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.Material());
    loader = new PLYLoader();
    loader.load(
      datasetFolder + "/" + selected_filename + "/" + selected_filename + configs["mesh_suffix"],
      geometry => {
        geometry.computeBoundingBox();
        geometry.translate(-((geometry.boundingBox.max.x - geometry.boundingBox.min.x)/2 + geometry.boundingBox.min.x) , -((geometry.boundingBox.max.y - geometry.boundingBox.min.y)/2 + geometry.boundingBox.min.y) , -1);                
        
        // geometry
        mesh.geometry.copy(geometry);
        mesh_hid.geometry.copy(geometry);
        mesh_overseg.geometry.copy(geometry);
        // mesh_ins.geometry.copy(geometry);
        mesh_seg_anno.geometry.copy(geometry);
        
        // load segments and instances
        meshService.loadSegIndices(datasetFolder + "/" + selected_filename + "/" + selected_filename + configs["seg_suffix"]);
        mesh_overseg = meshService.getSegmentMesh(mesh_overseg);

        // load annotation
        annotations = {};
        if (Marked){
          annotations = labelService.loadAnnotationJson(selected_filename);
          mesh_seg_anno = meshService.getSegAnnoMesh(mesh_seg_anno, annotations, color_list);
        }
        
        // determine which mesh to show
        if (Marked){
          mesh_mouse.geometry.copy(mesh_seg_anno.geometry);
        }
        else {
          mesh_mouse.geometry.copy(mesh.geometry);
        }

        // material
        var material = new THREE.MeshPhongMaterial( { color: 0xffffff, specular: 0x010101, shininess: 100, flatShading: true, vertexColors: THREE.VertexColors} );
        mesh.material = material;
        mesh_mouse.material = material;
        mesh_overseg.material = material;
        mesh_seg_anno.material = material;

        mesh.castShadow = true;
        mesh_mouse.castShadow = true;
        mesh_overseg.castShadow = true;
        mesh_seg_anno.castShadow = true;

        mesh.receiveShadow = true;
        mesh_mouse.receiveShadow = true;
        mesh_overseg.receiveShadow = true;
        mesh_seg_anno.receiveShadow = true;

        scene.add(mesh_mouse);
        meshes = [mesh];

      },
      xhr => {
        this.setState({
          loaded: Math.round((xhr.loaded / xhr.total) * 100)
        });
      }
    );

    // initialize annotation states
    segId = -1;
    segId_new = -1;
    class_selected = false;
    class_selected_lastLabeled = false;
    IntTimePast = 0;
  };

  removeMesh = () => {
    scene.remove(mesh_mouse);
  };

  animate = () => {
    requestAnimationFrame(this.animate);

    controls.update();

    stats.update();

    this.renderScene();
  };

  renderScene = () => {
    camera.updateMatrixWorld();

    // get annotation time
    if ((Marked === 0) && (timeButtonState === 0)){
      EndTime = new Date().getTime();
      IntTime = (EndTime - StarTime) / 1000 + IntTimePast;
    }

    // monitor semantic change
    var all_options = document.getElementById("jumpMenu").options;
    if ((all_options.selectedIndex !== selected_sem_index) && (remove_anno === 0)){
      this.addInstance();
    }

    // update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // calculate objects intersecting the picking ray
    if (typeof mesh.geometry.attributes.position !== "undefined") {
      var intersections = raycaster.intersectObjects(meshes);
      if (intersections.length > 0) {

        // get intersected face
        var intersection = intersections[0];
        var face = intersection.face;
        
        // get face vertices
        var v1 = [mesh_mouse.geometry.attributes.position.getX(face.a), mesh_mouse.geometry.attributes.position.getY(face.a), mesh_mouse.geometry.attributes.position.getZ(face.a)];
        var v2 = [mesh_mouse.geometry.attributes.position.getX(face.b), mesh_mouse.geometry.attributes.position.getY(face.b), mesh_mouse.geometry.attributes.position.getZ(face.b)];
        var v3 = [mesh_mouse.geometry.attributes.position.getX(face.c), mesh_mouse.geometry.attributes.position.getY(face.c), mesh_mouse.geometry.attributes.position.getZ(face.c)];
        
        // choose the nearest vertice
        var dist1 = (v1[0]-intersection.point.x)^2 + (v1[1]-intersection.point.y)^2 + (v1[2]-intersection.point.z)^2;
        var dist2 = (v2[0]-intersection.point.x)^2 + (v2[1]-intersection.point.y)^2 + (v2[2]-intersection.point.z)^2;
        var dist3 = (v3[0]-intersection.point.x)^2 + (v3[1]-intersection.point.y)^2 + (v3[2]-intersection.point.z)^2;
        var dist_min = dist1;
        pointSelectIndex = face.a;
        if (dist_min > dist2) {  
          dist_min = dist2;
          pointSelectIndex = face.b;
        }
        if (dist_min > dist3) {  
          dist_min = dist3;
          pointSelectIndex = face.c;
        } 
        this.setState({
          point: intersection.point
        });

        // show intersected segment in mesh
        segId_new = meshService.index2segId(pointSelectIndex);
        if (segId_new !== segId){
          let seg_class = labelService.getInfo(segId_new);
          let color;
          if (seg_class === "none"){
            color = [255, 0, 0];
          }
          else{
            color = [0, 255, 0];
          }
          if (keySpace && oversegId2Color !== undefined) {
            mesh_mouse = meshService.removeSegmentColor(segId, mesh_mouse, oversegId2Color);
          }
          if (!keySpace && segId2Color !== undefined) {
            mesh_mouse = meshService.removeSegmentColor(segId, mesh_mouse, segId2Color);
          }
          oversegId2Color = meshService.getSegColors(segId_new, mesh_overseg);
          segId2Color = meshService.getSegColors(segId_new, mesh_mouse);
          mesh_mouse = meshService.addSegmentColor(segId_new, mesh_mouse, color);
          mesh_mouse.geometry.attributes.color.needsUpdate = true;
          segId = segId_new;
        }

        mouse_semantic = labelService.getInfo(segId_new);
      }
    }

    renderer.render(scene, camera);
  };

  onMouseMove = e => {
    // calculate mouse position in normalized device coordinates
    // (-1 to +1) for both components
    if ((e.altKey) && (class_selected === true) && (timeButtonState === 0)) { 

      // check existence
      let prev_class = labelService.getInfo(segId);
      if (prev_class !== "none"){
        annotations = labelService.removeAnnotation(prev_class, segId)
      }
      // add annotation
      annotations = labelService.addAnnotation(selected_sem.label, segId);
      // update mesh
      let color = color_list[selected_sem.label];
      mesh = meshService.addSegmentColor(segId, mesh, color);
      mesh_overseg = meshService.addSegmentColor(segId, mesh_overseg, color);
      if (keySpace) {
        mesh_mouse.geometry.copy(mesh_overseg.geometry);
      }
      else {
        mesh_mouse.geometry.copy(mesh.geometry);
      }
      mesh.geometry.attributes.color.needsUpdate = true;
      mesh_overseg.geometry.attributes.color.needsUpdate = true;
      mesh_mouse.geometry.attributes.color.needsUpdate = true;

      // annotate on a new instance
      if (class_selected_lastLabeled !== class_selected){

        // annotate the first segment in the scene
        if (class_selected_lastLabeled === false){
          StarTime = new Date().getTime();
        }

        // update annotation state
        class_selected_lastLabeled = class_selected;
      }

      // update annotation state
      segId = -1;

    }
    e.preventDefault();
    mouse.x = ((e.clientX + 5) / this.mount.clientWidth) * 2 - 1;
    mouse.y =
      -((e.clientY - 0.12 * window.innerHeight) / this.mount.clientHeight) * 2 + 1;
  };

  onMouseClick = e => {
    if ((e.shiftKey) && (class_selected === true) && (timeButtonState === 0)) { 

      // check existence
      let prev_class = labelService.getInfo(segId);
      if (prev_class !== "none"){
        annotations = labelService.removeAnnotation(prev_class, segId)
      }
      // add annotation
      annotations = labelService.addAnnotation(selected_sem.label, segId);
      // update mesh
      var color = color_list[selected_sem.label];
      mesh = meshService.addSegmentColor(segId, mesh, color);
      mesh_overseg = meshService.addSegmentColor(segId, mesh_overseg, color);
      if (keySpace) {
        mesh_mouse.geometry.copy(mesh_overseg.geometry);
      }
      else {
        mesh_mouse.geometry.copy(mesh.geometry);
      }
      mesh.geometry.attributes.color.needsUpdate = true;
      mesh_overseg.geometry.attributes.color.needsUpdate = true;
      mesh_mouse.geometry.attributes.color.needsUpdate = true;

      // annotate on a new instance
      if (class_selected_lastLabeled !== class_selected){

        // annotate the first segment in the scene
        if (class_selected_lastLabeled === false){
          StarTime = new Date().getTime();
        }

        // update annotation state
        class_selected_lastLabeled = class_selected;
      }

      // update annotation state
      segId = -1;

    }
  };

  onWindowResize = () => {
    camera.aspect = (0.84 * window.innerWidth) / (0.83 * window.innerHeight);
    camera.updateProjectionMatrix();
    renderer.setSize(0.84 * window.innerWidth, 0.83 * window.innerHeight);
  };

  onKeyPress = e => {
    switch (e.keyCode) {
      case 100: // d    next scene
        if (filenames.indexOf(selected_filename) + 1 < filenames.length) {
          selected_filename = filenames[filenames.indexOf(selected_filename) + 1];
          this.onFrameUpdate();
        }
        break;
      case 97: // a     last scene
        if (filenames.indexOf(selected_filename) - 1 > -1) {
          selected_filename = filenames[filenames.indexOf(selected_filename) - 1];
          this.onFrameUpdate();
        }
        break;
      case 104: // h    reset camera
        controls.reset();
        break;
      case 32: // space   show segments
        if (keySpace === 0){
          mesh_mouse.geometry.copy(mesh_overseg.geometry);
          mesh_mouse.geometry.attributes.color.needsUpdate = true;
          keySpace = 1;
          segId = -1;
        }
        break;
      case 113: // q      show original mesh
        if (keyQ === 0){
          mesh_mouse.geometry.copy(mesh_hid.geometry);
          mesh_mouse.geometry.attributes.color.needsUpdate = true;
          keyQ = 1;
          segId = -1;
        }
        break;
      case 122: // z      remove annotated segment
        // remove annotation
        let seg_class = labelService.getInfo(segId);
        if (seg_class !== "none"){
          annotations = labelService.removeAnnotation(seg_class, segId)
          // update mesh
          mesh.geometry.copy(mesh_hid.geometry);
          for (let className in annotations){
            for (let i=0; i < annotations[className].length; i++){
              mesh = meshService.addSegmentColor(Number(annotations[className][i]), mesh, color_list[className]);
            }
          }
          mesh_mouse.geometry.copy(mesh.geometry);
          mesh.geometry.attributes.color.needsUpdate = true;
          mesh_mouse.geometry.attributes.color.needsUpdate = true;
          segId = -1;
        }
        break;
      default:
        break;
    }
  };

  onKeyUp = e => {
    switch (e.keyCode) {
      case 32: // space   hide segments
        if (keySpace === 1){
          if (Marked){
            mesh_mouse.geometry.copy(mesh_seg_anno.geometry);
          }
          else {
            mesh_mouse.geometry.copy(mesh.geometry);
          }
          mesh_mouse.geometry.attributes.color.needsUpdate = true;
          keySpace = 0;
          segId = -1;
        }
        break;
      case 81: // q       hide original mesh
        if (keyQ === 1){
          if (Marked){
            mesh_mouse.geometry.copy(mesh_seg_anno.geometry);
          }
          else {
            mesh_mouse.geometry.copy(mesh.geometry);
          }
          mesh_mouse.geometry.attributes.color.needsUpdate = true;
          keyQ = 0;
          segId = -1;
        }
        break;
      default:
        break;
    }
  };

  onFrameUpdate = e => {
    // get filename
    if (typeof e !== "undefined") {
      selected_filename = e.target.id;
      console.log(selected_filename);
    }

    // update mesh
    this.removeMesh();
    labelService.clearAnnotation();
    this.addMesh();
    
    // get states
    var index = userState.labeled_file.indexOf(selected_filename);
    if (index !== -1){
      $(".alert-success").show();
      Marked = 1;
      IntTime = userState.scene_time[index];
      annotations = labelService.loadAnnotationJson(selected_filename);
    }
    else {
      $(".alert-success").hide();
      Marked = 0;
      IntTime = 0;
    }

    // initialize timer
    IntTimePast = 0;
    StarTime = undefined;
  };

  addInstance = () => {
    var all_options = document.getElementById("jumpMenu").options;
    selected_sem_index = all_options.selectedIndex;
    selected_sem = semantics[selected_sem_index];

    if ((class_selected === false)){
      console.log("add instance")

      segId = -1;
      class_selected = true;
    }
  };
  
  finishAnnotation = () => {
    if (typeof StarTime !== "undefined"){

      // save annotations
      let save_data = {
        file_name: selected_filename,
        annotations: labelService.getAnnotation()
      }
      stateService.saveAnnotation(JSON.stringify(save_data, null, 2));

      // reset annotation states
      segId = -1;
      segId_new = -1;
      class_selected = false;
      class_selected_lastLabeled = false;
      segId2Color = undefined;
      oversegId2Color = undefined;

      // update user states
      userState.scene_time.push(IntTime);
      userState.total_time = 0;
      for (var i = 0; i < userState.scene_time.length; i++){
        userState.total_time += userState.scene_time[i];
      }
      userState.labeled_file.push(selected_filename);
      console.log("marked!");
      Marked = 1;
      $(".alert-success").show();

      // move to next scene
      var index = filenames.indexOf(selected_filename);
      if (index !== (filenames.length-1)){
        selected_filename = filenames[index+1];
      }
      userState.current_filename = selected_filename;

      // save user states
      stateService.updateState(JSON.stringify(userState, null, 2));
    }

  };
  
  clearAnnotation = () => {
    // clear current annotations
    annotations = labelService.clearAnnotation();

    // delete annotation file
    if (Marked) {
      var index = userState.labeled_file.indexOf(selected_filename);
      userState.labeled_file.splice(index, 1);
      var interval = userState.scene_time[index];
      userState.scene_time.splice(index, 1);
      userState.total_time -= interval;
      console.log("clear annotations!");
      $(".alert-success").hide();
      userState.current_filename = selected_filename;
      stateService.updateState(JSON.stringify(userState, null, 2));
      stateService.deleteAnnotation(userState.current_filename);
    }

    // update mesh
    mesh.geometry.copy(mesh_hid.geometry);
    mesh_mouse.geometry.copy(mesh.geometry);
    mesh.geometry.attributes.color.needsUpdate = true;
    mesh_overseg.geometry.attributes.color.needsUpdate = true;
    mesh_mouse.geometry.attributes.color.needsUpdate = true;

    // reset annotation states
    segId = -1;
    segId_new = -1;
    class_selected = false;
    class_selected_lastLabeled = false;
    segId2Color = undefined;
    oversegId2Color = undefined;

    // reset timer
    IntTime = 0;
    IntTimePast = 0;
    StarTime = undefined;
  };

  changeTimeButtonState = () => {
    if (typeof StarTime !== "undefined"){
      if (timeButtonState === 0){
        timeButtonState = 1;
        IntTimePast = IntTime;
      }
      else {
        timeButtonState = 0;
        StarTime = new Date().getTime();
      }
    }
  };

  RGBTohex = rgb => {
    var [r,g,b] = rgb;
    r = r.toString(16).toUpperCase();
    g = g.toString(16).toUpperCase();
    b = b.toString(16).toUpperCase();
    if (r.length < 2)
      r = "0" + r;
    if (g.length < 2)
      g = "0" + g;
    if (b.length < 2)
      b = "0" + b;
    return "#" + r.toString(16) + g.toString(16) + b.toString(16);
  };

  render() {
    return (
      <div className="contain-fluid">
        <div
          id="top"
          className="row p-2"
          style={{ height: 0.12 * window.innerHeight }}
        >
          
          <div className="col">
            <div className="col alert alert-success"
            style={{
                width: 0.1 * window.innerWidth,
                height: 0.05 * window.innerHeight
              }}>
              <strong>
                Marked!
              </strong>
            </div>
          </div>
        </div>
        <div className="row">
          <div
            id="center"
            className="col"
            style={{
              width: 0.851 * window.innerWidth,
              height: 0.833 * window.innerHeight
            }}
            ref={mount => {
              this.mount = mount;
            }}
          />
          <div
            id="right"
            className="col"
            style={{
              width: 0.149 * window.innerWidth,
              height: 0.833 * window.innerHeight
            }}
          > 
            <div className="col alert alert-info"
            style={{
              width: 0.125 * window.innerWidth,
              height: 0.06 * window.innerHeight
            }}>
              <strong>
                {selected_filename}
              </strong>
            </div>

            <div className="row m-2">
              <legend className="row col-form-label ">Scenes:</legend>
              <div
                className="row-sm-0 p-0 list-group"
                id="list-tab"
                role="tablist"
                style={{
                  width: 0.105 * window.innerWidth,
                  height: 0.16 * window.innerHeight
                }}
              >
                {filenames.map((fid, i) => (
                  <a
                    key={i}
                    className={`list-group-item px-2 py-2 list-group-item-action ${
                      fid === selected_filename ? "active" : ""
                    }`}
                    id={fid}
                    data-toggle="list"
                    href={`#list-${fid}`}
                    onClick={this.onFrameUpdate}
                  >
                    {fid}
                  </a>

                ))}
              </div>
            </div> 

            <div className="row m-2">
              <legend className="row col-form-label ">Semantic:</legend>
              <div className="col-sm-8">
                <div className="input-group">
                  <select id="jumpMenu" className="form-control">
                    {semantics.map((labelInfo, i) => (
                      <option
                        key={labelInfo.id}
                        id={labelInfo.id}
                        value={labelInfo.label}
                      >
                        {labelInfo.label}
                      </option>
                    ))}
                  </select>
                  <span className="input-group-btn">
                    <button className="btn btn-default" type="button" onClick={this.addInstance}>
                      Add
                    </button>
                  </span>
                </div>
              </div>
            </div>

            <div className="row m-2">
              <legend className="row col-form-label ">Progress:</legend>
              <div
                className="row state"
                style={{
                  width: 0.105 * window.innerWidth
                }}
              >
              Scene: {userState.labeled_file.length} / {filenames.length}
              </div>
              <div
                className="row state"
                style={{
                  width: 0.105 * window.innerWidth
                }}
              >
              Time: {Math.round(IntTime)} s
              </div>
              <div
                className="row state"
                style={{
                  width: 0.105 * window.innerWidth
                }}
              >
              Avg Time: {Math.round(userState.total_time/userState.labeled_file.length)} s
              </div>
            </div>

            <div className="col" 
              style={{
                  width: 0.20 * window.innerWidth,
                  height: 0.03 * window.innerHeight
                }}>
            </div>

            <div className="col" 
              style={{
                  width: 0.20 * window.innerWidth,
                  height: 0.06 * window.innerHeight
                }}>
              <div className="row justify-content-start" 
                style={{
                  width: 0.20 * window.innerWidth,
                  height: 0.01 * window.innerHeight
                }}>
                <button className="btn btn-dark" onClick={this.changeTimeButtonState}
                style={{
                  width: 0.12 * window.innerWidth
                }}>
                  {timeButton[timeButtonState]}
                </button>
              </div>
            </div>
            <div className="col" 
              style={{
                  width: 0.20 * window.innerWidth,
                  height: 0.06 * window.innerHeight
                }}>
              <div className="row justify-content-start" 
                style={{
                  width: 0.20 * window.innerWidth,
                  height: 0.01 * window.innerHeight
                }}>
                <button className="btn btn-dark" onClick={this.finishAnnotation}
                style={{
                  width: 0.12 * window.innerWidth
                }}>
                  Finish
                </button>
              </div>
            </div>
            <div className="col" 
              style={{
                  width: 0.20 * window.innerWidth,
                  height: 0.07 * window.innerHeight
                }}>
              <div className="row justify-content-start" 
                style={{
                  width: 0.20 * window.innerWidth,
                  height: 0.01 * window.innerHeight
                }}>
                <button className="btn btn-dark" onClick={this.clearAnnotation}
                style={{
                  width: 0.12 * window.innerWidth
                }}>
                  Clear Annos
                </button>
              </div>
            </div>
            <br />
          </div>
        </div>

        <div
          id="bottom"
          className="row p-2"
          style={{ height: 0.05 * window.innerHeight }}
        >
          <div className="col">
            <p>
              <font style={{ color: "red" }}>x</font>: {this.state.point.x ? this.state.point.x.toFixed(4) : 0}
              &nbsp;&nbsp; <font style={{ color: "lime" }}>y</font>: {this.state.point.y ? this.state.point.y.toFixed(4) : 0}
              &nbsp;&nbsp; <font style={{ color: "blue" }}>z</font>: {this.state.point.z ? this.state.point.z.toFixed(4) : 0}
            </p>
          </div>
          <div className="col">
            <p>
              <font style={{ color: "orange" }}>SegId</font>: {segId_new}
              &nbsp;&nbsp; <font style={{ color: "orange" }}>Sem</font>: {mouse_semantic}
            </p>
          </div>
          <div className="col">
            {this.state.loaded !== 100 && (
              <div>{this.state.loaded}% loaded</div>
            )}
          </div>
          <div className="col"></div>
        </div>
      </div>
    );
  }
}

export default Annotator;