import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { OBJExporter } from "three/addons/exporters/OBJExporter.js";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const canvas = document.querySelector("#viewerCanvas");
const viewer = document.querySelector(".viewer");
const fileInput = document.querySelector("#fileInput");
const dropZone = document.querySelector("#dropZone");
const emptyState = document.querySelector("#emptyState");
const statusText = document.querySelector("#statusText");
const sceneTitle = document.querySelector("#sceneTitle");
const fileName = document.querySelector("#fileName");
const fileType = document.querySelector("#fileType");
const meshCount = document.querySelector("#meshCount");
const faceCount = document.querySelector("#faceCount");
const gridToggle = document.querySelector("#gridToggle");
const shadowToggle = document.querySelector("#shadowToggle");
const bloomToggle = document.querySelector("#bloomToggle");
const wireframeToggle = document.querySelector("#wireframeToggle");
const autoRotateToggle = document.querySelector("#autoRotateToggle");
const scaleSlider = document.querySelector("#scaleSlider");
const exposureSlider = document.querySelector("#exposureSlider");
const backgroundSelect = document.querySelector("#backgroundSelect");
const materialSelect = document.querySelector("#materialSelect");
const modelColorSelect = document.querySelector("#modelColorSelect");
const tintColorInput = document.querySelector("#tintColorInput");
const colorIntensitySlider = document.querySelector("#colorIntensitySlider");
const selectedPartName = document.querySelector("#selectedPartName");
const partColorInput = document.querySelector("#partColorInput");
const applyPartColorButton = document.querySelector("#applyPartColorButton");
const resetPartColorButton = document.querySelector("#resetPartColorButton");
const exportFormatSelect = document.querySelector("#exportFormatSelect");
const exportButton = document.querySelector("#exportButton");

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.01, 5000);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = Number(exposureSlider.value);

const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

const composer = new EffectComposer(renderer);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.28, 0.36, 0.86);
bloomPass.enabled = bloomToggle.checked;
composer.addPass(new RenderPass(scene, camera));
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.autoRotateSpeed = 1.4;

const hemiLight = new THREE.HemisphereLight(0xf6fff4, 0x485041, 1.4);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
keyLight.position.set(5, 7, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.bias = -0.0002;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x8fd6bf, 0.9);
fillLight.position.set(-5, 3, -4);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xc9e8ff, 1.0);
rimLight.position.set(-4, 5, 6);
scene.add(rimLight);

const grid = new THREE.GridHelper(10, 20, 0x8fd6bf, 0x555d4e);
scene.add(grid);

const shadowPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.3 }),
);
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.receiveShadow = true;
shadowPlane.visible = false;
scene.add(shadowPlane);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const pointerStart = new THREE.Vector2();
const selectionBox = new THREE.BoxHelper(new THREE.Object3D(), 0xe1c564);
selectionBox.visible = false;
scene.add(selectionBox);

const urlByName = new Map();
let currentModel = null;
let currentObjectUrls = [];
let originalMeshMaterials = [];
let selectedMesh = null;

const materialStates = new Map();
const partColorOverrides = new Map();

const renderMaterials = {
  matte: new THREE.MeshStandardMaterial({ color: 0xd8d0c2, roughness: 0.86, metalness: 0.02 }),
  plastic: new THREE.MeshStandardMaterial({ color: 0xe8eef2, roughness: 0.38, metalness: 0.02 }),
  ceramic: new THREE.MeshPhysicalMaterial({
    color: 0xf4f1e8,
    roughness: 0.18,
    metalness: 0,
    clearcoat: 0.72,
    clearcoatRoughness: 0.18,
  }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x242629, roughness: 0.92, metalness: 0 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xb9c4ca, roughness: 0.28, metalness: 0.72 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xd7dde1, roughness: 0.08, metalness: 1 }),
  goldMetal: new THREE.MeshStandardMaterial({ color: 0xf0c14b, roughness: 0.24, metalness: 0.86 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xb46a43, roughness: 0.32, metalness: 0.78 }),
  glass: new THREE.MeshPhysicalMaterial({
    color: 0xb8eef5,
    roughness: 0.08,
    metalness: 0.05,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
    transparent: true,
    opacity: 0.46,
    side: THREE.DoubleSide,
  }),
};

