
// ==============================
// Sound Image
// app.js
// ==============================

const imageInput = document.getElementById("imageInput");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const micButton = document.getElementById("micButton");
const volumeDisplay = document.getElementById("volumeDisplay");

// オフスクリーンCanvas
// 輪郭画像を保存しておくために使用
const edgeCanvas = document.createElement("canvas");
const edgeCtx = edgeCanvas.getContext("2d");

let image = new Image();

let imageLoaded = false;
let edgeReady = false;

// 音声関連
let audioContext = null;
let analyser = null;
let microphoneSource = null;
let microphoneStream = null;

let micStarted = false;
let animationId = null;

// 現在の音量
let currentVolume = 0;

// ==============================
// 画像読み込み
// ==============================

imageInput.addEventListener("change", function (event) {
  const file = event.target.files[0];

  if (!file) {
    return;
  }

  const url = URL.createObjectURL(file);

  image.onload = function () {
    URL.revokeObjectURL(url);

    // 大きすぎる画像を縮小
    const maxSize = 1200;

    let width = image.naturalWidth;
    let height = image.naturalHeight;

    if (!width || !height) {
      console.error("画像サイズを取得できませんでした。");
      return;
    }

    if (width > maxSize || height > maxSize) {
      const scale = Math.min(
        maxSize / width,
        maxSize / height
      );

      width = Math.floor(width * scale);
      height = Math.floor(height * scale);
    }

    // Canvasサイズ設定
    canvas.width = width;
    canvas.height = height;

    edgeCanvas.width = width;
    edgeCanvas.height = height;

    // 輪郭を作成
    createEdgeImage(width, height);

    imageLoaded = true;
    edgeReady = true;

    draw();
  };

  image.onerror = function () {
    URL.revokeObjectURL(url);

    console.error("画像を読み込めませんでした。");

    alert("画像を読み込めませんでした。");
  };

  image.src = url;
});


// ==============================
// 輪郭画像を作成
// ==============================

function createEdgeImage(width, height) {
  // 元画像を一時Canvasへ描画
  const tempCanvas = document.createElement("canvas");

  tempCanvas.width = width;
  tempCanvas.height = height;

  const tempCtx = tempCanvas.getContext("2d");

  tempCtx.drawImage(
    image,
    0,
    0,
    width,
    height
  );

  // ピクセルデータ取得
  let source;

  try {
    source = tempCtx.getImageData(
      0,
      0,
      width,
      height
    );
  } catch (error) {
    console.error(
      "画像データを取得できませんでした:",
      error
    );

    alert(
      "画像を処理できませんでした。別の画像で試してください。"
    );

    return;
  }

  const src = source.data;

  const output = edgeCtx.createImageData(
    width,
    height
  );

  const dst = output.data;

  // ==========================
  // 簡易エッジ検出
  // ==========================

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {

      const currentIndex =
        (y * width + x) * 4;

      const leftIndex =
        (y * width + (x - 1)) * 4;

      const rightIndex =
        (y * width + (x + 1)) * 4;

      const topIndex =
        ((y - 1) * width + x) * 4;

      const bottomIndex =
        ((y + 1) * width + x) * 4;


      const leftBrightness =
        getBrightness(
          src,
          leftIndex
        );

      const rightBrightness =
        getBrightness(
          src,
          rightIndex
        );

      const topBrightness =
        getBrightness(
          src,
          topIndex
        );

      const bottomBrightness =
        getBrightness(
          src,
          bottomIndex
        );


      const horizontal =
        Math.abs(
          leftBrightness -
          rightBrightness
        );

      const vertical =
        Math.abs(
          topBrightness -
          bottomBrightness
        );


      const difference =
        Math.sqrt(
          horizontal * horizontal +
          vertical * vertical
        );


      // 輪郭の強さ
      const threshold = 30;

      let value = 0;

      if (difference > threshold) {
        value = Math.min(
          255,
          difference * 3
        );
      }


      dst[currentIndex] = value;
      dst[currentIndex + 1] = value;
      dst[currentIndex + 2] = value;
      dst[currentIndex + 3] = 255;
    }
  }

  // 外周を黒くする
  for (let x = 0; x < width; x++) {
    setPixel(dst, width, x, 0, 0, 0, 0, 255);
    setPixel(
      dst,
      width,
      x,
      height - 1,
      0,
      0,
      0,
      255
    );
  }

  for (let y = 0; y < height; y++) {
    setPixel(dst, width, 0, y, 0, 0, 0, 255);

    setPixel(
      dst,
      width,
      width - 1,
      y,
      0,
      0,
      0,
      255
    );
  }

  // 輪郭画像を保存
  edgeCtx.putImageData(
    output,
    0,
    0
  );
}


