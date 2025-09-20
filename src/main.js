import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

const overlay = document.getElementById("overlay");
const hud = document.getElementById("hud");

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.domElement.id = "game-canvas";
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02040f);

const camera = new THREE.PerspectiveCamera(
  72,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 6);
scene.add(camera);

const hemisphereLight = new THREE.HemisphereLight(0x9fb8ff, 0x07031a, 0.65);
scene.add(hemisphereLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
directionalLight.position.set(6, 12, 8);
scene.add(directionalLight);

const fillLight = new THREE.PointLight(0x4cc9f0, 0.4, 40, 2.5);
fillLight.position.set(-8, 6, -4);
scene.add(fillLight);

const axesHelper = new THREE.AxesHelper(1.2);
axesHelper.position.set(0, -3.2, 0);
scene.add(axesHelper);

const gridLayers = createSolvGrid(scene);
const levelLabels = createLevelLabels(scene, gridLayers.map((layer) => layer.level));
const particleField = createParticleField(scene);
const flowLines = createFlowLines(scene);

const clock = new THREE.Clock();
const keysPressed = new Set();

let yaw = 0;
let pitch = 0;
const maxPitch = Math.PI / 2 - 0.05;
const lookSpeed = 0.0025;
let pointerLocked = false;

const forward = new THREE.Vector3();
const horizontalForward = new THREE.Vector3();
const rightVector = new THREE.Vector3();
const moveVector = new THREE.Vector3();
const lookTarget = new THREE.Vector3();

overlay.addEventListener("click", () => {
  renderer.domElement.requestPointerLock();
});

renderer.domElement.addEventListener("click", () => {
  if (!pointerLocked) {
    renderer.domElement.requestPointerLock();
  }
});

document.addEventListener("pointerlockchange", () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
  overlay.classList.toggle("hidden", pointerLocked);
  if (!pointerLocked) {
    keysPressed.clear();
  }
});

document.addEventListener("pointerlockerror", () => {
  overlay.classList.remove("hidden");
});

window.addEventListener("keydown", (event) => {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
    event.preventDefault();
  }

  if (event.code === "KeyR") {
    resetPlayerState();
    return;
  }

  keysPressed.add(event.code);
});

window.addEventListener("keyup", (event) => {
  keysPressed.delete(event.code);
});

window.addEventListener("blur", () => {
  keysPressed.clear();
});

