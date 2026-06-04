const screens = {
  onboarding: document.getElementById("onboarding"),
  booth: document.getElementById("booth"),
  result: document.getElementById("result"),
  editor: document.getElementById("editor"),
};

const startApp = document.getElementById("startApp");
const video = document.getElementById("video");
const slotGuide = document.getElementById("slotGuide");
const cameraFallback = document.getElementById("cameraFallback");
const countdown = document.getElementById("countdown");
const captureButton = document.getElementById("captureButton");
const retakeButton = document.getElementById("retakeButton");
const decorateButton = document.getElementById("decorateButton");
const backToResultButton = document.getElementById("backToResultButton");
const savePreviewButton = document.getElementById("savePreviewButton");
const saveButton = document.getElementById("saveButton");
const stickerSize = document.getElementById("stickerSize");
const stickerRotate = document.getElementById("stickerRotate");
const deleteStickerButton = document.getElementById("deleteStickerButton");
const homeButton = document.getElementById("homeButton");
const shotLabel = document.getElementById("shotLabel");
const capturePreview = document.getElementById("capturePreview");
const finalPreview = document.getElementById("finalPreview");
const photoStrip = document.getElementById("photoStrip");
const stickerTray = document.getElementById("stickerTray");
const finalImage = document.getElementById("finalImage");
const bgm = document.getElementById("bgm");

const FRAME_SRC = "./assets/result-frame.png?v=20260604-clipfix";
const GUIDE_SRCS = [
  "./assets/slot-guide-1.png?v=20260604-clipfix",
  "./assets/slot-guide-2.png?v=20260604-clipfix",
  "./assets/slot-guide-3.png?v=20260604-clipfix",
  "./assets/slot-guide-4.png?v=20260604-clipfix",
];
const CELEBRITY_SRCS = [
  "./assets/slot-guide-1-cutout.png?v=20260604-single-render",
  "./assets/slot-guide-2-cutout.png?v=20260604-single-render",
  "./assets/slot-guide-3-cutout.png?v=20260604-single-render",
  "./assets/slot-guide-4-cutout.png?v=20260604-single-render",
];

const HADURI_FILTER = "brightness(1.2) contrast(1.34) saturate(1.14) blur(0.55px)";

let CANVAS_WIDTH = 1920;
let CANVAS_HEIGHT = 1080;
let DESIGN_WIDTH = 1920;
let DESIGN_HEIGHT = 1080;

const BASE_CANVAS_WIDTH = 1920;
const BASE_CANVAS_HEIGHT = 1080;
const BASE_PHOTO_SLOTS = [
  { x: 207, y: 33, width: 743, height: 501 },
  { x: 969, y: 33, width: 743, height: 501 },
  { x: 207, y: 551, width: 743, height: 501 },
  { x: 969, y: 551, width: 743, height: 501 },
];
let photoSlots = BASE_PHOTO_SLOTS.map((slot) => ({ ...slot }));

const state = {
  photos: [],
  stream: null,
  isCapturing: false,
  drag: null,
  finalDataUrl: "",
  selectedSticker: null,
  stickers: [],
};

const stickerAssets = {
  butterfly: "./assets/sticker-butterfly.png?v=20260604-clipfix",
  ribbon: "./assets/sticker-ribbon.png?v=20260604-clipfix",
  starline: "./assets/sticker-starline.png?v=20260604-clipfix",
  star: "./assets/sticker-star.png?v=20260604-clipfix",
  nami: "./assets/sticker-nami.png?v=20260604-clipfix",
  kawaii: "./assets/sticker-kawaii.png?v=20260604-clipfix",
};

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("is-active"));
  screens[name].classList.add("is-active");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function syncFrameMetrics(frameImage) {
  DESIGN_WIDTH = frameImage.naturalWidth || BASE_CANVAS_WIDTH;
  DESIGN_HEIGHT = frameImage.naturalHeight || BASE_CANVAS_HEIGHT;
  CANVAS_WIDTH = DESIGN_WIDTH;
  CANVAS_HEIGHT = DESIGN_HEIGHT;
  const scaleX = DESIGN_WIDTH / BASE_CANVAS_WIDTH;
  const scaleY = DESIGN_HEIGHT / BASE_CANVAS_HEIGHT;
  photoSlots = BASE_PHOTO_SLOTS.map((slot) => ({
    x: slot.x * scaleX,
    y: slot.y * scaleY,
    w: slot.width * scaleX,
    h: slot.height * scaleY,
  }));
}