const materialBaseColors = {
  matte: new THREE.Color(0xd8d0c2),
  plastic: new THREE.Color(0xe8eef2),
  ceramic: new THREE.Color(0xf4f1e8),
  rubber: new THREE.Color(0x242629),
  metal: new THREE.Color(0xb9c4ca),
  chrome: new THREE.Color(0xd7dde1),
  goldMetal: new THREE.Color(0xf0c14b),
  copper: new THREE.Color(0xb46a43),
  glass: new THREE.Color(0xb8eef5),
};

const modelColorPresets = {
  white: "#f4f1e8",
  purple: "#8a5cf6",
  blue: "#4aa3ff",
  green: "#65d66e",
  red: "#ff5c58",
  gold: "#f0c14b",
  black: "#202124",
};

camera.position.set(3.2, 2.4, 4.4);
controls.update();
resizeRenderer();
animate();

fileInput.addEventListener("change", (event) => loadFiles([...event.target.files]));

renderer.domElement.addEventListener("pointerdown", (event) => {
  pointerStart.set(event.clientX, event.clientY);
});

renderer.domElement.addEventListener("pointerup", (event) => {
  const dragDistance = pointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY));
  if (dragDistance <= 4) selectMeshAtPointer(event);
});

["dragenter", "dragover"].forEach((eventName) => {
  window.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  window.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragging");
  });
});

window.addEventListener("drop", (event) => loadFiles([...event.dataTransfer.files]));
window.addEventListener("resize", resizeRenderer);

gridToggle.addEventListener("change", () => {
  grid.visible = gridToggle.checked;
});

shadowToggle.addEventListener("change", () => {
  shadowPlane.visible = shadowToggle.checked && Boolean(currentModel);
});

bloomToggle.addEventListener("change", () => {
  bloomPass.enabled = bloomToggle.checked;
});

wireframeToggle.addEventListener("change", () => setModelWireframe(wireframeToggle.checked));

autoRotateToggle.addEventListener("change", () => {
  controls.autoRotate = autoRotateToggle.checked;
});

scaleSlider.addEventListener("input", () => {
  if (!currentModel) return;
  currentModel.scale.setScalar(Number(scaleSlider.value));
  updateSceneBounds();
});

exposureSlider.addEventListener("input", () => {
  renderer.toneMappingExposure = Number(exposureSlider.value);
});

backgroundSelect.addEventListener("change", () => {
  viewer.classList.toggle("graphite", backgroundSelect.value === "graphite");
  viewer.classList.toggle("paper", backgroundSelect.value === "paper");
});

materialSelect.addEventListener("change", applyAppearance);

modelColorSelect.addEventListener("change", () => {
  const presetColor = modelColorPresets[modelColorSelect.value];
  if (presetColor) tintColorInput.value = presetColor;
  applyAppearance();
});

tintColorInput.addEventListener("input", () => {
  if (modelColorSelect.value !== "original") modelColorSelect.value = "custom";
  applyAppearance();
});

colorIntensitySlider.addEventListener("input", applyAppearance);

document.querySelector("#resetViewButton").addEventListener("click", () => focusModel());
document.querySelector("#frontViewButton").addEventListener("click", () => setView("front"));
document.querySelector("#backViewButton").addEventListener("click", () => setView("back"));
document.querySelector("#topViewButton").addEventListener("click", () => setView("top"));
document.querySelector("#bottomViewButton").addEventListener("click", () => setView("bottom"));
document.querySelector("#rightViewButton").addEventListener("click", () => setView("right"));
document.querySelector("#leftViewButton").addEventListener("click", () => setView("left"));
applyPartColorButton.addEventListener("click", applySelectedPartColor);
resetPartColorButton.addEventListener("click", resetSelectedPartColor);
exportButton.addEventListener("click", exportCurrentModel);

