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
const filenames = meshService.loadFileNames(configs["filename_path"]);
var selected_filename;
var semantics = configs["labels"];
var selected_sem;
var Marked = 0;

// define variables
var camera, controls, light, scene, stats, renderer, loader;
var mesh, mesh_hid, mesh_mouse, mesh_overseg;
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
var changes_count = 0, changes_percent = 0;

const datasetFolder = configs["dataset_folder"];

// initialize annotation
var annotations = {}, predictions = {};

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
    selected_filename = filenames[0];
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

  addMesh = async () => {
    mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.Material());
    mesh_hid = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.Material());
    mesh_mouse = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.Material());
    mesh_overseg = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.Material());
    loader = new PLYLoader();
    meshService.loadSegIndices(datasetFolder + "/" + selected_filename + "/" + selected_filename + configs["seg_suffix"]);
    let load_message_annots = await labelService.loadAnnotationJson(selected_filename);
    if (load_message_annots[0] !== "OK"){
      console.log(load_message_annots[0]);
      let preannot_req_data = {
        file_name: selected_filename,
        seg_idx: meshService.getSegDict()
      }
      console.log(preannot_req_data);
      let preAnnotations = await labelService.preAnnotateScene(JSON.stringify(preannot_req_data, null, 2));
      if (preAnnotations[0] !== "OK"){
        annotations = {
          changes: {
            instance_count: new Set()
          }
        };
        predictions = {};
        console.log(preAnnotations[0]);
      }
      else{
        console.log(preAnnotations[1]);
        annotations = preAnnotations[1];
        predictions = preAnnotations[1];
      }
    }
    else{
      annotations = load_message_annots[1];
      predictions = load_message_annots[2];
    }
    changes_count = annotations["changes"].instance_count.size;
    changes_percent = changes_count * 100 / Object.keys(meshService.getSegDict()).length;
    loader.load(
      datasetFolder + "/" + selected_filename + "/" + selected_filename + configs["mesh_suffix"],
      geometry => {
        geometry.computeBoundingBox();
        geometry.translate(-((geometry.boundingBox.max.x - geometry.boundingBox.min.x)/2 + geometry.boundingBox.min.x) , -((geometry.boundingBox.max.y - geometry.boundingBox.min.y)/2 + geometry.boundingBox.min.y) , -1);                
        
        // geometry
        mesh.geometry.copy(geometry);
        mesh_hid.geometry.copy(geometry);
        mesh_overseg.geometry.copy(geometry);
        
        // load segments and instances
        mesh_overseg = meshService.getSegmentMesh(mesh_overseg);

        // load annotation
        mesh = meshService.getSegAnnoMesh(mesh, annotations, color_list);
        
        // determine which mesh to show
        mesh_mouse.geometry.copy(mesh.geometry);

        // material
        var material = new THREE.MeshPhongMaterial( { color: 0xffffff, specular: 0x010101, shininess: 100, flatShading: true, vertexColors: THREE.VertexColors} );
        mesh.material = material;
        mesh_mouse.material = material;
        mesh_overseg.material = material;

        mesh.castShadow = true;
        mesh_mouse.castShadow = true;
        mesh_overseg.castShadow = true;

        mesh.receiveShadow = true;
        mesh_mouse.receiveShadow = true;
        mesh_overseg.receiveShadow = true;

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

    // monitor semantic change
    /*var all_options = document.getElementById("jumpMenu").options;
    if ((all_options.selectedIndex !== selected_sem_index)){
      this.addInstance();
    }*/

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
    if ((e.altKey) && (class_selected === true)) { 

      // check existence
      let prev_class = labelService.getInfo(segId);
      if (prev_class !== selected_sem.label){
        if (prev_class !== "none"){
          annotations = labelService.removeAnnotation(prev_class, selected_sem.label, segId)
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

          // update annotation state
          class_selected_lastLabeled = class_selected;
        }

        // update annotation state
        changes_count = annotations["changes"].instance_count.size;
        changes_percent = changes_count * 100 / Object.keys(meshService.getSegDict()).length;
        segId = -1;
        this.saveAnnotation();
      }
    }
    e.preventDefault();
    mouse.x = ((e.clientX + 5) / this.mount.clientWidth) * 2 - 1;
    mouse.y =
      -((e.clientY - 0.12 * window.innerHeight) / this.mount.clientHeight) * 2 + 1;
  };

  onMouseClick = e => {
    if ((e.shiftKey) && (class_selected === true)) { 

      // check existence
      let prev_class = labelService.getInfo(segId);
      if (prev_class !== selected_sem.label){
        if (prev_class !== "none"){
          annotations = labelService.removeAnnotation(prev_class, selected_sem.label, segId)
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

          // update annotation state
          class_selected_lastLabeled = class_selected;
        }

        // update annotation state
        changes_count = annotations["changes"].instance_count.size;
        changes_percent = changes_count * 100 / Object.keys(meshService.getSegDict()).length;
        segId = -1;
        this.saveAnnotation();
      }
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
          annotations = labelService.removeAnnotation(seg_class, undefined, segId)
          // update mesh
          mesh.geometry.copy(mesh_hid.geometry);
          for (let className in annotations["classes"]){
            for (let i=0; i < annotations["classes"][className].length; i++){
              mesh = meshService.addSegmentColor(Number(annotations["classes"][className][i]), mesh, color_list[className]);
            }
          }
          mesh_mouse.geometry.copy(mesh.geometry);
          mesh.geometry.attributes.color.needsUpdate = true;
          mesh_mouse.geometry.attributes.color.needsUpdate = true;
          changes_count = annotations["changes"].instance_count.size;
          changes_percent = changes_count * 100 / Object.keys(meshService.getSegDict()).length;
          segId = -1;
          this.saveAnnotation();
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
          mesh_mouse.geometry.copy(mesh.geometry);
          mesh_mouse.geometry.attributes.color.needsUpdate = true;
          keySpace = 0;
          segId = -1;
        }
        break;
      case 81: // q       hide original mesh
        if (keyQ === 1){
          mesh_mouse.geometry.copy(mesh.geometry);
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
    var all_options = document.getElementById("scenesDrop").options;
    if (typeof e !== "undefined") {
      selected_filename = all_options[all_options.selectedIndex].value;
      console.log(selected_filename);
    }
    this.classSelectionStyles(selected_sem, undefined);
    // update mesh
    this.removeMesh();
    labelService.clearAnnotation();
    this.addMesh();

    // initialize timer
  };

  addInstance = e => {
    let prev_sem = selected_sem;
    let splitted_id = e.target.id.split('_');
    selected_sem = semantics[splitted_id[splitted_id.length-1] - 1];
    this.classSelectionStyles(prev_sem, selected_sem);

    if ((class_selected === false)){
      console.log("add instance")

      segId = -1;
      class_selected = true;
    }
  };

  classSelectionStyles = (prev_class, curr_class) => {
    if (prev_class !== undefined){
      document.getElementById("sem_text_" + prev_class.id).style.backgroundColor = "transparent";
    }
    if (curr_class !== undefined){
      document.getElementById("sem_text_" + curr_class.id).style.backgroundColor = this.RGBTohex(curr_class.color);
    }
  }

  saveAnnotation = async () => {
    let save_data = {
      "file_name": selected_filename,
      "annotations": labelService.getAnnotation()
    }
    let response = await stateService.saveAnnotation(JSON.stringify(save_data, null, 2));
    console.log(save_data, annotations);
    if (response !== "OK")
      alert(response);
  };
  
  clearAnnotation = () => {
    // clear current annotations
    annotations = labelService.clearAnnotation();

    // delete annotation file
    if (Marked) {
      console.log("clear annotations!");
      $(".alert-success").hide();
    }
    let delete_data = {
      file_name: selected_filename
    }
    let delete_response = stateService.deleteAnnotation(JSON.stringify(delete_data, null, 2));
    delete_response.then(value => {
      if (value !== "OK")
        alert(value);
    });
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
    changes_count = 0;
    changes_percent = 0;
    this.classSelectionStyles(selected_sem, undefined);
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

  handleClassSelect = e => {
    let splitted_id = e.target.id.split('_');
    selected_sem = semantics[splitted_id[splitted_id.length-1] - 1]
  };

  render() {
    return (
      <div className="contain-fluid">
        <div
          id="top"
          className="row p-2"
          style={{ height: 0.12 * window.innerHeight }}
        >
          
          <div className="col"></div>
          <div className="col">
            <p>
              <font style={{ color: "orange" }}>Number of fixed instances</font>: {changes_count}
              &nbsp;&nbsp; <font style={{ color: "orange" }}>Percent of fixed instances</font>: {changes_percent.toFixed(4).toString() + '%'}
            </p>
          </div>
          <div className="col"></div>
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
            <div className="row m-2">
              <legend className="row col-form-label ">Scenes:</legend>
              <select id="scenesDrop" className="form-control" onChange={this.onFrameUpdate}>
                {filenames.map((fid, i) => (
                  <option
                    key={i}
                    id={fid}
                    value={fid}
                  >
                    {fid}
                  </option>

                ))}
              </select>
            </div> 

            <div className="row sm-12">
              <legend className="row col-form-label ">Semantic:</legend>
              <div className="col-sm-12">
                <div className="input-group">
                  {semantics.map((labelInfo, i) => (
                    <div
                      className="col-sm-10 class-container"
                      id={"container_" + labelInfo.id}
                      key={"container_" + labelInfo.id}
                      style={{
                        height: 0.03 * window.innerHeight,
                        outline: mouse_semantic === labelInfo.label ? "red solid 2px" : "none"
                      }}
                      onClick={this.addInstance}
                    >
                      <div
                        className="col-sm-2 class-color-box"
                        id={"color_" + labelInfo.id}
                        style={{
                          backgroundColor: this.RGBTohex(labelInfo.color)
                        }}
                      >
                      </div>
                      <p
                        className="col-sm-10 class-text"
                        style={{
                          display: "inline",
                          margin: "0px",
                          wordBreak: "keep-all"
                        }}
                        id={"sem_text_" + labelInfo.id}
                      >
                        {labelInfo.label}
                      </p>
                    </div>
                  ))}
                </div>
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