function playBgm() {
  if (!bgm) return;
  bgm.volume = 0.62;
  bgm.play().catch(() => {
    document.addEventListener("pointerdown", playBgm, { once: true });
    document.addEventListener("keydown", playBgm, { once: true });
  });
}

function normalizeImageSrc(src) {
  if (typeof src !== "string") return src;
  if (src.startsWith("data:image/")) return src;

  const decoded = decodeURIComponent(src).replace(/\\/g, "/");
  const assetsIndex = decoded.lastIndexOf("/assets/");
  if (assetsIndex !== -1) {
    const assetPath = decoded.slice(assetsIndex + 1).split("?")[0];
    const originalQuery = src.includes("?") ? src.slice(src.indexOf("?")) : "";
    return `./${assetPath}${originalQuery}`;
  }

  return src;
}

function ensureDevServer() {
  if (window.location.protocol !== "file:") return true;
  alert("이 앱은 파일을 더블클릭해서 열면 저장이 막힙니다. 로컬 개발 서버(http://localhost:4173/)에서 실행해 주세요.");
  return false;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const safeSrc = normalizeImageSrc(src);
    if (typeof safeSrc === "string" && safeSrc.startsWith("file://")) {
      reject(new Error(`Canvas export blocked: file URL image is not allowed (${safeSrc})`));
      return;
    }

    const image = new Image();
    image.decoding = "async";
    image.onload = async () => {
      try {
        if (image.decode) await image.decode();
        resolve(image);
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error(`Image failed to load: ${safeSrc}`));
    image.src = safeSrc;
  });
}

async function startCamera() {
  showScreen("booth");
  state.photos = [];
  state.finalDataUrl = "";
  state.stickers = [];
  state.selectedSticker = null;
  cameraFallback.textContent = "Camera is starting...";
  cameraFallback.classList.remove("is-hidden");
  updateCaptureUi();

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera API is not available. Please open this page from http://localhost:4173/ or GitHub Pages.");
    }
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false,
    });
    video.srcObject = state.stream;
    await video.play();
    cameraFallback.classList.add("is-hidden");
    captureButton.disabled = false;
  } catch (error) {
    console.error("Camera start failed", error);
    cameraFallback.textContent = `Camera error: ${error?.message || error?.name || "Please allow camera access."}`;
    cameraFallback.classList.remove("is-hidden");
    captureButton.disabled = true;
  }
}

function stopCamera() {
  if (!state.stream) return;
  state.stream.getTracks().forEach((track) => track.stop());
  state.stream = null;
  video.srcObject = null;
}

function updateCaptureUi() {
  const current = Math.min(state.photos.length, 3);
  shotLabel.textContent = `${Math.min(state.photos.length + 1, 4)} / 4`;
  slotGuide.src = GUIDE_SRCS[current];
  captureButton.textContent = state.isCapturing ? "SHOOTING..." : "START SHOOT";
  captureButton.disabled = state.isCapturing || !state.stream;
  renderFramePreview(capturePreview);
}

function clearPreviewPhotos(container) {
  container?.querySelectorAll(".result-preview__photo").forEach((slot) => {
    slot.innerHTML = "";
    slot.classList.remove("is-active");
  });
}

function renderFramePreview(container) {
  if (!container) return;
  container.classList.remove("has-rendered-image");
  container.querySelectorAll(".rendered-preview-canvas, .rendered-preview-image, .result-guide-overlay").forEach((overlay) => overlay.remove());
  photoSlots.forEach((_, index) => {
    const slot = container.querySelector(`.slot-${index + 1}`);
    if (!slot) return;
    slot.innerHTML = "";
    slot.classList.toggle("is-active", index === state.photos.length && state.photos.length < 4);
    if (state.photos[index]) {
      const image = document.createElement("img");
      image.src = state.photos[index];
      image.alt = `Photo ${index + 1}`;
      image.className = "haduri-preview-photo";
      image.style.zIndex = 5;
      slot.append(image);
    }

    const guide = document.createElement("img");
    guide.className = "slot-person-overlay";
    guide.src = CELEBRITY_SRCS[index];
    guide.onerror = () => {
      guide.onerror = null;
      guide.src = GUIDE_SRCS[index];
    };
    guide.alt = "";
    guide.setAttribute("aria-hidden", "true");
    slot.append(guide);
  });
}