async function loadFiles(files) {
  const modelFile = files.find((file) => /\.(fbx|glb|gltf|obj|stl)$/i.test(file.name));
  if (!modelFile) {
    setStatus("请选择 .fbx、.glb、.gltf、.obj 或 .stl 模型文件", true);
    return;
  }

  revokeObjectUrls();
  urlByName.clear();
  files.forEach((file) => {
    const url = URL.createObjectURL(file);
    currentObjectUrls.push(url);
    urlByName.set(file.name, url);
  });

  const extension = modelFile.name.split(".").pop().toLowerCase();
  setStatus(`正在加载 ${modelFile.name}...`);

  try {
    const model = await parseModel(modelFile, extension);
    showModel(model, modelFile, extension);
  } catch (error) {
    console.error(error);
    setStatus(`加载失败：${error.message || "无法解析该文件"}`, true);
  }
}

async function parseModel(file, extension) {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    const cleanName = decodeURIComponent(url.split("/").pop());
    return urlByName.get(cleanName) || url;
  });

  if (extension === "fbx") {
    return new FBXLoader(manager).parse(await file.arrayBuffer(), "");
  }

  if (extension === "glb" || extension === "gltf") {
    const loader = new GLTFLoader(manager);
    const source = extension === "glb" ? await file.arrayBuffer() : await file.text();
    const result = await new Promise((resolve, reject) => loader.parse(source, "", resolve, reject));
    return result.scene;
  }

  if (extension === "obj") {
    const loader = new OBJLoader(manager);
    const materialFile = [...urlByName.keys()].find((name) => /\.mtl$/i.test(name));
    if (materialFile) {
      const materialText = await fetch(urlByName.get(materialFile)).then((response) => response.text());
      const materials = new MTLLoader(manager).parse(materialText, "");
      materials.preload();
      loader.setMaterials(materials);
    }
    return loader.parse(await file.text());
  }

  if (extension === "stl") {
    const geometry = new STLLoader(manager).parse(await file.arrayBuffer());
    const material = new THREE.MeshStandardMaterial({ color: 0xd8d0c2, roughness: 0.7, metalness: 0.02 });
    return new THREE.Mesh(geometry, material);
  }

  throw new Error("暂不支持该格式");
}

function showModel(model, file, extension) {
  clearModel();
  currentModel = model;
  originalMeshMaterials = [];

  currentModel.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    if (child.geometry && !child.geometry.attributes.normal) child.geometry.computeVertexNormals();
    if (!child.material) child.material = new THREE.MeshStandardMaterial({ color: 0xd8d0c2 });
    rememberMaterials(child.material);
    originalMeshMaterials.push({ mesh: child, material: child.material });
  });

  scene.add(currentModel);
  exportButton.disabled = false;
  scaleSlider.value = "1";
  wireframeToggle.checked = false;
  emptyState.classList.add("is-hidden");
  sceneTitle.textContent = file.name;
  fileName.textContent = file.name;
  fileType.textContent = extension.toUpperCase();
  applyAppearance();
  updateStats(currentModel);
  focusModel();
  setStatus("加载完成");
}

function clearModel() {
  if (!currentModel) return;
  scene.remove(currentModel);
  currentModel.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) disposeMaterials(child.material);
  });
  currentModel = null;
  originalMeshMaterials = [];
  selectedMesh = null;
  materialStates.clear();
  partColorOverrides.clear();
  selectionBox.visible = false;
  selectedPartName.textContent = "未选择";
  applyPartColorButton.disabled = true;
  resetPartColorButton.disabled = true;
  exportButton.disabled = true;
  shadowPlane.visible = false;
}

function rememberMaterials(materialOrMaterials) {
  const materials = Array.isArray(materialOrMaterials) ? materialOrMaterials : [materialOrMaterials];
  materials.forEach((material) => {
    if (!material || materialStates.has(material)) return;
    materialStates.set(material, {
      color: material.color ? material.color.clone() : null,
      emissive: material.emissive ? material.emissive.clone() : null,
      emissiveIntensity: material.emissiveIntensity,
      map: "map" in material ? material.map : undefined,
      roughness: material.roughness,
      metalness: material.metalness,
      opacity: material.opacity,
      transparent: material.transparent,
    });
    if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
    material.needsUpdate = true;
  });
}

function disposeMaterials(materialOrMaterials) {
  const materials = Array.isArray(materialOrMaterials) ? materialOrMaterials : [materialOrMaterials];
  materials.forEach((material) => {
    if (!material || Object.values(renderMaterials).includes(material)) return;
    material.dispose();
  });
}

