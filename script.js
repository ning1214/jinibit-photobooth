
const home = document.getElementById("home");
const studio = document.getElementById("studio");
const result = document.getElementById("result");
const savePreview = document.getElementById("savePreview");
const saveHint = document.getElementById("saveHint");

const startBtn = document.getElementById("startBtn");
const captureBtn = document.getElementById("captureBtn");
const retakeBtn = document.getElementById("retakeBtn");
const saveBtn = document.getElementById("saveBtn");
const restartBtn = document.getElementById("restartBtn");

const video = document.getElementById("camera");
const uploadedPreview =
  document.getElementById("uploadedPreview");
const uploadInput =
  document.getElementById("uploadInput");

const overlay = document.getElementById("overlay");
const overlayCtx = overlay.getContext("2d");

const resultCanvas =
  document.getElementById("resultCanvas");
const resultCtx = resultCanvas.getContext("2d");

const photoTitle =
  document.getElementById("photoTitle");
const statusText =
  document.getElementById("status");

// 四格在原始 1200 x 1600 畫布上的位置
const areas = [
  { x: 83, y: 81, w: 498, h: 539 },
  { x: 622, y: 83, w: 495, h: 537 },
  { x: 83, y: 660, w: 496, h: 540 },
  { x: 620, y: 658, w: 500, h: 544 }
];

let currentPhoto = 0;
let photos = [null, null, null, null];
let cameraStream = null;
let uploadedImage = null;
let busy = false;

// 載入圖片
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const assetsReady = Promise.all([
  loadImage("assets/characters.png"),
  loadImage("assets/frame.png")
]);

let characters;
let frame;

assetsReady.then(([charImg, frameImg]) => {
  characters = charImg;
  frame = frameImg;
}).catch(error => {
  console.error("圖片載入失敗：", error);
});

// 讓照片填滿指定區域，不拉伸變形
function drawCover(ctx, source, width, height) {
  const sw = source.videoWidth || source.naturalWidth
    || source.width;
  const sh = source.videoHeight || source.naturalHeight
    || source.height;

  if (!sw || !sh) {
    throw new Error("照片尚未準備完成");
  }

  const scale = Math.max(width / sw, height / sh);
  const cropW = width / scale;
  const cropH = height / scale;
  const sx = (sw - cropW) / 2;
  const sy = (sh - cropH) / 2;

  ctx.drawImage(
    source,
    sx, sy, cropW, cropH,
    0, 0, width, height
  );
}

// 製作單格照片

function makePhoto(source) {

  const area = areas[currentPhoto];

  const canvas = document.createElement("canvas");

  canvas.width = area.w;
  canvas.height = area.h;

  const ctx = canvas.getContext("2d");

  // 只有相機拍攝時才鏡像翻轉
  if (source === video) {

    ctx.save();

    // 將畫面左右翻轉
    ctx.translate(area.w, 0);
    ctx.scale(-1, 1);

    drawCover(ctx, source, area.w, area.h);

    ctx.restore();

  } else {

    // 上傳照片不翻轉
    drawCover(ctx, source, area.w, area.h);

  }

  return canvas;
}


// 顯示目前這一格的 SKZOO
function updateOverlay() {
  const area = areas[currentPhoto];

  overlay.width = area.w;
  overlay.height = area.h;

  overlayCtx.clearRect(
    0, 0, area.w, area.h
  );

  overlayCtx.drawImage(
    characters,
    area.x, area.y, area.w, area.h,
    0, 0, area.w, area.h
  );

  document.querySelector(".camera-box").style.aspectRatio =
    `${area.w} / ${area.h}`;

  photoTitle.textContent =
    `PHOTO ${currentPhoto + 1} / 4`;
}

// 顯示拍攝畫面
function showStudio() {
  home.classList.add("hidden");
  result.classList.add("hidden");
  studio.classList.remove("hidden");
}

// 顯示目前照片來源

function showSource() {

  if (cameraStream) {
    video.classList.remove("hidden");
    uploadedPreview.classList.add("hidden");
  } else {
    video.classList.add("hidden");
    uploadedPreview.classList.add("hidden");
  }

  // 拍照按鈕永遠顯示
  captureBtn.classList.remove("hidden");
}

// 開始拍貼
startBtn.onclick = async function () {
  try {
    await assetsReady;

    currentPhoto = 0;
    photos = [null, null, null, null];
    uploadedImage = null;

    showStudio();
    updateOverlay();
    showSource();

    statusText.textContent =
    "按拍照開啟相機，或直接上傳照片 ♡";
  } catch (error) {
    alert("插畫載入失敗，請檢查 assets 資料夾。");
  }
};