// ==============================
// 明るさを取得
// ==============================

function getBrightness(data, index) {
  return (
    data[index] +
    data[index + 1] +
    data[index + 2]
  ) / 3;
}


// ==============================
// ピクセル設定
// ==============================

function setPixel(
  data,
  width,
  x,
  y,
  r,
  g,
  b,
  a
) {
  const index =
    (y * width + x) * 4;

  data[index] = r;
  data[index + 1] = g;
  data[index + 2] = b;
  data[index + 3] = a;
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

    // ブラウザ対応チェック
    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      alert(
        "このブラウザではマイク機能を使用できません。"
      );
      return;
    }

    // AudioContextを先に作る
    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContextClass) {
      alert(
        "このブラウザでは音声解析を使用できません。"
      );
      return;
    }

    audioContext = new AudioContextClass();

    // ユーザー操作直後にAudioContextを開始
    await audioContext.resume();

    // マイク取得
    microphoneStream =
      await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

    // Analyser
    analyser =
      audioContext.createAnalyser();

    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.5;

    // マイク → Analyser
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

    // アニメーション開始
    if (!animationId) {
      animate();
    }

    console.log("マイク開始");
    console.log("AudioContext:", audioContext.state);

  } catch (error) {

    console.error(
      "マイク開始エラー:",
      error
    );

    if (microphoneStream) {
      microphoneStream
        .getTracks()
        .forEach(function (track) {
          track.stop();
        });
    }

    if (audioContext) {
      audioContext.close().catch(
        function () {}
      );
    }

    microphoneStream = null;
    microphoneSource = null;
    analyser = null;
    audioContext = null;

    alert(
      "マイクを使用できませんでした。\n\n" +
      "ブラウザのマイク許可を確認してください。"
    );
  }
}


// ==============================
// マイク停止
// ==============================

function stopMicrophone() {

  // マイク入力を切断
  if (microphoneSource) {
    try {
      microphoneSource.disconnect();
    } catch (error) {
      console.warn(error);
    }
  }


  // マイクのトラックを停止
  if (microphoneStream) {

    microphoneStream
      .getTracks()
      .forEach(function (track) {
        track.stop();
      });
  }


  // AudioContext停止
  if (audioContext) {

    audioContext.close().catch(
      function (error) {
        console.warn(error);
      }
    );
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

  const data = new Uint8Array(
    analyser.frequencyBinCount
  );

  analyser.getByteFrequencyData(data);

  let sum = 0;

  for (let i = 0; i < data.length; i++) {
    sum += data[i];
  }

  const average = sum / data.length;

  // 小さな音も分かりやすく反応させる
  const volume = Math.min(
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


  const width = canvas.width;
  const height = canvas.height;


  // 音量
  const volume = getVolume();

  if (volumeDisplay) {
    volumeDisplay.textContent =
    "VOLUME " + Math.round(volume * 100);
  }


  // なめらかにする
  currentVolume =
    currentVolume * 0.5 +
    volume * 0.5;


  // 音量に応じた拡大
  const scale =
    1 + currentVolume * 0.08;


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
  // 輪郭を拡大して描画
  // ==========================

  const drawWidth =
    width * scale;

  const drawHeight =
    height * scale;

  const drawX =
    (width - drawWidth) / 2;

  const drawY =
    (height - drawHeight) / 2;


  // ==========================
  // 発光
  // ==========================

  if (currentVolume > 0.01) {

    ctx.save();

    ctx.globalCompositeOperation =
      "screen";

    ctx.globalAlpha =
      0.25 + currentVolume * 0.5;

    ctx.filter =
      `blur(${2 + currentVolume * 10}px)`;


    ctx.drawImage(
      edgeCanvas,
      drawX,
      drawY,
      drawWidth,
      drawHeight
    );


    ctx.restore();
  }


  // ==========================
  // メインの輪郭
  // ==========================

  ctx.save();

  ctx.globalAlpha = 1;

  ctx.filter = "none";

  ctx.globalCompositeOperation =
    "source-over";


  ctx.drawImage(
    edgeCanvas,
    drawX,
    drawY,
    drawWidth,
    drawHeight
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