function applyAppearance() {
  if (!currentModel) return;
  const materialMode = materialSelect.value;
  const modelColor = getModelColorOverride();
  const tintColor = new THREE.Color(tintColorInput.value);
  const intensity = Number(colorIntensitySlider.value);

  originalMeshMaterials.forEach(({ mesh, material }) => {
    mesh.material = materialMode === "original" ? material : renderMaterials[materialMode];
  });

  if (materialMode === "original") {
    if (modelColor) {
      paintOriginalMaterials(modelColor);
    } else {
      restoreOriginalMaterials();
      tintOriginalMaterials(tintColor, intensity);
    }
  } else {
    tintRenderMaterial(renderMaterials[materialMode], modelColor || tintColor, modelColor ? 1 : intensity);
  }

  applyPartColorOverrides();
  setModelWireframe(wireframeToggle.checked);
}

function getModelColorOverride() {
  if (modelColorSelect.value === "original") return null;
  return new THREE.Color(modelColorPresets[modelColorSelect.value] || tintColorInput.value);
}

function restoreOriginalMaterials() {
  const seen = new Set();
  originalMeshMaterials.forEach(({ material }) => {
    const materials = Array.isArray(material) ? material : [material];
    materials.forEach((item) => {
      if (!item || seen.has(item)) return;
      seen.add(item);
      const state = materialStates.get(item);
      if (!state) return;
      if (item.color && state.color) item.color.copy(state.color);
      if (item.emissive && state.emissive) item.emissive.copy(state.emissive);
      if ("emissiveIntensity" in item) item.emissiveIntensity = state.emissiveIntensity || 0;
      if ("map" in item) item.map = state.map;
      if ("roughness" in item) item.roughness = state.roughness;
      if ("metalness" in item) item.metalness = state.metalness;
      if ("opacity" in item) item.opacity = state.opacity;
      if ("transparent" in item) item.transparent = state.transparent;
      item.needsUpdate = true;
    });
  });
}

function tintOriginalMaterials(tintColor, intensity) {
  if (intensity <= 0) return;
  const seen = new Set();
  originalMeshMaterials.forEach(({ material }) => {
    const materials = Array.isArray(material) ? material : [material];
    materials.forEach((item) => {
      if (!item || seen.has(item)) return;
      seen.add(item);
      const state = materialStates.get(item);
      if (item.color && state?.color) item.color.copy(state.color).lerp(tintColor, intensity * 0.65);
      item.needsUpdate = true;
    });
  });
}

function paintOriginalMaterials(color) {
  const seen = new Set();
  originalMeshMaterials.forEach(({ material }) => {
    const materials = Array.isArray(material) ? material : [material];
    materials.forEach((item) => {
      if (!item || seen.has(item)) return;
      seen.add(item);
      if (item.color) item.color.copy(color);
      if ("map" in item) item.map = null;
      if (item.emissive) {
        item.emissive.copy(color).multiplyScalar(0.1);
        item.emissiveIntensity = 0.25;
      }
      item.needsUpdate = true;
    });
  });
}

function tintRenderMaterial(material, color, intensity) {
  if (!material) return;
  const base = materialBaseColors[materialSelect.value] || new THREE.Color(0xd8d0c2);
  material.color.copy(base).lerp(color, intensity);
  if (material.emissive) {
    material.emissive.copy(color).multiplyScalar(intensity * 0.14);
    material.emissiveIntensity = intensity * 0.45;
  }
  material.needsUpdate = true;
}

function setModelWireframe(enabled) {
  if (!currentModel) return;
  currentModel.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if ("wireframe" in material) material.wireframe = enabled;
    });
  });
}

function selectMeshAtPointer(event) {
  if (!currentModel) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const meshes = [];
  currentModel.traverse((child) => {
    if (child.isMesh) meshes.push(child);
  });
  const hits = raycaster.intersectObjects(meshes, false);
  setSelectedMesh(hits.length ? hits[0].object : null);
}