// 拍完一張後自動前往下一格
async function finishPhoto(photoCanvas) {
  photos[currentPhoto] = photoCanvas;

  if (currentPhoto === 3) {
    await generateResult();
    return;
  }

  currentPhoto++;
  uploadedImage = null;
  uploadedPreview.removeAttribute("src");

  updateOverlay();
  showSource();

  statusText.textContent =
    `完成！現在拍第 ${currentPhoto + 1} 張 ♡`;
}

// 使用相機拍照

// 使用相機拍照
captureBtn.onclick = async function () {

  if (busy) return;
  busy = true;

  try {

    // 第一次按拍照：先開啟相機
    if (!cameraStream) {

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("此瀏覽器不支援相機");
      }

      cameraStream =
        await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false
        });

      video.srcObject = cameraStream;
      await video.play();

      showSource();

      statusText.textContent =
        "相機已開啟！再按一次拍照 ♡";

      return;
    }

    // 相機已開啟：真正拍照
    if (video.readyState < 2) {
      statusText.textContent =
        "相機準備中，請稍等一下 ♡";
      return;
    }

    const photo = makePhoto(video);

    await finishPhoto(photo);

  } catch (error) {

    console.error(error);

    statusText.textContent =
      "無法開啟相機，請檢查權限或改用上傳照片。";

  } finally {
    busy = false;
  }

};


// 從手機或電腦上傳照片
uploadInput.onchange = async function () {
  const file = uploadInput.files[0];
  if (!file || busy) return;

  busy = true;

  try {
    if (!file.type.startsWith("image/")) {
      throw new Error("請選擇圖片檔案");
    }

    const url = URL.createObjectURL(file);

    try {
      uploadedImage = await loadImage(url);

      // 顯示照片和 SKZOO 的疊圖預覽
      uploadedPreview.src = url;
      uploadedPreview.classList.remove("hidden");
      video.classList.add("hidden");

      const photo = makePhoto(uploadedImage);
      await finishPhoto(photo);
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error(error);
    statusText.textContent =
      "照片上傳失敗，請換一張圖片試試。";
  } finally {
    uploadInput.value = "";
    busy = false;
  }
};

// 重拍：回到前一格
retakeBtn.onclick = function () {
  if (busy) return;

  if (currentPhoto > 0 && !photos[currentPhoto]) {
    currentPhoto--;
  }

  photos[currentPhoto] = null;
  uploadedImage = null;

  updateOverlay();
  showSource();

  statusText.textContent =
    `重新拍攝第 ${currentPhoto + 1} 張 ♡`;
};

// 合成最後的四格拍貼
async function generateResult() {
  await assetsReady;

  resultCanvas.width = frame.naturalWidth;
  resultCanvas.height = frame.naturalHeight;

  resultCtx.clearRect(
    0, 0,
    resultCanvas.width,
    resultCanvas.height
  );

  // 先放四張照片
  photos.forEach((photo, i) => {
    const a = areas[i];

    resultCtx.drawImage(
      photo,
      a.x, a.y, a.w, a.h
    );
  });

  // 疊上 SKZOO
  resultCtx.drawImage(characters, 0, 0);

  // 最上層是完整相框
  resultCtx.drawImage(frame, 0, 0);

  studio.classList.add("hidden");
  result.classList.remove("hidden");

  // 完成後關閉相機，避免繼續占用鏡頭
  stopCamera();
}

// 停止相機
function stopCamera() {
  if (!cameraStream) return;

  cameraStream.getTracks().forEach(track => track.stop());
  cameraStream = null;
  video.srcObject = null;
}

// 下載 PNG

 // 下載 PNG

saveBtn.onclick = async function () {

  try {

    // 將合成照片轉成 PNG
    const blob = await new Promise((resolve, reject) => {
      resultCanvas.toBlob(
        result => result
          ? resolve(result)
          : reject(new Error("PNG 產生失敗")),
        "image/png"
      );
    });

    // 建立真正的圖片網址
    const imageURL = URL.createObjectURL(blob);

    // 顯示可以長按儲存的圖片
    savePreview.src = imageURL;
    savePreview.classList.remove("hidden");
    saveHint.classList.remove("hidden");

    // 隱藏原本的 canvas，避免出現兩張照片
    resultCanvas.classList.add("hidden");

    // 電腦仍然可以直接下載
    const link = document.createElement("a");
    link.href = imageURL;
    link.download = "SKZOO-RUN-IT.png";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (error) {

    console.error("儲存失敗：", error);
    alert("照片產生失敗，請再試一次。");

  }

};


// 重新開始
restartBtn.onclick = function () {
  stopCamera();

  currentPhoto = 0;
  photos = [null, null, null, null];
  uploadedImage = null;

  result.classList.add("hidden");
  studio.classList.add("hidden");
  home.classList.remove("hidden");
};

// 離開頁面時關閉相機
window.addEventListener("pagehide", stopCamera);
