import * as THREE from "./vendor/three/three.module.js";
import { OrbitControls } from "./vendor/three/OrbitControls.js";

/* =========================================================
   NAVEGACIÓN ENTRE PUESTOS
   ========================================================= */
const stallButtons = document.querySelectorAll(".stall-btn");
const puestos = document.querySelectorAll(".puesto");

stallButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    stallButtons.forEach(b => b.classList.remove("active"));
    puestos.forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.target).classList.add("active");
    if (btn.dataset.target === "puesto-1") onSceneVisible();
    if (btn.dataset.target === "puesto-3") actualizarPrediccion();
  });
});

/* =========================================================
   PUESTO 1 — ESCENA 3D INTERACTIVA
   ========================================================= */
const canvas = document.getElementById("scene3d");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b2a28);
scene.fog = new THREE.Fog(0x1b2a28, 6, 12);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(3.4, 2.4, 4.2);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 2.5;
controls.maxDistance = 8;
controls.maxPolarAngle = Math.PI * 0.49; // no dejar ver "debajo del piso"
controls.target.set(0, 0.2, 0);
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;
canvas.addEventListener("pointerdown", () => (controls.autoRotate = false));

scene.add(new THREE.HemisphereLight(0xfffdf7, 0x1b2a28, 0.9));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
keyLight.position.set(4, 5, 3);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.left = -3;
keyLight.shadow.camera.right = 3;
keyLight.shadow.camera.top = 3;
keyLight.shadow.camera.bottom = -3;
keyLight.shadow.radius = 4;
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0xe2892f, 0.6);
rimLight.position.set(-3, 2, -3);
scene.add(rimLight);

// --- Piso: recibe sombras y da apoyo visual a los objetos ---
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(4.5, 48),
  new THREE.MeshStandardMaterial({ color: 0x142320, roughness: 0.95, metalness: 0 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.55;
floor.receiveShadow = true;
scene.add(floor);

// --- Empaque textil: textura real de la bolsa (foto del prototipo, fondo transparente) ---
const textureLoader = new THREE.TextureLoader();
const empaqueTexture = textureLoader.load("img/empaque-fresa.png");
empaqueTexture.colorSpace = THREE.SRGBColorSpace;

const empaqueGeo = new THREE.PlaneGeometry(1.8, 2.25, 60, 60);
const empaqueMat = new THREE.MeshPhysicalMaterial({
  map: empaqueTexture,
  color: 0xffffff,
  roughness: 0.75,
  metalness: 0.0,
  sheen: 0.6,
  sheenRoughness: 0.6,
  sheenColor: new THREE.Color(0xfffdf7),
  transparent: true,
  alphaTest: 0.35,
  side: THREE.DoubleSide,
});
const empaqueGroup = new THREE.Group();
const empaqueFront = new THREE.Mesh(empaqueGeo, empaqueMat);
empaqueFront.castShadow = true;
empaqueFront.receiveShadow = true;
empaqueGroup.add(empaqueFront);
empaqueGroup.rotation.x = -0.15;
empaqueGroup.position.set(-1.1, 0.1, 0);
scene.add(empaqueGroup);

function animateCloth(mesh, t, phase) {
  const pos = mesh.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const wave =
      Math.sin(x * 2.4 + t * 1.1 + phase) * 0.025 +
      Math.cos(y * 2.0 - t * 0.8 + phase) * 0.025 +
      Math.sin((x + y) * 3.1 + t * 1.6) * 0.008; // arruga fina secundaria
    pos.setZ(i, wave);
  }
  pos.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}

// --- Indicador colorimétrico: anillo de luz que resalta el sensor real de la foto ---
const indicadorGeo = new THREE.TorusGeometry(0.16, 0.014, 12, 40);
const indicadorMat = new THREE.MeshPhysicalMaterial({
  color: 0x3e7c6b,
  roughness: 0.35,
  clearcoat: 0.6,
  clearcoatRoughness: 0.3,
  emissive: new THREE.Color(0x3e7c6b),
  emissiveIntensity: 0.6,
});
const indicador = new THREE.Mesh(indicadorGeo, indicadorMat);
indicador.position.set(-1.08, 0.08, 0.09);
indicador.castShadow = true;
scene.add(indicador);

// --- Helper: pines metálicos tipo header, en fila ---
function crearFilaPines(cantidad, spacing, matPin) {
  const grupo = new THREE.Group();
  for (let i = 0; i < cantidad; i++) {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 6), matPin);
    pin.position.x = (i - (cantidad - 1) / 2) * spacing;
    pin.castShadow = true;
    grupo.add(pin);
  }
  return grupo;
}