function setSelectedMesh(mesh) {
  selectedMesh = mesh;
  selectionBox.visible = Boolean(mesh);
  selectedPartName.textContent = mesh ? getMeshDisplayName(mesh) : "未选择";
  applyPartColorButton.disabled = !mesh;
  resetPartColorButton.disabled = !mesh;
  if (mesh) {
    selectionBox.setFromObject(mesh);
    setStatus(`已选中：${getMeshDisplayName(mesh)}`);
  }
}

function getMeshDisplayName(mesh) {
  return mesh?.name || mesh?.parent?.name || `部件 ${mesh?.id || ""}`;
}

function applySelectedPartColor() {
  if (!selectedMesh) return;
  const color = partColorInput.value;
  partColorOverrides.set(selectedMesh, color);
  paintMesh(selectedMesh, new THREE.Color(color));
  selectionBox.setFromObject(selectedMesh);
  setStatus(`已修改部件颜色：${getMeshDisplayName(selectedMesh)}`);
}

function resetSelectedPartColor() {
  if (!selectedMesh) return;
  partColorOverrides.delete(selectedMesh);
  applyAppearance();
  selectionBox.setFromObject(selectedMesh);
  setStatus(`已恢复部件颜色：${getMeshDisplayName(selectedMesh)}`);
}

function applyPartColorOverrides() {
  partColorOverrides.forEach((color, mesh) => {
    if (mesh.parent) paintMesh(mesh, new THREE.Color(color));
  });
}

function paintMesh(mesh, color) {
  if (!hasLocalPartMaterial(mesh.material)) mesh.material = cloneMaterialForMesh(mesh.material);
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  materials.forEach((material) => {
    rememberMaterials(material);
    if (material.color) material.color.copy(color);
    if ("map" in material) material.map = null;
    if (material.emissive) {
      material.emissive.copy(color).multiplyScalar(0.1);
      material.emissiveIntensity = 0.25;
    }
    material.needsUpdate = true;
  });
  setModelWireframe(wireframeToggle.checked);
}

function cloneMaterialForMesh(materialOrMaterials) {
  if (Array.isArray(materialOrMaterials)) return materialOrMaterials.map((material) => markLocalMaterial(material.clone()));
  return markLocalMaterial(materialOrMaterials.clone());
}

function markLocalMaterial(material) {
  material.userData.localPartMaterial = true;
  return material;
}

function hasLocalPartMaterial(materialOrMaterials) {
  const materials = Array.isArray(materialOrMaterials) ? materialOrMaterials : [materialOrMaterials];
  return materials.every((material) => material?.userData.localPartMaterial);
}

async function exportCurrentModel() {
  if (!currentModel) {
    setStatus("请先加载模型", true);
    return;
  }

  const format = exportFormatSelect.value;
  const baseName = getExportBaseName(fileName.textContent);
  setStatus(`正在导出 ${format.toUpperCase()}...`);

  try {
    if (format === "glb" || format === "gltf") {
      const binary = format === "glb";
      const result = await new Promise((resolve, reject) => {
        new GLTFExporter().parse(currentModel, resolve, reject, {
          binary,
          embedImages: true,
          onlyVisible: false,
          truncateDrawRange: true,
        });
      });
      if (binary) {
        downloadBlob(result, `${baseName}.glb`, "model/gltf-binary");
      } else {
        downloadBlob(JSON.stringify(result, null, 2), `${baseName}.gltf`, "model/gltf+json");
      }
    } else if (format === "obj") {
      downloadBlob(new OBJExporter().parse(currentModel), `${baseName}.obj`, "text/plain");
    } else if (format === "stl") {
      downloadBlob(new STLExporter().parse(currentModel, { binary: false }), `${baseName}.stl`, "model/stl");
    }
    setStatus(`已导出 ${format.toUpperCase()}`);
  } catch (error) {
    console.error(error);
    setStatus(`导出失败：${error.message || "无法转换该模型"}`, true);
  }
}

