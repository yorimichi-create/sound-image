// ==============================
// Sound Image
// app.js
// ==============================

const imageInput = document.getElementById("imageInput");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const micButton = document.getElementById("micButton");
const volumeDisplay =
  document.getElementById("volumeDisplay");

const modeTabs =
  document.querySelectorAll(".mode-tab");

let currentMode = "A";

// ==============================
// Canvas
// ==============================

const edgeCanvas =
  document.createElement("canvas");

const edgeCtx =
  edgeCanvas.getContext("2d");

let image = new Image();

let imageLoaded = false;
let edgeReady = false;

// ==============================
// 音声
// ==============================

let audioContext = null;
let analyser = null;
let microphoneSource = null;
let microphoneStream = null;

let micStarted = false;
let animationId = null;

let currentVolume = 0;

// 波の時間
let waveTime = 0;


// ==============================
// モード切り替え
// ==============================

modeTabs.forEach(function (tab) {

  tab.addEventListener("click", function () {

    currentMode =
      tab.dataset.mode;

    modeTabs.forEach(function (item) {
      item.classList.remove("active");
    });

    tab.classList.add("active");
  });

});


// ==============================
// 画像読み込み
// ==============================

imageInput.addEventListener(
  "change",
  function (event) {

    const file =
      event.target.files[0];

    if (!file) {
      return;
    }

    const url =
      URL.createObjectURL(file);

    image.onload = function () {

      URL.revokeObjectURL(url);

      const maxSize = 1200;

      let width =
        image.naturalWidth;

      let height =
        image.naturalHeight;

      if (!width || !height) {
        return;
      }

      if (
        width > maxSize ||
        height > maxSize
      ) {

        const scale =
          Math.min(
            maxSize / width,
            maxSize / height
          );

        width =
          Math.floor(width * scale);

        height =
          Math.floor(height * scale);
      }

      canvas.width = width;
      canvas.height = height;

      edgeCanvas.width = width;
      edgeCanvas.height = height;

      createEdgeImage(
        width,
        height
      );

      imageLoaded = true;
      edgeReady = true;

      draw();
    };

    image.onerror = function () {

      URL.revokeObjectURL(url);

      alert(
        "画像を読み込めませんでした。"
      );
    };

    image.src = url;
  }
);


// ==============================
// 輪郭画像作成
// ==============================

function createEdgeImage(
  width,
  height
) {

  const tempCanvas =
    document.createElement("canvas");

  tempCanvas.width = width;
  tempCanvas.height = height;

  const tempCtx =
    tempCanvas.getContext("2d");

  tempCtx.drawImage(
    image,
    0,
    0,
    width,
    height
  );

  let source;

  try {

    source =
      tempCtx.getImageData(
        0,
        0,
        width,
        height
      );

  } catch (error) {

    alert(
      "画像を処理できませんでした。"
    );

    return;
  }

  const src = source.data;

  const output =
    edgeCtx.createImageData(
      width,
      height
    );

  const dst = output.data;

  // ==========================
  // エッジ検出
  // ==========================

  for (
    let y = 1;
    y < height - 1;
    y++
  ) {

    for (
      let x = 1;
      x < width - 1;
      x++
    ) {

      const currentIndex =
        (y * width + x) * 4;

      const leftIndex =
        (y * width + x - 1) * 4;

      const rightIndex =
        (y * width + x + 1) * 4;

      const topIndex =
        ((y - 1) * width + x) * 4;

      const bottomIndex =
        ((y + 1) * width + x) * 4;

      const left =
        getBrightness(
          src,
          leftIndex
        );

      const right =
        getBrightness(
          src,
          rightIndex
        );

      const top =
        getBrightness(
          src,
          topIndex
        );

      const bottom =
        getBrightness(
          src,
          bottomIndex
        );

      const horizontal =
        Math.abs(left - right);

      const vertical =
        Math.abs(top - bottom);

      const difference =
        Math.sqrt(
          horizontal * horizontal +
          vertical * vertical
        );

      const threshold = 30;

      let value = 0;

      if (
        difference >
        threshold
      ) {

        value =
          Math.min(
            255,
            difference * 3
          );
      }

      dst[currentIndex] =
        255;

      dst[currentIndex + 1] =
        255;

      dst[currentIndex + 2] =
        255;

      dst[currentIndex + 3] =
        value;
    }
  }

  edgeCtx.putImageData(
    output,
    0,
    0
  );
}


// ==============================
// 明るさ
// ==============================