async function runCountdown() {
  countdown.classList.add("is-active");
  for (let number = 3; number > 0; number -= 1) {
    countdown.textContent = number;
    await delay(1000);
  }
  countdown.textContent = "\u30d1\u30b7\u30e3\u30c3\uff01";
  await delay(360);
  countdown.classList.remove("is-active");
}

async function runSafeCountdown() {
  countdown.classList.add("is-active");
  for (let number = 3; number > 0; number -= 1) {
    countdown.textContent = number;
    await delay(1000);
  }
  countdown.textContent = "\u30d1\u30b7\u30e3\u30c3\uff01";
  await delay(360);
  countdown.classList.remove("is-active");
}

function capturePhoto() {
  const canvas = document.createElement("canvas");
  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 960;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.translate(width, 0);
  context.scale(-1, 1);
  context.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}

async function captureSequence() {
  if (state.isCapturing || !state.stream) return;
  state.isCapturing = true;
  updateCaptureUi();

  while (state.photos.length < 4) {
    updateCaptureUi();
    await delay(520);
    await runSafeCountdown();
    state.photos.push(capturePhoto());
    updateCaptureUi();
    await delay(620);
  }

  state.isCapturing = false;
  stopCamera();
  try {
    await openResult();
  } catch (error) {
    console.error("Failed to build result preview", error);
    showScreen("result");
  }
}

async function createSamplePhotos() {
  state.photos = [];
  for (let index = 0; index < 4; index += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = 743;
    canvas.height = 497;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = ["#ffd3ef", "#bdf8ff", "#fff7a8", "#ffc0e4"][index];
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    for (let y = -20; y < canvas.height; y += 36) {
      for (let x = -20; x < canvas.width; x += 36) {
        ctx.fillRect(x, y, 12, 12);
      }
    }
    ctx.fillStyle = "#ff149f";
    ctx.font = "900 86px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`SAMPLE ${index + 1}`, canvas.width / 2, canvas.height / 2);
    state.photos.push(canvas.toDataURL("image/png"));
  }
  stopCamera();
  await openResult();
}

function drawCoverImage(ctx, image, x, y, width, height) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const dx = x + (width - drawWidth) / 2;
  const dy = y + (height - drawHeight) / 2;
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
}

function drawFilteredCoverImage(ctx, image, x, y, width, height) {
  ctx.save();
  ctx.filter = HADURI_FILTER;
  drawCoverImage(ctx, image, x, y, width, height);
  ctx.filter = "none";
  ctx.globalCompositeOperation = "screen";
  const glow = ctx.createRadialGradient(
    x + width * 0.48,
    y + height * 0.28,
    0,
    x + width * 0.48,
    y + height * 0.28,
    width * 0.78
  );
  glow.addColorStop(0, "rgba(255, 255, 255, 0.20)");
  glow.addColorStop(0.46, "rgba(255, 232, 246, 0.11)");
  glow.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, width, height);
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

function renderSlot(ctx, slot, userPhoto, celebrityImage) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(slot.x, slot.y, slot.w, slot.h);
  ctx.clip();
  if (userPhoto) drawFilteredCoverImage(ctx, userPhoto, slot.x, slot.y, slot.w, slot.h);
  if (celebrityImage) drawCoverImage(ctx, celebrityImage, slot.x, slot.y, slot.w, slot.h);
  ctx.restore();
}

async function drawSticker(ctx, stickerState) {
  const image = await loadImage(stickerState.src);
  const width = Number(stickerState.w || 0);
  const height = Number(stickerState.h || 0);
  const rotation = Number(stickerState.rotation || 0) * Math.PI / 180;
  ctx.save();
  ctx.translate(Number(stickerState.x || 0) + width / 2, Number(stickerState.y || 0) + height / 2);
  ctx.rotate(rotation);
  ctx.drawImage(image, -width / 2, -height / 2, width, height);
  ctx.restore();
}

