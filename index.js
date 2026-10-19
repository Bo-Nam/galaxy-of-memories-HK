import * as THREE from "https://threejsfundamentals.org/threejs/resources/threejs/r122/build/three.module.js";
import { OrbitControls } from "https://threejsfundamentals.org/threejs/resources/threejs/r122/examples/jsm/controls/OrbitControls.js";

// ===== DOM references =====
const canvas = document.querySelector("canvas.webgl");
const preview = document.getElementById("preview");
const previewImage = document.getElementById("previewImage");
const previewTitle = document.getElementById("previewTitle");
const previewClose = document.getElementById("previewClose");
const loadingScreen = document.getElementById("loadingScreen");
const loadingFill = document.getElementById("loadingFill");
const loadingPercent = document.getElementById("loadingPercent");
const loadingSub = document.getElementById("loadingSub");
const loadingStep = document.getElementById("loadingStep");
const loadingQuote = document.getElementById("loadingQuote");
const bgMusic = document.getElementById("bgMusic");
const musicToggle = document.getElementById("musicToggle");

// Fallback image names used when manifest.json cannot be loaded
const defaultImageFiles = Array.from(
  { length: 60 },
  (_, index) => `memory-${String(index + 1).padStart(3, "0")}.webp`,
);

// Messages shown on the loading screen, switched by loading progress
const loadingQuotes = [
];

// ===== Loading screen helpers =====

/** Restrict a number to the [min, max] range */
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
/** Update progress bar, step label, sub label and the quote matching the progress */
const updateLoading = (progress, stepText = "", subText = "") => {
  const safeProgress = clamp(progress, 0, 100);
  loadingFill.style.width = `${safeProgress}%`;
  loadingPercent.textContent = `${Math.round(safeProgress)}%`;
  if (stepText) {
    loadingStep.textContent = stepText;
  }
  if (subText) {
    loadingSub.textContent = subText;
  }
  const quoteIndex = Math.min(
    loadingQuotes.length - 1,
    Math.floor((safeProgress / 100) * loadingQuotes.length),
  );
  loadingQuote.textContent = loadingQuotes[quoteIndex];
};

/** Fill the bar to 100% then fade the loading screen out */
const finishLoading = () => {
  updateLoading(100, "Ready", "Open the galaxy...");
  setTimeout(() => {
    loadingScreen.classList.add("hidden");
  }, 420);
};

updateLoading(3, "Boot", "Starting stars...");

// ===== Scene setup =====

// Current viewport dimensions, kept in sync on resize
const viewportSize = {
  width: window.innerWidth,
  height: window.innerHeight,
};

// Main scene with exponential fog for depth
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2("#0a0b20", 0.05);

// Perspective camera positioned slightly above and in front of the core
const camera = new THREE.PerspectiveCamera(
  63,
  viewportSize.width / viewportSize.height,
  0.1,
  100,
);
camera.position.set(0, 1.2, 9.8);
scene.add(camera);

// WebGL renderer bound to the existing canvas
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.03;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewportSize.width, viewportSize.height);

// Orbit controls with damping; panning disabled and zoom range limited
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 4.4;
controls.maxDistance = 15.4;
controls.rotateSpeed = 0.78;
controls.target.set(0, 0, 0);

// ===== Lighting =====
const ambient = new THREE.AmbientLight(0xffefff, 0.62);
scene.add(ambient);

const keyLight = new THREE.PointLight(0xffabf4, 1.2, 44, 2);
keyLight.position.set(2.1, 1.9, 2.4);
scene.add(keyLight);

const rimLight = new THREE.PointLight(0x8eb4ff, 0.84, 46, 2);
rimLight.position.set(-3.2, 1.6, -3.1);
scene.add(rimLight);

// ===== Central core (sphere, rings and glow) =====
const coreGroup = new THREE.Group();
scene.add(coreGroup);