function getExportBaseName(name) {
  const cleanName = name && name !== "未加载" ? name : "model";
  return cleanName.replace(/\.[^/.]+$/, "").replace(/[\\/:*?"<>|]+/g, "_") || "model";
}

function downloadBlob(content, downloadName, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = downloadName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function updateStats(model) {
  let meshes = 0;
  let faces = 0;
  model.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    meshes += 1;
    const geometry = child.geometry;
    const indexCount = geometry.index ? geometry.index.count : 0;
    const positionCount = geometry.attributes.position ? geometry.attributes.position.count : 0;
    faces += Math.floor((indexCount || positionCount) / 3);
  });
  meshCount.textContent = String(meshes);
  faceCount.textContent = faces.toLocaleString("zh-CN");
}

function focusModel() {
  if (!currentModel) {
    camera.position.set(3.2, 2.4, 4.4);
    camera.up.set(0, 1, 0);
    controls.target.set(0, 0, 0);
    controls.update();
    return;
  }

  const box = new THREE.Box3().setFromObject(currentModel);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z) || 1;
  const distance = maxSize / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));

  updateSceneBounds(box, center, maxSize);
  controls.target.copy(center);
  camera.near = Math.max(distance / 1000, 0.01);
  camera.far = distance * 1000;
  camera.updateProjectionMatrix();
  camera.position.copy(center).add(new THREE.Vector3(distance * 0.8, distance * 0.6, distance * 1.1));
  camera.up.set(0, 1, 0);
  controls.update();
}

function setView(direction) {
  const target = controls.target.clone();
  const distance = camera.position.distanceTo(target) || 5;
  const positions = {
    front: new THREE.Vector3(0, 0, distance),
    back: new THREE.Vector3(0, 0, -distance),
    top: new THREE.Vector3(0, distance, 0),
    bottom: new THREE.Vector3(0, -distance, 0),
    right: new THREE.Vector3(distance, 0, 0),
    left: new THREE.Vector3(-distance, 0, 0),
  };
  camera.position.copy(target).add(positions[direction]);
  if (direction === "top") {
    camera.up.set(0, 0, -1);
  } else if (direction === "bottom") {
    camera.up.set(0, 0, 1);
  } else {
    camera.up.set(0, 1, 0);
  }
  controls.update();
}

function updateSceneBounds(existingBox, existingCenter, existingMaxSize) {
  if (!currentModel) return;
  const box = existingBox || new THREE.Box3().setFromObject(currentModel);
  const center = existingCenter || box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxSize = existingMaxSize || Math.max(size.x, size.y, size.z) || 1;
  const floorY = box.min.y - maxSize * 0.012;
  const shadowSize = Math.max(maxSize * 2.8, 1.5);
  const shadowCameraSize = maxSize * 2.6;

  shadowPlane.position.set(center.x, floorY, center.z);
  shadowPlane.scale.set(shadowSize, shadowSize, 1);
  shadowPlane.visible = shadowToggle.checked;
  grid.position.set(center.x, floorY + maxSize * 0.002, center.z);
  grid.scale.setScalar(Math.max(maxSize / 4, 0.6));

  keyLight.position.copy(center).add(new THREE.Vector3(maxSize * 1.5, maxSize * 2.2, maxSize * 1.6));
  keyLight.target.position.copy(center);
  scene.add(keyLight.target);
  keyLight.shadow.camera.left = -shadowCameraSize;
  keyLight.shadow.camera.right = shadowCameraSize;
  keyLight.shadow.camera.top = shadowCameraSize;
  keyLight.shadow.camera.bottom = -shadowCameraSize;
  keyLight.shadow.camera.near = 0.01;
  keyLight.shadow.camera.far = maxSize * 6;
  keyLight.shadow.camera.updateProjectionMatrix();

  fillLight.position.copy(center).add(new THREE.Vector3(-maxSize * 1.6, maxSize * 1.1, -maxSize * 1.2));
  rimLight.position.copy(center).add(new THREE.Vector3(-maxSize * 1.2, maxSize * 1.8, maxSize * 1.7));
}

function resizeRenderer() {
  const { clientWidth, clientHeight } = viewer;
  renderer.setSize(clientWidth, clientHeight, false);
  composer.setSize(clientWidth, clientHeight);
  bloomPass.resolution.set(clientWidth, clientHeight);
  camera.aspect = clientWidth / Math.max(clientHeight, 1);
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  if (selectedMesh && selectionBox.visible) selectionBox.setFromObject(selectedMesh);
  composer.render();
}

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.style.color = isError ? "var(--danger)" : "";
}

function revokeObjectUrls() {
  currentObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  currentObjectUrls = [];
}