async function createFinalCanvas({ includeStickers = true } = {}) {
  const resultFrame = await loadImage(FRAME_SRC);
  syncFrameMetrics(resultFrame);

  const canvas = document.createElement("canvas");
  canvas.width = DESIGN_WIDTH;
  canvas.height = DESIGN_HEIGHT;
  const ctx = canvas.getContext("2d");

  const [userPhotos, celebrityImages] = await Promise.all([
    Promise.all(state.photos.map(loadImage)),
    Promise.all(CELEBRITY_SRCS.map(loadImage)),
  ]);

  console.log("resultFrame.naturalWidth / naturalHeight", resultFrame.naturalWidth, resultFrame.naturalHeight);
  console.log("exportCanvas.width / height", canvas.width, canvas.height);
  console.log("photoSlots", photoSlots);
  console.log("celebrityImages loaded status", celebrityImages.map((image, index) => ({
    index: index + 1,
    loaded: Boolean(image?.complete && image.naturalWidth),
    width: image?.naturalWidth || 0,
    height: image?.naturalHeight || 0,
  })));

  ctx.clearRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);

  photoSlots.forEach((slot, index) => {
    renderSlot(ctx, slot, userPhotos[index], celebrityImages[index]);
  });

  ctx.drawImage(resultFrame, 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);

  if (includeStickers) {
    for (const sticker of state.stickers) {
      await drawSticker(ctx, sticker);
    }
  }

  return canvas;
}

function mountPreviewCanvas(container, canvas) {
  if (!container || !canvas) return;
  clearPreviewPhotos(container);
  container.classList.add("has-rendered-image");
  container.querySelectorAll(".rendered-preview-canvas, .rendered-preview-image").forEach((item) => item.remove());
  canvas.className = "rendered-preview-canvas";
  canvas.setAttribute("aria-label", "Rendered Namikura photo");
  container.prepend(canvas);
}

async function openResult(includeStickers = false) {
  try {
    const canvas = await createFinalCanvas({ includeStickers });
    mountPreviewCanvas(finalPreview, canvas);
    finalImage.removeAttribute("src");
  } catch (error) {
    console.error("Failed to build result preview", error);
    finalImage.removeAttribute("src");
  }
  showScreen("result");
}

async function openEditor() {
  state.selectedSticker = null;
  photoStrip.querySelectorAll(".sticker").forEach((sticker) => sticker.remove());
  try {
    const canvas = await createFinalCanvas({ includeStickers: false });
    mountPreviewCanvas(photoStrip, canvas);
    state.stickers.forEach((stickerState) => appendStickerDom(stickerState));
  } catch (error) {
    console.error("Failed to build editor photo", error);
  }
  showScreen("editor");
}

function appendStickerDom(stickerState) {
  const sticker = document.createElement("button");
  sticker.type = "button";
  sticker.className = `sticker sticker--${stickerState.type || "image"}`;
  sticker.dataset.id = stickerState.id;
  sticker.dataset.src = stickerState.src;
  sticker.dataset.rotation = String(stickerState.rotation || 0);
  sticker.dataset.canvasX = String(stickerState.x);
  sticker.dataset.canvasY = String(stickerState.y);
  sticker.dataset.canvasWidth = String(stickerState.w);
  sticker.dataset.canvasHeight = String(stickerState.h);
  sticker.setAttribute("aria-label", "Draggable sticker");
  sticker.innerHTML = `<img src="${stickerState.src}" alt="">`;
  applyStickerDomFromCanvas(sticker);
  photoStrip.append(sticker);
  return sticker;
}