const sphere = new THREE.Mesh(
  new THREE.SphereGeometry(1.45, 64, 64),
  new THREE.MeshPhysicalMaterial({
    color: 0xffb6f1,
    emissive: 0xd666e8,
    emissiveIntensity: 0.56,
    roughness: 0.2,
    metalness: 0.08,
    clearcoat: 0.6,
    clearcoatRoughness: 0.14,
    transmission: 0.2,
    transparent: true,
    opacity: 0.96,
  }),
);
coreGroup.add(sphere);

const ringMaterial = new THREE.MeshBasicMaterial({
  color: 0xfff1ff,
  transparent: true,
  opacity: 0.72,
});

const ringPrimary = new THREE.Mesh(
  new THREE.TorusGeometry(2.58, 0.036, 20, 160),
  ringMaterial.clone(),
);
ringPrimary.rotation.set(1.08, 0.42, 0.22);
coreGroup.add(ringPrimary);

const ringSecondary = new THREE.Mesh(
  new THREE.TorusGeometry(2.2, 0.028, 20, 160),
  ringMaterial.clone(),
);
ringSecondary.rotation.set(-0.54, 0.24, 1.35);
ringSecondary.material.opacity = 0.48;
coreGroup.add(ringSecondary);

/** Build a soft radial gradient texture on an offscreen canvas */
const createRadialTexture = (innerColor, midColor) => {
  const size = 256;
  const canvasElement = document.createElement("canvas");
  canvasElement.width = size;
  canvasElement.height = size;
  const context2d = canvasElement.getContext("2d");
  const gradient = context2d.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );

  gradient.addColorStop(0, innerColor);
  gradient.addColorStop(0.4, midColor);
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context2d.fillStyle = gradient;
  context2d.fillRect(0, 0, size, size);

  const generatedTexture = new THREE.CanvasTexture(canvasElement);
  generatedTexture.needsUpdate = true;
  return generatedTexture;
};

// Additive glow sprite behind the sphere
const glow = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: createRadialTexture("rgba(255,255,255,0.95)", "rgba(255,214,248,0.6)"),
    color: 0xffd8fb,
    transparent: true,
    opacity: 0.76,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }),
);
glow.scale.set(4.35, 4.35, 1);
coreGroup.add(glow);

// ===== Background starfield =====
// Random points distributed on a spherical shell around the scene
const starGeometry = new THREE.BufferGeometry();
const starCount = 3000;
const starPositions = new Float32Array(starCount * 3);

for (let i = 0; i < starCount; i++) {
  const positionOffset = i * 3;
  const radius = 18 + Math.random() * 26;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);

  starPositions[positionOffset] = Math.sin(phi) * Math.cos(theta) * radius;
  starPositions[positionOffset + 1] = Math.cos(phi) * radius;
  starPositions[positionOffset + 2] = Math.sin(phi) * Math.sin(theta) * radius;
}

starGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(starPositions, 3),
);

const stars = new THREE.Points(
  starGeometry,
  new THREE.PointsMaterial({
    size: 0.05,
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  }),
);
scene.add(stars);

// ===== Memory images & sparkles =====
const memoryGroup = new THREE.Group();
scene.add(memoryGroup);

const sparkleGroup = new THREE.Group();
scene.add(sparkleGroup);

const sprites = [];
const sparkles = [];
const tempVector = new THREE.Vector3();

// Raycaster used to detect clicks on memory sprites
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

/** Load an image as a texture; resolves to null when loading fails */
const textureLoader = new THREE.TextureLoader();
const loadTexture = (fileName) =>
  new Promise((resolve) => {
    textureLoader.load(
      `images/${fileName}`,
      (texture) => {
        texture.encoding = THREE.sRGBEncoding;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        resolve(texture);
      },
      undefined,
      () => resolve(null),
    );
  });

