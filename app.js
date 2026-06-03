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
const skipCameraButton = document.getElementById("skipCameraButton");
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
const renderCanvas = document.getElementById("renderCanvas");
const bgm = document.getElementById("bgm");

const FRAME_SRC = "./assets/result-frame.png?v=20260603-homecrt";
const GUIDE_SRCS = [
  "./assets/slot-guide-1.png?v=20260603-homecrt",
  "./assets/slot-guide-2.png?v=20260603-homecrt",
  "./assets/slot-guide-3.png?v=20260603-homecrt",
  "./assets/slot-guide-4.png?v=20260603-homecrt",
];

const FRAME_WIDTH = 1920;
const FRAME_HEIGHT = 1080;
const SLOT_RECTS = [
  { x: 207, y: 33, width: 743, height: 501 },
  { x: 969, y: 33, width: 743, height: 501 },
  { x: 207, y: 551, width: 743, height: 501 },
  { x: 969, y: 551, width: 743, height: 501 },
];

const state = {
  photos: [],
  stream: null,
  isCapturing: false,
  drag: null,
  finalDataUrl: "",
  selectedSticker: null,
};

const stickerAssets = {
  butterfly: "./assets/sticker-butterfly.png?v=20260603-homecrt",
  ribbon: "./assets/sticker-ribbon.png?v=20260603-homecrt",
  starline: "./assets/sticker-starline.png?v=20260603-homecrt",
  star: "./assets/sticker-star.png?v=20260603-homecrt",
  nami: "./assets/sticker-nami.png?v=20260603-homecrt",
  kawaii: "./assets/sticker-kawaii.png?v=20260603-homecrt",
};

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("is-active"));
  screens[name].classList.add("is-active");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  updateCaptureUi();

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false,
    });
    video.srcObject = state.stream;
    cameraFallback.classList.add("is-hidden");
    captureButton.disabled = false;
  } catch (error) {
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

function renderFramePreview(container) {
  if (!container) return;
  container.querySelectorAll(".result-guide-overlay").forEach((overlay) => overlay.remove());
  SLOT_RECTS.forEach((_, index) => {
    const slot = container.querySelector(`.slot-${index + 1}`);
    if (!slot) return;
    slot.innerHTML = "";
    slot.classList.toggle("is-active", index === state.photos.length && state.photos.length < 4);
    if (!state.photos[index]) return;
    const image = document.createElement("img");
    image.src = state.photos[index];
    image.alt = `Photo ${index + 1}`;
    image.style.zIndex = 5;
    slot.append(image);

    const guide = document.createElement("img");
    guide.className = `result-guide-overlay slot-${index + 1}`;
    guide.src = GUIDE_SRCS[index];
    guide.alt = "";
    guide.setAttribute("aria-hidden", "true");
    container.append(guide);
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
    const guide = await loadImage(GUIDE_SRCS[index]);
    const canvas = document.createElement("canvas");
    canvas.width = guide.naturalWidth;
    canvas.height = guide.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(guide, 0, 0);
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

async function composeBaseResult() {
  const ctx = renderCanvas.getContext("2d");
  renderCanvas.width = FRAME_WIDTH;
  renderCanvas.height = FRAME_HEIGHT;
  const frame = await loadImage(FRAME_SRC);
  ctx.clearRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  ctx.drawImage(frame, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);

  const images = await Promise.all(state.photos.map(loadImage));
  images.forEach((image, index) => {
    const rect = SLOT_RECTS[index];
    drawCoverImage(ctx, image, rect.x, rect.y, rect.width, rect.height);
  });

  const guides = await Promise.all(GUIDE_SRCS.map(loadImage));
  guides.forEach((guide, index) => {
    const rect = SLOT_RECTS[index];
    drawCoverImage(ctx, guide, rect.x, rect.y, rect.width, rect.height);
  });

  state.finalDataUrl = renderCanvas.toDataURL("image/png");
  return state.finalDataUrl;
}

async function openResult() {
  renderFramePreview(finalPreview);
  try {
    finalImage.src = await composeBaseResult();
  } catch (error) {
    console.error("Failed to build final image", error);
    finalImage.removeAttribute("src");
  }
  showScreen("result");
}

function openEditor() {
  renderFramePreview(photoStrip);
  photoStrip.querySelectorAll(".sticker").forEach((sticker) => sticker.remove());
  state.selectedSticker = null;
  showScreen("editor");
}

function createSticker(type) {
  const sticker = document.createElement("button");
  sticker.type = "button";
  sticker.className = `sticker sticker--${type}`;
  sticker.dataset.type = type;
  sticker.dataset.src = stickerAssets[type];
  sticker.dataset.rotation = String(Number(stickerRotate?.value || 0));
  sticker.setAttribute("aria-label", "Draggable sticker");
  sticker.innerHTML = `<img src="${stickerAssets[type]}" alt="">`;
  const base = photoStrip.getBoundingClientRect();
  const size = Number(stickerSize?.value || 110);
  sticker.style.width = `${size}px`;
  sticker.style.height = `${size}px`;
  sticker.style.left = `${base.width * 0.54}px`;
  sticker.style.top = `${base.height * 0.12}px`;
  updateStickerTransform(sticker);
  photoStrip.append(sticker);
  selectSticker(sticker);
}

function updateStickerTransform(sticker) {
  const rotation = Number(sticker.dataset.rotation || 0);
  sticker.style.transform = `rotate(${rotation}deg)`;
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
  state.selectedSticker.remove();
  state.selectedSticker = null;
  if (deleteStickerButton) deleteStickerButton.disabled = true;
}

function returnHome() {
  stopCamera();
  state.photos = [];
  state.finalDataUrl = "";
  state.selectedSticker = null;
  state.drag = null;
  finalImage.removeAttribute("src");
  [capturePreview, finalPreview, photoStrip].forEach((preview) => {
    preview?.querySelectorAll(".result-preview__photo").forEach((slot) => {
      slot.innerHTML = "";
      slot.classList.remove("is-active");
    });
    preview?.querySelectorAll(".result-guide-overlay, .sticker").forEach((item) => item.remove());
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
}

function endDrag() {
  state.drag = null;
}

async function drawSticker(ctx, sticker, scaleX, scaleY) {
  const image = await loadImage(sticker.dataset.src);
  const x = parseFloat(sticker.style.left) * scaleX;
  const y = parseFloat(sticker.style.top) * scaleY;
  const width = sticker.offsetWidth * scaleX;
  const height = sticker.offsetHeight * scaleY;
  const rotation = Number(sticker.dataset.rotation || 0) * Math.PI / 180;
  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(rotation);
  ctx.drawImage(image, -width / 2, -height / 2, width, height);
  ctx.restore();
}

async function saveImage(includeStickers = false) {
  if (!ensureDevServer()) return;

  const filename = `namikura-${Date.now()}.png`;
  const saveTarget = await createSaveTarget(filename);
  if (!saveTarget) return;

  try {
    await composeBaseResult();
    if (includeStickers) {
      const ctx = renderCanvas.getContext("2d");
      const stripRect = photoStrip.getBoundingClientRect();
      const scaleX = FRAME_WIDTH / stripRect.width;
      const scaleY = FRAME_HEIGHT / stripRect.height;
      for (const sticker of photoStrip.querySelectorAll(".sticker")) {
        await drawSticker(ctx, sticker, scaleX, scaleY);
      }
    }

    const blob = await canvasToBlob(renderCanvas);
    await saveTarget(blob);
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

  return async (blob) => {
    if (!blob || blob.size === 0) throw new Error("PNG save image is empty.");
    const link = document.createElement("a");
    link.download = filename;
    link.href = renderCanvas.toDataURL("image/png");
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
skipCameraButton.addEventListener("click", createSamplePhotos);
retakeButton.addEventListener("click", startCamera);
decorateButton.addEventListener("click", openEditor);
backToResultButton.addEventListener("click", () => showScreen("result"));
savePreviewButton.addEventListener("click", () => saveImage(false));
saveButton.addEventListener("click", () => saveImage(true));
stickerTray.addEventListener("click", (event) => {
  const button = event.target.closest("[data-sticker]");
  if (button) createSticker(button.dataset.sticker);
});
stickerSize?.addEventListener("input", () => {
  if (!state.selectedSticker) return;
  const size = Number(stickerSize.value);
  state.selectedSticker.style.width = `${size}px`;
  state.selectedSticker.style.height = `${size}px`;
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

function spawnCursorSparkle(event) {
  const sparkle = document.createElement("span");
  sparkle.className = "cursor-sparkle";
  sparkle.style.left = `${event.clientX}px`;
  sparkle.style.top = `${event.clientY}px`;
  document.body.append(sparkle);
  setTimeout(() => sparkle.remove(), 720);
}