async function createSticker(type) {
  const image = await loadImage(stickerAssets[type]);
  const id = `sticker-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const size = Number(stickerSize?.value || 110);
  const aspect = (image.naturalHeight || image.height || 1) / (image.naturalWidth || image.width || 1);
  const previewWidth = size;
  const previewHeight = size * aspect;
  const stickerState = {
    id,
    type,
    src: stickerAssets[type],
    x: DESIGN_WIDTH * 0.54,
    y: DESIGN_HEIGHT * 0.12,
    w: previewToDesignX(previewWidth),
    h: previewToDesignY(previewHeight),
    rotation: Number(stickerRotate?.value || 0),
  };
  state.stickers.push(stickerState);
  selectSticker(appendStickerDom(stickerState));
}

function updateStickerTransform(sticker) {
  const rotation = Number(sticker.dataset.rotation || 0);
  sticker.style.transform = `rotate(${rotation}deg)`;
  const stickerState = state.stickers.find((item) => item.id === sticker.dataset.id);
  if (stickerState) stickerState.rotation = rotation;
}

function designToPreviewX(value) {
  return value * (photoStrip.offsetWidth / DESIGN_WIDTH);
}

function designToPreviewY(value) {
  return value * (photoStrip.offsetHeight / DESIGN_HEIGHT);
}

function previewToDesignX(value) {
  return value * (DESIGN_WIDTH / photoStrip.offsetWidth);
}

function previewToDesignY(value) {
  return value * (DESIGN_HEIGHT / photoStrip.offsetHeight);
}

function applyStickerDomFromCanvas(sticker) {
  sticker.style.left = `${designToPreviewX(Number(sticker.dataset.canvasX || 0))}px`;
  sticker.style.top = `${designToPreviewY(Number(sticker.dataset.canvasY || 0))}px`;
  sticker.style.width = `${designToPreviewX(Number(sticker.dataset.canvasWidth || 140))}px`;
  sticker.style.height = `${designToPreviewY(Number(sticker.dataset.canvasHeight || 140))}px`;
  updateStickerTransform(sticker);
}

function updateStickerCanvasFromDom(sticker) {
  const stickerState = state.stickers.find((item) => item.id === sticker.dataset.id);
  const next = {
    x: previewToDesignX(parseFloat(sticker.style.left) || 0),
    y: previewToDesignY(parseFloat(sticker.style.top) || 0),
    w: previewToDesignX(sticker.offsetWidth || 0),
    h: previewToDesignY(sticker.offsetHeight || 0),
    rotation: Number(sticker.dataset.rotation || 0),
  };
  sticker.dataset.canvasX = String(next.x);
  sticker.dataset.canvasY = String(next.y);
  sticker.dataset.canvasWidth = String(next.w);
  sticker.dataset.canvasHeight = String(next.h);
  if (stickerState) Object.assign(stickerState, next);
}

function selectSticker(sticker) {
  photoStrip.querySelectorAll(".sticker").forEach((item) => item.classList.remove("is-selected"));
  state.selectedSticker = sticker;
  if (deleteStickerButton) deleteStickerButton.disabled = !sticker;
  if (!sticker) return;
  sticker.classList.add("is-selected");
  if (stickerSize) stickerSize.value = Math.round(sticker.offsetWidth);
  if (stickerRotate) stickerRotate.value = Number(sticker.dataset.rotation || 0);
}

function deleteSelectedSticker() {
  if (!state.selectedSticker) return;
  state.stickers = state.stickers.filter((item) => item.id !== state.selectedSticker.dataset.id);
  state.selectedSticker.remove();
  state.selectedSticker = null;
  if (deleteStickerButton) deleteStickerButton.disabled = true;
}

function returnHome() {
  stopCamera();
  state.photos = [];
  state.finalDataUrl = "";
  state.selectedSticker = null;
  state.stickers = [];
  state.drag = null;
  finalImage.removeAttribute("src");
  [capturePreview, finalPreview, photoStrip].forEach((preview) => {
    preview?.classList.remove("has-rendered-image");
    preview?.querySelectorAll(".rendered-preview-canvas, .rendered-preview-image").forEach((image) => image.remove());
    preview?.querySelectorAll(".result-preview__photo").forEach((slot) => {
      slot.innerHTML = "";
      slot.classList.remove("is-active");
    });
    preview?.querySelectorAll(".slot-person-overlay, .sticker").forEach((item) => item.remove());
  });
  if (deleteStickerButton) deleteStickerButton.disabled = true;
  showScreen("onboarding");
}

function startDrag(event) {
  const sticker = event.target.closest(".sticker");
  if (!sticker) return;
  selectSticker(sticker);
  const stripRect = photoStrip.getBoundingClientRect();
  const stickerRect = sticker.getBoundingClientRect();
  state.drag = {
    sticker,
    offsetX: event.clientX - stickerRect.left,
    offsetY: event.clientY - stickerRect.top,
    stripRect,
  };
  sticker.setPointerCapture(event.pointerId);
}

function moveDrag(event) {
  if (!state.drag) return;
  const { sticker, offsetX, offsetY, stripRect } = state.drag;
  const x = event.clientX - stripRect.left - offsetX;
  const y = event.clientY - stripRect.top - offsetY;
  const maxX = stripRect.width - sticker.offsetWidth;
  const maxY = stripRect.height - sticker.offsetHeight;
  sticker.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
  sticker.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
  updateStickerCanvasFromDom(sticker);
}

function endDrag() {
  state.drag = null;
}

async function saveImage(includeStickers = false) {
  if (!ensureDevServer()) return;

  const filename = `namikura-${Date.now()}.png`;
  const saveTarget = await createSaveTarget(filename);
  if (!saveTarget) return;

  try {
    const canvas = await createFinalCanvas({ includeStickers });
    const blob = await canvasToBlob(canvas);
    await saveTarget(blob, canvas);
  } catch (error) {
    console.error("Save failed", error);
    alert("저장 중 오류가 발생했습니다. http://localhost:4173/에서 실행 중인지 확인하고 다시 시도해 주세요.");
  }
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob && blob.size > 0) {
        resolve(blob);
      } else {
        reject(new Error("PNG save image could not be created."));
      }
    }, "image/png");
  });
}

async function createSaveTarget(filename) {
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: "PNG image",
            accept: { "image/png": [".png"] },
          },
        ],
      });
      return async (blob) => {
        const writable = await handle.createWritable();
        const buffer = await blob.arrayBuffer();
        await writable.write({ type: "write", data: buffer });
        await writable.close();
      };
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error("Save picker failed, falling back to download", error);
    }
  }

  return async (blob, canvas) => {
    if (!blob || blob.size === 0) throw new Error("PNG save image is empty.");
    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.style.display = "none";
    document.body.append(link);
    link.click();
    link.remove();
  };
}

startApp.addEventListener("click", () => {
  if (startApp.classList.contains("is-popping")) return;
  startApp.classList.add("is-popping");
  setTimeout(() => {
    startApp.classList.remove("is-popping");
    startCamera();
  }, 520);
});

captureButton.addEventListener("click", captureSequence);
retakeButton.addEventListener("click", startCamera);
decorateButton.addEventListener("click", openEditor);
backToResultButton.addEventListener("click", () => openResult(true));
savePreviewButton.addEventListener("click", () => saveImage(false));
saveButton.addEventListener("click", () => saveImage(true));
stickerTray.addEventListener("click", (event) => {
  const button = event.target.closest("[data-sticker]");
  if (button) createSticker(button.dataset.sticker);
});
stickerSize?.addEventListener("input", () => {
  if (!state.selectedSticker) return;
  const size = Number(stickerSize.value);
  const stickerState = state.stickers.find((item) => item.id === state.selectedSticker.dataset.id);
  const aspect = stickerState?.h && stickerState?.w ? stickerState.h / stickerState.w : 1;
  state.selectedSticker.style.width = `${size}px`;
  state.selectedSticker.style.height = `${size * aspect}px`;
  updateStickerCanvasFromDom(state.selectedSticker);
});
stickerRotate?.addEventListener("input", () => {
  if (!state.selectedSticker) return;
  state.selectedSticker.dataset.rotation = stickerRotate.value;
  updateStickerTransform(state.selectedSticker);
});
deleteStickerButton?.addEventListener("click", deleteSelectedSticker);
homeButton?.addEventListener("click", returnHome);
photoStrip.addEventListener("pointerdown", startDrag);
window.addEventListener("pointermove", moveDrag);
window.addEventListener("pointerup", endDrag);
window.addEventListener("pointermove", spawnCursorSparkle);
window.addEventListener("keydown", (event) => {
  if ((event.key === "Delete" || event.key === "Backspace") && state.selectedSticker) {
    event.preventDefault();
    deleteSelectedSticker();
  }
});
window.addEventListener("DOMContentLoaded", playBgm);
window.addEventListener("load", playBgm);
document.addEventListener("click", spawnButtonSpark);

function spawnCursorSparkle(event) {
  const sparkle = document.createElement("span");
  sparkle.className = "cursor-sparkle";
  sparkle.style.left = `${event.clientX}px`;
  sparkle.style.top = `${event.clientY}px`;
  document.body.append(sparkle);
  setTimeout(() => sparkle.remove(), 720);
}

function spawnButtonSpark(event) {
  const button = event.target.closest("button");
  if (!button || button.disabled) return;
  const burst = document.createElement("span");
  burst.className = "button-spark-burst";
  burst.style.left = `${event.clientX}px`;
  burst.style.top = `${event.clientY}px`;
  document.body.append(burst);
  setTimeout(() => burst.remove(), 760);
}