/** Read the list of image files from manifest.json, falling back to defaults */
const fetchImageFileList = async () => {
  try {
    const response = await fetch("images/manifest.json");
    if (!response.ok) {
      return defaultImageFiles;
    }
    const manifest = await response.json();
    const files = manifest.filter((file) =>
      /\.(png|jpe?g|webp|gif|avif)$/i.test(file),
    );
    return files.length > 0 ? files : defaultImageFiles;
  } catch (error) {
    return defaultImageFiles;
  }
};

/** Create one orbiting sprite for an image and store its motion parameters in userData */
const createMemorySprite = (texture, fileName, index) => {
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);
  const frontLayer = Math.random() < 0.72;
  const baseScale = frontLayer
    ? THREE.MathUtils.randFloat(0.5, 1.18)
    : THREE.MathUtils.randFloat(0.36, 0.78);
  // Use the real image ratio (width / height) so photos are never stretched.
  // Dividing/multiplying by sqrt(aspect) keeps the on-screen area similar for portrait and landscape photos.
  const image = texture.image;
  const aspect =
    image && image.width && image.height ? image.width / image.height : 1;
  const widthFactor = Math.sqrt(aspect);
  const heightFactor = 1 / widthFactor;

  sprite.userData = {
    fileName,
    baseScale,
    aspect,
    widthFactor,
    heightFactor,
    radius: frontLayer
      ? THREE.MathUtils.randFloat(3.2, 8.4)
      : THREE.MathUtils.randFloat(5.3, 11),
    theta: Math.random() * Math.PI * 2,
    thetaSpeed:
      THREE.MathUtils.randFloat(0.2, 0.64) * (Math.random() < 0.5 ? -1 : 1),
    radialAmp: THREE.MathUtils.randFloat(0.08, 0.34),
    radialFreq: THREE.MathUtils.randFloat(0.6, 1.7),
    orbitBand: frontLayer
      ? THREE.MathUtils.randFloat(-1.05, 1.05)
      : THREE.MathUtils.randFloat(-0.84, 0.84),
    verticalAmp: frontLayer
      ? THREE.MathUtils.randFloat(0.04, 0.26)
      : THREE.MathUtils.randFloat(0.03, 0.18),
    verticalFreq: THREE.MathUtils.randFloat(0.7, 1.7),
    phase: Math.random() * Math.PI * 2,
    globalSpin: frontLayer
      ? THREE.MathUtils.randFloat(0.76, 1.2)
      : THREE.MathUtils.randFloat(0.62, 0.98),
    cardTilt: THREE.MathUtils.randFloat(-0.14, 0.14),
    cardTiltSpeed: THREE.MathUtils.randFloat(0.4, 1.05),
    index,
  };

  sprite.scale.set(baseScale * widthFactor, baseScale * heightFactor, 1);
  memoryGroup.add(sprite);
  sprites.push(sprite);
};

/** Generate a four-point star texture for sparkle particles */
const createSparkleTexture = () => {
  const size = 192;
  const canvasElement = document.createElement("canvas");
  canvasElement.width = size;
  canvasElement.height = size;
  const context2d = canvasElement.getContext("2d");

  const gradient = context2d.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.25, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.5, "rgba(255,210,246,0.45)");
  gradient.addColorStop(1, "rgba(255,210,246,0)");
  context2d.fillStyle = gradient;
  context2d.fillRect(0, 0, size, size);

  context2d.strokeStyle = "rgba(255,255,255,0.65)";
  context2d.lineWidth = 2;
  context2d.beginPath();
  context2d.moveTo(size / 2, size * 0.16);
  context2d.lineTo(size / 2, size * 0.84);
  context2d.moveTo(size * 0.16, size / 2);
  context2d.lineTo(size * 0.84, size / 2);
  context2d.stroke();

  const generatedTexture = new THREE.CanvasTexture(canvasElement);
  generatedTexture.needsUpdate = true;
  return generatedTexture;
};