function getBrightness(
  data,
  index
) {

  return (
    data[index] +
    data[index + 1] +
    data[index + 2]
  ) / 3;
}


// ==============================
// マイクボタン
// ==============================

micButton.addEventListener(
  "click",
  async function () {

    if (micStarted) {

      stopMicrophone();

      return;
    }

    await startMicrophone();
  }
);


// ==============================
// マイク開始
// ==============================

async function startMicrophone() {

  try {

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {

      alert(
        "このブラウザではマイク機能を使用できません。"
      );

      return;
    }

    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContextClass) {

      alert(
        "このブラウザでは音声解析を使用できません。"
      );

      return;
    }

    audioContext =
      new AudioContextClass();

    await audioContext.resume();

    microphoneStream =
      await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

    analyser =
      audioContext.createAnalyser();

    analyser.fftSize = 1024;

    analyser.smoothingTimeConstant =
      0.5;

    microphoneSource =
      audioContext.createMediaStreamSource(
        microphoneStream
      );

    microphoneSource.connect(
      analyser
    );

    micStarted = true;

    micButton.textContent =
      "マイクを停止";

    if (!animationId) {
      animate();
    }

  } catch (error) {

    console.error(
      "マイク開始エラー:",
      error
    );

    alert(
      "マイクを使用できませんでした。"
    );
  }
}


// ==============================
// マイク停止
// ==============================

function stopMicrophone() {

  if (microphoneSource) {

    try {
      microphoneSource.disconnect();
    } catch (error) {}
  }

  if (microphoneStream) {

    microphoneStream
      .getTracks()
      .forEach(function (track) {
        track.stop();
      });
  }

  if (audioContext) {

    audioContext
      .close()
      .catch(function () {});
  }

  microphoneSource = null;
  microphoneStream = null;
  analyser = null;
  audioContext = null;

  micStarted = false;

  currentVolume = 0;

  micButton.textContent =
    "マイクを開始";
}


// ==============================
// 音量取得
// ==============================

function getVolume() {

  if (!analyser) {
    return 0;
  }

  const data =
    new Uint8Array(
      analyser.frequencyBinCount
    );

  analyser.getByteFrequencyData(
    data
  );

  let sum = 0;

  for (
    let i = 0;
    i < data.length;
    i++
  ) {

    sum += data[i];
  }

  const average =
    sum / data.length;

  const volume =
    Math.min(
      1,
      average / 8
    );

  return volume;
}


// ==============================
// 描画
// ==============================

function draw() {

  if (
    !imageLoaded ||
    !edgeReady
  ) {
    return;
  }

  const width =
    canvas.width;

  const height =
    canvas.height;

  const volume =
    getVolume();

  if (volumeDisplay) {

    volumeDisplay.textContent =
      "VOLUME " +
      Math.round(volume * 100);
  }

  // 音量を滑らかにする
  currentVolume =
    currentVolume * 0.5 +
    volume * 0.5;

  // 波を進める
  waveTime +=
    0.04 +
    currentVolume * 0.15;

  // ==========================
  // 背景
  // ==========================

  ctx.clearRect(
    0,
    0,
    width,
    height
  );

  ctx.fillStyle =
    "#050505";

  ctx.fillRect(
    0,
    0,
    width,
    height
  );

  // ==========================
  // モード
  // ==========================

  if (currentMode === "A") {

    drawModeA(
      width,
      height,
      currentVolume
    );

  } else if (currentMode === "B") {

    drawModeB(
      width,
      height,
      currentVolume
    );

  } else if (currentMode === "C") {

    drawModeC(
      width,
      height,
      currentVolume
    );
  }
}


// ==============================
// A
// そのまま線が膨らむ
// ==============================

function drawModeA(
  width,
  height,
  volume
) {

  const scale =
    1 + volume * 0.28;

  const drawWidth =
    width * scale;

  const drawHeight =
    height * scale;

  const drawX =
    (width - drawWidth) / 2;

  const drawY =
    (height - drawHeight) / 2;

  drawGlow(
    drawX,
    drawY,
    drawWidth,
    drawHeight,
    volume
  );

  ctx.drawImage(
    edgeCanvas,
    drawX,
    drawY,
    drawWidth,
    drawHeight
  );
}


// ==============================
// B
// ギザギザに変形
// ==============================