const matPinMetal = new THREE.MeshStandardMaterial({ color: 0xcfd3d6, metalness: 0.9, roughness: 0.3 });

// --- NodeMCU (placa con chip ESP8266, USB y pines) ---
const nodemcuGroup = new THREE.Group();
const nodemcuBody = new THREE.Mesh(
  new THREE.BoxGeometry(0.6, 1.3, 0.06),
  new THREE.MeshStandardMaterial({ color: 0x142b26, roughness: 0.55, metalness: 0.1 })
);
const nodemcuShield = new THREE.Mesh(
  new THREE.BoxGeometry(0.32, 0.32, 0.07),
  new THREE.MeshStandardMaterial({ color: 0xb7bcc0, metalness: 0.85, roughness: 0.25 })
);
nodemcuShield.position.set(0, 0.15, 0.065);
const nodemcuUsb = new THREE.Mesh(
  new THREE.BoxGeometry(0.22, 0.1, 0.1),
  new THREE.MeshStandardMaterial({ color: 0xc9c9c9, metalness: 0.7, roughness: 0.4 })
);
nodemcuUsb.position.set(0, -0.68, 0.02);

const pinesIzq = crearFilaPines(15, 0.083, matPinMetal);
pinesIzq.rotation.z = Math.PI / 2;
pinesIzq.position.set(-0.32, 0, 0.02);
const pinesDer = pinesIzq.clone();
pinesDer.position.x = 0.32;

nodemcuGroup.add(nodemcuBody, nodemcuShield, nodemcuUsb, pinesIzq, pinesDer);
nodemcuGroup.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
nodemcuGroup.position.set(0.7, 0.3, 0.3);
nodemcuGroup.rotation.y = 0.3;
scene.add(nodemcuGroup);

// --- DHT22 (cuerpo blanco, rejilla de orificios, pines de conexión) ---
const dhtGroup = new THREE.Group();
const dhtBody = new THREE.Mesh(
  new THREE.BoxGeometry(0.5, 0.7, 0.28),
  new THREE.MeshPhysicalMaterial({ color: 0xfffdf7, roughness: 0.55, clearcoat: 0.2 })
);
const dhtPcb = new THREE.Mesh(
  new THREE.BoxGeometry(0.44, 0.64, 0.05),
  new THREE.MeshStandardMaterial({ color: 0x1c3d6b, roughness: 0.6 })
);
dhtPcb.position.z = -0.15;

const rejilla = new THREE.Group();
const holeMat = new THREE.MeshStandardMaterial({ color: 0x2b2320, roughness: 0.8 });
for (let row = -2; row <= 2; row++) {
  for (let col = -1; col <= 1; col++) {
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 8), holeMat);
    hole.rotation.x = Math.PI / 2;
    hole.position.set(col * 0.09, row * 0.09, 0.15);
    rejilla.add(hole);
  }
}

const dhtPines = crearFilaPines(4, 0.06, matPinMetal);
dhtPines.rotation.x = Math.PI / 2;
dhtPines.position.set(0, -0.4, 0);

dhtGroup.add(dhtBody, dhtPcb, rejilla, dhtPines);
dhtGroup.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
dhtGroup.position.set(1.5, 0.45, -0.2);
dhtGroup.rotation.y = -0.4;
scene.add(dhtGroup);