window.addEventListener("mousemove", (event) => {
  if (!pointerLocked) {
    return;
  }

  yaw -= event.movementX * lookSpeed;
  pitch -= event.movementY * lookSpeed;
  pitch = THREE.MathUtils.clamp(pitch, -maxPitch, maxPitch);
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

resetPlayerState();
updateHud(0);

function resetPlayerState() {
  camera.position.set(0, 0, 6);
  yaw = 0;
  pitch = 0;
}

function updateHud(delta) {
  const solvX = camera.position.x;
  const solvY = camera.position.z;
  const solvZ = camera.position.y;

  const scaleX = Math.exp(-solvZ);
  const scaleY = Math.exp(solvZ);

  const yawDeg = THREE.MathUtils.radToDeg(yaw);
  const pitchDeg = THREE.MathUtils.radToDeg(pitch);

  hud.innerHTML = `
    <div class="hud__row">
      <div class="hud__label">坐标 (Solv)</div>
      <div class="hud__value">x: ${solvX.toFixed(2)} · y: ${solvY.toFixed(2)} · z: ${solvZ.toFixed(2)}</div>
    </div>
    <div class="hud__row">
      <div class="hud__label">尺度因子</div>
      <div class="hud__value">e^z: ${scaleY.toFixed(2)} · e^{-z}: ${scaleX.toFixed(2)}</div>
    </div>
    <div class="hud__row">
      <div class="hud__label">视角</div>
      <div class="hud__value">yaw: ${yawDeg.toFixed(1)}° · pitch: ${pitchDeg.toFixed(1)}°</div>
    </div>
    <div class="hud__row">
      <div class="hud__label">提示</div>
      <div class="hud__value">WASD 移动 · Space/Shift 上下 · R 重置</div>
    </div>
  `;
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  updateControls(delta);
  updateEnvironment(delta);
  renderer.render(scene, camera);
  updateHud(delta);
}

function updateControls(delta) {
  const baseSpeed = pointerLocked ? 3.2 : 1.2;
  const verticalSpeed = 1.8;
  const acceleration = keysPressed.has("KeyF") ? 1.4 : 1.0;

  let newSolvZ = camera.position.y;
  const ascend = keysPressed.has("Space") || keysPressed.has("KeyQ");
  const descend = keysPressed.has("ShiftLeft") || keysPressed.has("ShiftRight") || keysPressed.has("KeyE") || keysPressed.has("KeyC");

  if (ascend) {
    newSolvZ += verticalSpeed * delta;
  }
  if (descend) {
    newSolvZ -= verticalSpeed * delta;
  }
  newSolvZ = THREE.MathUtils.clamp(newSolvZ, -3.3, 3.3);
  camera.position.y = newSolvZ;

  forward.set(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch)
  );
  horizontalForward.set(forward.x, 0, forward.z);
  if (horizontalForward.lengthSq() > 0) {
    horizontalForward.normalize();
  }

  rightVector.crossVectors(horizontalForward, THREE.Object3D.DEFAULT_UP).normalize();

  moveVector.set(0, 0, 0);
  if (keysPressed.has("KeyW")) {
    moveVector.add(horizontalForward);
  }
  if (keysPressed.has("KeyS")) {
    moveVector.addScaledVector(horizontalForward, -1);
  }
  if (keysPressed.has("KeyD")) {
    moveVector.add(rightVector);
  }
  if (keysPressed.has("KeyA")) {
    moveVector.addScaledVector(rightVector, -1);
  }

  if (moveVector.lengthSq() > 0) {
    moveVector.normalize();
    const scaleX = Math.exp(-newSolvZ);
    const scaleY = Math.exp(newSolvZ);
    camera.position.x += moveVector.x * scaleX * baseSpeed * acceleration * delta;
    camera.position.z += moveVector.z * scaleY * baseSpeed * acceleration * delta;
  }

  lookTarget.copy(camera.position).add(forward);
  camera.lookAt(lookTarget);
}

function updateEnvironment(delta) {
  const elapsed = clock.elapsedTime;
  gridLayers.forEach(({ material, level }) => {
    const distance = Math.abs(camera.position.y - level);
    const opacity = THREE.MathUtils.clamp(0.75 * Math.exp(-distance * 0.8), 0.12, 0.7);
    material.opacity = opacity;
  });

  levelLabels.forEach((sprite, index) => {
    const offset = Math.sin(elapsed * 0.6 + index) * 0.15;
    sprite.position.x = 0.0;
    sprite.position.y = gridLayers[index].level + 0.05 + offset;
  });

  particleField.rotation.y += delta * 0.05;
  particleField.rotation.x = Math.sin(elapsed * 0.1) * 0.12;

  flowLines.rotation.y = Math.sin(elapsed * 0.05) * 0.08;
}

function createSolvGrid(targetScene) {
  const levels = [-2.8, -1.6, -0.6, 0.6, 1.6, 2.8];
  const layers = [];

  levels.forEach((level, index) => {
    const positions = [];
    const xSpacing = Math.exp(-level) * 0.8;
    const zSpacing = Math.exp(level) * 0.8;
    const steps = 8;
    const halfX = xSpacing * steps;
    const halfZ = zSpacing * steps;

    for (let i = -steps; i <= steps; i += 1) {
      const x = i * xSpacing;
      positions.push(x, level, -halfZ, x, level, halfZ);
    }

    for (let j = -steps; j <= steps; j += 1) {
      const z = j * zSpacing;
      positions.push(-halfX, level, z, halfX, level, z);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );

    const color = new THREE.Color().setHSL(0.58 - index * 0.08, 0.65, 0.54);
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });

    const grid = new THREE.LineSegments(geometry, material);
    targetScene.add(grid);
    layers.push({ mesh: grid, material, level });
  });

  return layers;
}

function createLevelLabels(targetScene, levels) {
  const sprites = [];
  const fontFamily = "600 42px 'Segoe UI', 'PingFang SC', sans-serif";

  levels.forEach((level, index) => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(9, 15, 32, 0.75)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(130, 176, 255, 0.9)";
    ctx.font = fontFamily;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`z = ${level.toFixed(1)}`, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });

    const sprite = new THREE.Sprite(material);
    sprite.position.set(0, level + 0.05, -4.6);
    sprite.scale.set(2.2, 1.1, 1);

    targetScene.add(sprite);
    sprites.push(sprite);
  });

  return sprites;
}

function createParticleField(targetScene) {
  const count = 420;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const layer = THREE.MathUtils.lerp(-3.2, 3.2, Math.random());
    const xRange = 5.5 * Math.exp(-layer);
    const zRange = 5.5 * Math.exp(layer);

    positions[i * 3] = THREE.MathUtils.randFloatSpread(2 * xRange);
    positions[i * 3 + 1] = layer + THREE.MathUtils.randFloatSpread(0.45);
    positions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(2 * zRange);

    const hue = 0.55 + ((layer + 3.2) / 6.4) * 0.18;
    const color = new THREE.Color().setHSL(hue, 0.6, 0.62);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.08,
    transparent: true,
    opacity: 0.85,
    vertexColors: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  targetScene.add(points);
  return points;
}

function createFlowLines(targetScene) {
  const group = new THREE.Group();
  const levels = [-2, 0, 2];

  levels.forEach((level, index) => {
    const lengthX = Math.exp(-level) * 6.5;
    const lengthZ = Math.exp(level) * 6.5;

    const xGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-lengthX, level, 0),
      new THREE.Vector3(lengthX, level, 0),
    ]);
    const zGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, level, -lengthZ),
      new THREE.Vector3(0, level, lengthZ),
    ]);

    const color = new THREE.Color().setHSL(0.08 + index * 0.16, 0.8, 0.56);
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      linewidth: 2,
      depthWrite: false,
    });

    const xLine = new THREE.Line(xGeometry, material);
    const zLine = new THREE.Line(zGeometry, material);
    group.add(xLine);
    group.add(zLine);
  });

  targetScene.add(group);
  return group;
}

animate();