/** Create the floating sparkle particles that orbit the scene */
const createSparkles = () => {
  const texture = createSparkleTexture();
  const sparkleColors = [0xffffff, 0xffd8f8, 0xcfe0ff];
  const count = 180;

  for (let i = 0; i < count; i++) {
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: sparkleColors[Math.floor(Math.random() * sparkleColors.length)],
      transparent: true,
      opacity: THREE.MathUtils.randFloat(0.18, 0.74),
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const sparkle = new THREE.Sprite(material);
    const baseScale = THREE.MathUtils.randFloat(0.05, 0.16);

    sparkle.userData = {
      baseScale,
      radius: THREE.MathUtils.randFloat(2.4, 11.4),
      theta: Math.random() * Math.PI * 2,
      thetaSpeed:
        THREE.MathUtils.randFloat(0.15, 0.52) * (Math.random() < 0.5 ? -1 : 1),
      orbitBand: THREE.MathUtils.randFloat(-1.35, 1.35),
      verticalAmp: THREE.MathUtils.randFloat(0.02, 0.15),
      verticalFreq: THREE.MathUtils.randFloat(0.9, 2.1),
      pulseFreq: THREE.MathUtils.randFloat(1.2, 3.2),
      phase: Math.random() * Math.PI * 2,
    };

    sparkle.scale.set(baseScale, baseScale, 1);
    sparkles.push(sparkle);
    sparkleGroup.add(sparkle);
  }
};

createSparkles();

/** Load every texture, update progress, then build the orbiting memory sprites */
const createMemoryCloud = async () => {
  updateLoading(10, "Manifest", "Reading image list...");
  const imageFiles = await fetchImageFileList();

  const targetCount = Math.min(148, Math.max(72, imageFiles.length * 3));
  const selections = Array.from(
    { length: targetCount },
    (_, i) => imageFiles[i % imageFiles.length],
  );

  updateLoading(18, "Texture", `Loading images 0/${selections.length}`);
  let loaded = 0;

  const results = await Promise.all(
    selections.map(async (fileName) => {
      const texture = await loadTexture(fileName);
      loaded += 1;
      const progress = 18 + (loaded / selections.length) * 72;
      updateLoading(
        progress,
        "Texture",
        `Loading images ${loaded}/${selections.length}`,
      );
      return { fileName, texture };
    }),
  );

  results.forEach(({ fileName, texture }, index) => {
    if (!texture) {
      return;
    }
    createMemorySprite(texture, fileName, index);
  });

  updateLoading(96, "Compose", "Arranging orbit...");
  setTimeout(() => {
    finishLoading();
  }, 180);
};

// ===== Image preview modal =====

/** Show or hide the preview and enable or disable orbit controls accordingly */
const setPreviewVisible = (visible) => {
  preview.classList.toggle("visible", visible);
  controls.enabled = !visible;
  if (visible) {
    canvas.style.cursor = "default";
    return;
  }
  canvas.style.cursor = "grab";
};

/** Open the fullscreen preview for the given image */
const openPreview = (fileName) => {
  if (!fileName) {
    return;
  }
  previewImage.src = `images/${fileName}`;
  previewTitle.textContent = fileName;
  setPreviewVisible(true);
};

/** Close the preview and clear its content */
const closePreview = () => {
  setPreviewVisible(false);
  previewImage.removeAttribute("src");
  previewTitle.textContent = "";
};

// Close the preview via the button, a backdrop click or the Escape key
previewClose.addEventListener("click", closePreview);
preview.addEventListener("click", (event) => {
  if (event.target === preview) {
    closePreview();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && preview.classList.contains("visible")) {
    closePreview();
  }
});

// ===== Pointer interaction =====

/** Return the sprite under the pointer, or null if nothing is hit */
const getSpriteHit = (event) => {
  if (sprites.length === 0 || preview.classList.contains("visible")) {
    return null;
  }

  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const intersections = raycaster.intersectObjects(sprites, false);
  return intersections.length > 0 ? intersections[0].object : null;
};

// Track pointer movement to tell a click apart from a drag
let pointerStart = null;
let isDragging = false;