// --- Textura suave tipo "puff" de humo, generada por canvas ---
function crearTexturaHumo() {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx2d = c.getContext("2d");
  const grad = ctx2d.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.4, "rgba(255,255,255,0.6)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx2d.fillStyle = grad;
  ctx2d.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// --- Humo / vapor de óxido de cobre: sale del sensor cuando detecta riesgo ---
const HUMO_COUNT = 140;
const humoOrigen = indicador.position.clone().add(new THREE.Vector3(0, -0.05, 0.03));
const humoGeo = new THREE.BufferGeometry();
const humoPos = new Float32Array(HUMO_COUNT * 3);
const humoColor = new Float32Array(HUMO_COUNT * 3);
const humoVel = [];
const humoVida = new Float32Array(HUMO_COUNT);
const humoVidaMax = new Float32Array(HUMO_COUNT);

const COLOR_HUMO = new THREE.Color(0x5be0c9); // turquesa, como el "óxido activado" de la imagen

function resetParticulaHumo(i, instantanea = false) {
  const idx = i * 3;
  humoPos[idx] = humoOrigen.x + (Math.random() - 0.5) * 0.05;
  humoPos[idx + 1] = humoOrigen.y + (Math.random() - 0.5) * 0.05;
  humoPos[idx + 2] = humoOrigen.z + (Math.random() - 0.5) * 0.05;
  humoVel[i] = new THREE.Vector3(
    (Math.random() - 0.5) * 0.12,
    -0.25 - Math.random() * 0.15, // baja hacia la fruta, como en la referencia
    (Math.random() - 0.5) * 0.12
  );
  humoVidaMax[i] = 1.4 + Math.random() * 1.2;
  humoVida[i] = instantanea ? Math.random() * humoVidaMax[i] : humoVidaMax[i];
}
for (let i = 0; i < HUMO_COUNT; i++) resetParticulaHumo(i, true);

humoGeo.setAttribute("position", new THREE.BufferAttribute(humoPos, 3));
humoGeo.setAttribute("color", new THREE.BufferAttribute(humoColor, 3));

const humoMat = new THREE.PointsMaterial({
  size: 0.16,
  map: crearTexturaHumo(),
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexColors: true,
  sizeAttenuation: true,
});
const humo = new THREE.Points(humoGeo, humoMat);
scene.add(humo);

let humoActivo = false; // se activa desde el botón "Simular cambio de color"

function actualizarHumo(dt) {
  for (let i = 0; i < HUMO_COUNT; i++) {
    humoVida[i] -= dt;
    if (humoVida[i] <= 0) {
      if (humoActivo) {
        resetParticulaHumo(i);
      } else {
        humoColor[i * 3] = humoColor[i * 3 + 1] = humoColor[i * 3 + 2] = 0;
        continue;
      }
    }
    const idx = i * 3;
    humoPos[idx] += humoVel[i].x * dt;
    humoPos[idx + 1] += humoVel[i].y * dt;
    humoPos[idx + 2] += humoVel[i].z * dt;

    const vida = Math.max(humoVida[i] / humoVidaMax[i], 0);
    const brillo = Math.sin((1 - vida) * Math.PI) * (humoActivo ? 1 : 0); // aparece y se disipa
    humoColor[idx] = COLOR_HUMO.r * brillo;
    humoColor[idx + 1] = COLOR_HUMO.g * brillo;
    humoColor[idx + 2] = COLOR_HUMO.b * brillo;
  }
  humoGeo.attributes.position.needsUpdate = true;
  humoGeo.attributes.color.needsUpdate = true;
}

const objectsByTag = {
  empaque: empaqueGroup,
  indicador: indicador,
  nodemcu: nodemcuGroup,
  dht22: dhtGroup,
};

function resizeRenderer() {
  const rect = canvas.parentElement.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resizeRenderer);

let sceneStarted = false;
function onSceneVisible() {
  if (sceneStarted) { resizeRenderer(); return; }
  sceneStarted = true;
  resizeRenderer();
  animate();
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  const dt = Math.min(clock.getDelta(), 0.05);

  animateCloth(empaqueFront, t, 0);

  nodemcuGroup.position.y = 0.3 + Math.sin(t * 0.9) * 0.03;
  dhtGroup.position.y = 0.45 + Math.sin(t * 0.9 + 1.2) * 0.03;

  indicadorMat.emissiveIntensity = 0.6 + Math.sin(t * 2) * 0.35;

  actualizarHumo(dt);

  controls.update();
  renderer.render(scene, camera);
}
onSceneVisible(); // Puesto 1 is active by default on load

// --- Hotspots <-> info cards, con resaltado del objeto 3D ---
const hotspotBtns = document.querySelectorAll(".hotspot");
const infoCards = document.querySelectorAll(".info-card");

function selectHotspot(tag) {
  hotspotBtns.forEach(b => b.classList.toggle("active", b.dataset.target === tag));
  infoCards.forEach(c => c.classList.toggle("active", c.dataset.card === tag));

  Object.entries(objectsByTag).forEach(([key, obj]) => {
    const scale = key === tag ? 1.12 : 1;
    obj.scale.setScalar(scale);
  });
}
hotspotBtns.forEach(btn => btn.addEventListener("click", () => selectHotspot(btn.dataset.target)));

// --- Botón: simular cambio de color del indicador (y su vapor de óxido de cobre) ---
let indicadorFresco = true;
document.getElementById("toggle-indicador").addEventListener("click", () => {
  indicadorFresco = !indicadorFresco;
  const nuevoColor = indicadorFresco ? 0x3e7c6b : 0xb23a2e;
  indicadorMat.color.set(nuevoColor);
  indicadorMat.emissive.set(nuevoColor);
  humoActivo = !indicadorFresco; // el vapor solo sale cuando detecta deterioro
});

/* =========================================================
   PUESTO 2 — REGISTRO DE PRODUCTOS
   ========================================================= */
const registroForm = document.getElementById("registro-form");
const registroBody = document.getElementById("registro-body");
const registros = [];

function estadoPorMinutos(min) {
  if (min < 60) return { texto: "Fresco", clase: "estado-fresco" };
  if (min < 180) return { texto: "Vigilar", clase: "estado-alerta" };
  return { texto: "Riesgo", clase: "estado-riesgo" };
}

function renderRegistros() {
  if (registros.length === 0) {
    registroBody.innerHTML = `<tr class="empty-row"><td colspan="5">Aún no hay productos registrados.</td></tr>`;
    return;
  }
  registroBody.innerHTML = registros.map(r => {
    const minutos = Math.round((Date.now() - r.ingreso) / 60000);
    const estado = estadoPorMinutos(minutos);
    const tiempoTexto = minutos < 1 ? "recién ingresado" : `${minutos} min`;
    return `<tr>
      <td>${r.producto}</td>
      <td>${r.vendedor}</td>
      <td>${new Date(r.ingreso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
      <td>${tiempoTexto}</td>
      <td class="${estado.clase}">${estado.texto}</td>
    </tr>`;
  }).join("");
}

registroForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const producto = document.getElementById("r-producto").value.trim();
  const vendedor = document.getElementById("r-vendedor").value.trim();
  if (!producto || !vendedor) return;
  registros.unshift({ producto, vendedor, ingreso: Date.now() });
  registroForm.reset();
  renderRegistros();
});