function drawModeB(
  width,
  height,
  volume
) {

  const scale =
    1 + volume * 0.18;

  const drawWidth =
    width * scale;

  const drawHeight =
    height * scale;

  const drawX =
    (width - drawWidth) / 2;

  const drawY =
    (height - drawHeight) / 2;

  const slices = 100;

  const sliceHeight =
    drawHeight / slices;

  for (
    let i = 0;
    i < slices;
    i++
  ) {

    const normalized =
      i / slices;

    // ギザギザ
    const zigzag =
      Math.sin(
        normalized *
        Math.PI *
        24
      );

    // 音量で強さを変える
    const amount =
      zigzag *
      volume *
      35;

    // 少しランダム感を追加
    const jitter =
      Math.sin(
        i * 17.3 +
        waveTime * 5
      ) *
      volume *
      8;

    const offset =
      amount +
      jitter;

    ctx.drawImage(

      edgeCanvas,

      0,
      normalized *
        edgeCanvas.height,

      edgeCanvas.width,
      sliceHeight /
        scale,

      drawX + offset,
      drawY +
        normalized *
        drawHeight,

      drawWidth,
      sliceHeight
    );
  }
}


// ==============================
// C
// 優しく外側へ広がる波
// ==============================

function drawModeC(
  width,
  height,
  volume
) {

  ctx.save();

  // Canvasの中だけに描画
  ctx.beginPath();

  ctx.rect(
    0,
    0,
    width,
    height
  );

  ctx.clip();


  // ==========================
  // 元の輪郭
  // ==========================

  const baseScale =
    1 + volume * 0.12;

  const baseWidth =
    width * baseScale;

  const baseHeight =
    height * baseScale;

  const baseX =
    (width - baseWidth) / 2;

  const baseY =
    (height - baseHeight) / 2;


  // 元の輪郭は普通に表示
  ctx.save();

  ctx.globalAlpha = 1;

  ctx.globalCompositeOperation =
    "source-over";

  ctx.filter = "none";

  ctx.drawImage(
    edgeCanvas,
    baseX,
    baseY,
    baseWidth,
    baseHeight
  );

  ctx.restore();


  // ==========================
  // 波
  // ==========================

  if (volume > 0.015) {

    const waveCount = 7;

    for (
      let i = 0;
      i < waveCount;
      i++
    ) {

      // それぞれの波が少しずつ時間差で出る
      let progress =
        (
          waveTime * 0.22 +
          i / waveCount
        ) % 1;


      // 最初はゆっくり、
      // 中盤から自然に広がる
      const eased =
        progress * progress *
        (3 - 2 * progress);


      // Canvas全体へ向かって広がる
      const expansion =
        eased *
        (
          0.15 +
          volume * 1.15
        );


      const scale =
        baseScale +
        expansion;


      const waveWidth =
        width * scale;

      const waveHeight =
        height * scale;


      const waveX =
        (width - waveWidth) / 2;

      const waveY =
        (height - waveHeight) / 2;


      // --------------------------
      // 波の透明度
      // --------------------------

      // 出始め → 少し見える
      // 中盤 → 一番見える
      // 外側 → ゆっくり消える

      const fadeIn =
        Math.min(
          1,
          progress * 8
        );

      const fadeOut =
        1 - Math.pow(
          progress,
          2.2
        );

      const alpha =
        fadeIn *
        fadeOut *
        volume *
        0.42;


      if (alpha <= 0) {
        continue;
      }


      // --------------------------
      // 波を描く
      // --------------------------

      ctx.save();

      ctx.globalAlpha =
        alpha;

      ctx.globalCompositeOperation =
        "screen";

      // ブラーは使わない
      ctx.filter = "none";

      ctx.drawImage(
        edgeCanvas,
        waveX,
        waveY,
        waveWidth,
        waveHeight
      );

      ctx.restore();
    }
  }


  ctx.restore();
}


// ==============================
// 発光
// ==============================

function drawGlow(
  x,
  y,
  width,
  height,
  volume
) {

  if (volume < 0.01) {
    return;
  }

  ctx.save();

  ctx.globalCompositeOperation =
    "screen";

  ctx.globalAlpha =
    0.25 +
    volume * 0.55;

  ctx.filter =
    `blur(${3 + volume * 18}px)`;

  ctx.drawImage(
    edgeCanvas,
    x,
    y,
    width,
    height
  );

  ctx.restore();
}


// ==============================
// アニメーション
// ==============================

function animate() {

  animationId =
    requestAnimationFrame(
      animate
    );

  draw();
}


// ==============================
// 初期Canvas
// ==============================

canvas.width = 800;
canvas.height = 500;

ctx.fillStyle =
  "#050505";

ctx.fillRect(
  0,
  0,
  canvas.width,
  canvas.height
);