canvas.addEventListener("pointerdown", (event) => {
  pointerStart = { x: event.clientX, y: event.clientY };
  isDragging = false;
  if (!preview.classList.contains("visible")) {
    canvas.style.cursor = "grabbing";
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (pointerStart !== null) {
    const dragDistance = Math.hypot(
      event.clientX - pointerStart.x,
      event.clientY - pointerStart.y,
    );
    if (dragDistance > 6) {
      isDragging = true;
    }
  }

  if (preview.classList.contains("visible") || isDragging) {
    return;
  }

  const hitSprite = getSpriteHit(event);
  canvas.style.cursor = hitSprite ? "pointer" : "grab";
});

window.addEventListener("pointerup", (event) => {
  if (preview.classList.contains("visible")) {
    pointerStart = null;
    isDragging = false;
    return;
  }

  if (isDragging || pointerStart === null) {
    pointerStart = null;
    isDragging = false;
    canvas.style.cursor = "grab";
    return;
  }

  const hitSprite = getSpriteHit(event);
  pointerStart = null;
  isDragging = false;

  if (!hitSprite) {
    canvas.style.cursor = "grab";
    return;
  }
  openPreview(hitSprite.userData.fileName);
});

canvas.addEventListener("pointerleave", () => {
  if (!preview.classList.contains("visible")) {
    canvas.style.cursor = "grab";
  }
});

canvas.addEventListener("pointercancel", () => {
  pointerStart = null;
  isDragging = false;
  if (!preview.classList.contains("visible")) {
    canvas.style.cursor = "grab";
  }
});

// ===== Resize handling =====
window.addEventListener("resize", () => {
  viewportSize.width = window.innerWidth;
  viewportSize.height = window.innerHeight;

  camera.aspect = viewportSize.width / viewportSize.height;
  camera.updateProjectionMatrix();

  renderer.setSize(viewportSize.width, viewportSize.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// ===== Animation loop =====

const clock = new THREE.Clock();
let elapsedTime = 0;

// Speed multiplier for the floating memory images (1 = original speed, lower = slower and easier to click)
const MEMORY_SPEED_FACTOR = 0.35;
// Separate clock for the memory images so their whole motion slows down consistently
let memoryTime = 0;

/** Per-frame update: rotate the core, move sprites and sparkles, then render */
const animate = () => {
  const deltaTime = clock.getDelta();
  elapsedTime += deltaTime;
  const memoryDelta = deltaTime * MEMORY_SPEED_FACTOR;
  memoryTime += memoryDelta;

  coreGroup.rotation.y += deltaTime * 0.24;
  sphere.rotation.y += deltaTime * 0.16;
  sphere.rotation.x += deltaTime * 0.07;

  ringPrimary.rotation.z += deltaTime * 0.29;
  ringSecondary.rotation.z -= deltaTime * 0.2;

  const glowPulse = 1 + Math.sin(elapsedTime * 1.55) * 0.07;
  glow.scale.set(4.35 * glowPulse, 4.35 * glowPulse, 1);
  glow.material.opacity = 0.68 + Math.sin(elapsedTime * 2.15) * 0.1;

  memoryGroup.rotation.y += memoryDelta * 0.048;
  sparkleGroup.rotation.y -= deltaTime * 0.04;

  // Orbit each memory sprite and scale it by its distance to the camera
  for (let i = 0; i < sprites.length; i++) {
    const sprite = sprites[i];
    const data = sprite.userData;

    data.theta += data.thetaSpeed * memoryDelta;
    const theta = data.theta + memoryTime * 0.115 * data.globalSpin;
    const radius =
      data.radius +
      Math.sin(memoryTime * data.radialFreq + data.phase) * data.radialAmp;

    tempVector.x = Math.cos(theta) * radius;
    tempVector.z = Math.sin(theta) * radius;
    tempVector.y =
      data.orbitBand +
      Math.sin(memoryTime * data.verticalFreq + data.phase) * data.verticalAmp +
      Math.sin(theta * 1.5 + data.phase) * 0.12;
    sprite.position.copy(tempVector);

    const distanceToCamera = camera.position.distanceTo(sprite.position);
    const depth = THREE.MathUtils.clamp(8.4 / distanceToCamera, 0.54, 1.82);
    const breathe = 1 + Math.sin(memoryTime * 1.3 + data.phase) * 0.035;
    const scale = data.baseScale * depth * breathe;

    // Width and height share the same factor pair, so the original image ratio is preserved
    sprite.scale.set(scale * data.widthFactor, scale * data.heightFactor, 1);
    sprite.material.rotation =
      data.cardTilt +
      Math.sin(memoryTime * data.cardTiltSpeed + data.phase) * 0.05;
    sprite.material.opacity = THREE.MathUtils.clamp(
      0.28 + depth * 0.75,
      0.26,
      0.96,
    );
  }

  // Orbit and pulse each sparkle
  for (let i = 0; i < sparkles.length; i++) {
    const sparkle = sparkles[i];
    const data = sparkle.userData;

    data.theta += data.thetaSpeed * deltaTime;
    const theta = data.theta + elapsedTime * 0.08;
    const radius = data.radius + Math.sin(elapsedTime * 0.9 + data.phase) * 0.1;
    const y =
      data.orbitBand +
      Math.sin(elapsedTime * data.verticalFreq + data.phase) * data.verticalAmp;

    sparkle.position.set(Math.cos(theta) * radius, y, Math.sin(theta) * radius);

    const pulse = 1 + Math.sin(elapsedTime * data.pulseFreq + data.phase) * 0.4;
    const scale = data.baseScale * pulse;
    sparkle.scale.set(scale, scale, 1);
    sparkle.material.opacity = THREE.MathUtils.clamp(
      0.12 + pulse * 0.42,
      0.12,
      0.86,
    );
  }

  stars.material.opacity = 0.82 + Math.sin(elapsedTime * 0.85) * 0.08;

  controls.update();
  renderer.render(scene, camera);
  window.requestAnimationFrame(animate);
};

// ===== Background music =====
// Browsers block autoplay with sound, so we try once and fall back to the first user interaction.
bgMusic.volume = 0.6;
let musicWanted = true; // false once the user turns the music off manually

const syncMusicButton = () => {
  const isPlaying = !bgMusic.paused;
  musicToggle.classList.toggle("playing", isPlaying);
  musicToggle.classList.toggle("muted", !isPlaying);
};

const startMusic = () => {
  if (!musicWanted || !bgMusic.paused) {
    return Promise.resolve();
  }
  return bgMusic
    .play()
    .then(syncMusicButton)
    .catch(() => {
      syncMusicButton();
    });
};

const unlockEvents = ["pointerdown", "touchend", "keydown"];
const unlockMusic = () => {
  startMusic().then(() => {
    if (!bgMusic.paused) {
      unlockEvents.forEach((name) =>
        window.removeEventListener(name, unlockMusic),
      );
    }
  });
};
unlockEvents.forEach((name) => window.addEventListener(name, unlockMusic));

// Manual on/off button
musicToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  if (bgMusic.paused) {
    musicWanted = true;
    bgMusic.play().then(syncMusicButton).catch(syncMusicButton);
  } else {
    musicWanted = false;
    bgMusic.pause();
    syncMusicButton();
  }
});
// pointerdown on the button must not trigger the generic unlock before the click handler decides
musicToggle.addEventListener("pointerdown", (event) => event.stopPropagation());
musicToggle.addEventListener("touchend", (event) => event.stopPropagation());

// Pause when the tab is hidden, resume when it comes back (only if the user did not mute)
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    bgMusic.pause();
  } else if (musicWanted) {
    bgMusic.play().catch(() => {});
  }
  syncMusicButton();
});

syncMusicButton();
startMusic(); // works if the browser allows autoplay, otherwise waits for the first tap/click

// ===== Start =====
createMemoryCloud();
animate();