renderRegistros();
setInterval(renderRegistros, 30000); // refresca el "tiempo transcurrido"

/* =========================================================
   PUESTO 3 — MODELO PREDICTIVO (heurística tipo Q10)
   ========================================================= */
const ctlTemp = document.getElementById("ctl-temp");
const ctlHum = document.getElementById("ctl-hum");
const ctlTemporada = document.getElementById("ctl-temporada");
const valTemp = document.getElementById("val-temp");
const valHum = document.getElementById("val-hum");
const predictionHours = document.getElementById("prediction-hours");
const chartSvg = document.getElementById("chart-predictivo");
const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

const BASE_HOURS_AT_4C = 120; // vida útil de referencia a 4°C
const Q10 = 2.2;              // la velocidad de deterioro ~se duplica cada 10°C

function vidaUtilHoras(tempC, humedadPct, temporada) {
  let horas = BASE_HOURS_AT_4C / Math.pow(Q10, (tempC - 4) / 10);
  const factorHumedad = 1 - Math.max(0, (humedadPct - 60)) * 0.004;
  horas *= factorHumedad;
  if (temporada === "lluvias") horas *= 0.9;
  return Math.max(2, horas);
}

function drawChart(tempC, humedadPct, temporada) {
  while (chartSvg.firstChild) chartSvg.removeChild(chartSvg.firstChild);

  const W = 400, H = 260;
  const padding = { left: 42, right: 16, top: 16, bottom: 28 };
  const plotW = W - padding.left - padding.right;
  const plotH = H - padding.top - padding.bottom;

  const points = 24; // horas simuladas
  const vidaTotal = vidaUtilHoras(tempC, humedadPct, temporada);
  const decayRate = 3 / vidaTotal; // constante para exp decay hasta ~5% en vidaTotal

  const calidad = [];
  for (let hIdx = 0; hIdx <= points; hIdx++) {
    calidad.push(Math.exp(-decayRate * hIdx));
  }

  // ejes
  chartSvg.appendChild(svgEl("polyline", {
    points: `${padding.left},${padding.top} ${padding.left},${padding.top + plotH} ${padding.left + plotW},${padding.top + plotH}`,
    fill: "none", stroke: "rgba(43,35,32,0.25)", "stroke-width": 1,
  }));

  const addText = (x, y, text, anchor = "start") => {
    const t = svgEl("text", {
      x, y, fill: "rgba(43,35,32,0.55)", "font-size": "11",
      "font-family": "'JetBrains Mono', monospace", "text-anchor": anchor,
    });
    t.textContent = text;
    chartSvg.appendChild(t);
  };
  addText(4, padding.top + 10, "100%");
  addText(14, padding.top + plotH + 4, "0%");
  addText(padding.left, padding.top + plotH + 20, "0h");
  addText(padding.left + plotW, padding.top + plotH + 20, `${points}h`, "end");

  // umbral de riesgo (40%)
  const yUmbral = padding.top + plotH * (1 - 0.4);
  chartSvg.appendChild(svgEl("line", {
    x1: padding.left, y1: yUmbral, x2: padding.left + plotW, y2: yUmbral,
    stroke: "rgba(193,39,45,0.55)", "stroke-width": 1, "stroke-dasharray": "4,4",
  }));

  // curva + área bajo la curva
  const curvePts = calidad.map((q, i) => {
    const x = padding.left + (plotW * i) / points;
    const y = padding.top + plotH * (1 - q);
    return `${x},${y}`;
  });

  chartSvg.appendChild(svgEl("polygon", {
    points: [...curvePts, `${padding.left + plotW},${padding.top + plotH}`, `${padding.left},${padding.top + plotH}`].join(" "),
    fill: "rgba(193,39,45,0.10)",
  }));

  chartSvg.appendChild(svgEl("polyline", {
    points: curvePts.join(" "),
    fill: "none", stroke: "#3D0C0F", "stroke-width": 2.5,
    "stroke-linecap": "round", "stroke-linejoin": "round",
  }));
}

function actualizarPrediccion() {
  const tempC = Number(ctlTemp.value);
  const humedadPct = Number(ctlHum.value);
  const temporada = ctlTemporada.value;

  valTemp.textContent = tempC;
  valHum.textContent = humedadPct;

  const horas = vidaUtilHoras(tempC, humedadPct, temporada);
  predictionHours.textContent = horas.toFixed(0);

  drawChart(tempC, humedadPct, temporada);
}

[ctlTemp, ctlHum, ctlTemporada].forEach(el => el.addEventListener("input", actualizarPrediccion));

actualizarPrediccion();
