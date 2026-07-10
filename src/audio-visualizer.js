const audioContextState = {
  context: null,
};

const bufferCache = new Map();
const imageCache = new Map();

function getAudioContext() {
  if (!audioContextState.context) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContextState.context = new AudioContextClass();
  }
  return audioContextState.context;
}

async function loadAudioBuffer(url) {
  const key = encodeURI(url);
  if (bufferCache.has(key)) return bufferCache.get(key);

  const response = await fetch(key);
  if (!response.ok) {
    throw new Error(`Failed to load audio: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await getAudioContext().decodeAudioData(arrayBuffer.slice(0));
  bufferCache.set(key, audioBuffer);
  return audioBuffer;
}

function setupCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.floor(rect.width || canvas.parentElement?.clientWidth || 760));
  const height = Math.max(120, Math.floor(rect.height || 150));
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width, height };
}

function drawEmpty(ctx, width, height, message) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#64748b';
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(message, width / 2, height / 2);
}

export async function renderWaveform(canvas, url) {
  const { ctx, width, height } = setupCanvas(canvas);
  drawEmpty(ctx, width, height, 'Loading waveform...');

  const cacheKey = `waveform:${url}:${width}:${height}`;
  if (imageCache.has(cacheKey)) {
    ctx.drawImage(imageCache.get(cacheKey), 0, 0, width, height);
    return;
  }

  const audioBuffer = await loadAudioBuffer(url);
  const data = audioBuffer.getChannelData(0);
  const middle = height / 2;
  const amp = height * 0.42;
  const samplesPerPixel = Math.max(1, Math.floor(data.length / width));

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, middle);
  ctx.lineTo(width, middle);
  ctx.stroke();

  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  for (let x = 0; x < width; x += 1) {
    const start = x * samplesPerPixel;
    const end = Math.min(start + samplesPerPixel, data.length);
    let min = 1;
    let max = -1;
    for (let i = start; i < end; i += 1) {
      const value = data[i];
      if (value < min) min = value;
      if (value > max) max = value;
    }
    ctx.moveTo(x + 0.5, middle + min * amp);
    ctx.lineTo(x + 0.5, middle + max * amp);
  }
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${audioBuffer.duration.toFixed(2)} s`, 10, height - 10);

  const bitmap = await createImageBitmap(canvas);
  imageCache.set(cacheKey, bitmap);
}

function hannWindow(size) {
  const win = new Float32Array(size);
  for (let i = 0; i < size; i += 1) {
    win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  return win;
}

function fftRealMagnitudes(input) {
  const n = input.length;
  const real = new Float32Array(input);
  const imag = new Float32Array(n);

  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = real[i];
      real[i] = real[j];
      real[j] = tr;
      const ti = imag[i];
      imag[i] = imag[j];
      imag[j] = ti;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wLenReal = Math.cos(angle);
    const wLenImag = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let wReal = 1;
      let wImag = 0;
      for (let j = 0; j < len / 2; j += 1) {
        const uReal = real[i + j];
        const uImag = imag[i + j];
        const vReal = real[i + j + len / 2] * wReal - imag[i + j + len / 2] * wImag;
        const vImag = real[i + j + len / 2] * wImag + imag[i + j + len / 2] * wReal;
        real[i + j] = uReal + vReal;
        imag[i + j] = uImag + vImag;
        real[i + j + len / 2] = uReal - vReal;
        imag[i + j + len / 2] = uImag - vImag;
        const nextReal = wReal * wLenReal - wImag * wLenImag;
        wImag = wReal * wLenImag + wImag * wLenReal;
        wReal = nextReal;
      }
    }
  }

  const bins = n / 2;
  const magnitudes = new Float32Array(bins);
  for (let i = 0; i < bins; i += 1) {
    magnitudes[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
  }
  return magnitudes;
}

function colorMap(value) {
  const v = Math.max(0, Math.min(1, value));
  const r = Math.floor(20 + 235 * Math.min(1, v * 1.6));
  const g = Math.floor(26 + 180 * Math.max(0, Math.min(1, (v - 0.18) * 1.5)));
  const b = Math.floor(55 + 120 * Math.max(0, Math.min(1, 1 - v * 1.2)));
  return [r, g, b];
}

export async function renderSpectrogram(canvas, url) {
  const { ctx, width, height } = setupCanvas(canvas);
  drawEmpty(ctx, width, height, 'Computing spectrogram...');

  const cacheKey = `spectrogram-high-top-8k:${url}:${width}:${height}`;
  if (imageCache.has(cacheKey)) {
    ctx.drawImage(imageCache.get(cacheKey), 0, 0, width, height);
    return;
  }

  const audioBuffer = await loadAudioBuffer(url);
  const data = audioBuffer.getChannelData(0);
  const fftSize = 1024;
  const hopSize = 256;
  const nyquist = audioBuffer.sampleRate / 2;
  const maxFrequency = Math.min(8000, nyquist);
  const maxBin = Math.max(1, Math.min(fftSize / 2, Math.floor((maxFrequency / nyquist) * (fftSize / 2))));
  const frames = Math.max(1, Math.ceil(Math.max(1, data.length - fftSize) / hopSize) + 1);
  const windowValues = hannWindow(fftSize);
  const frame = new Float32Array(fftSize);
  const image = ctx.createImageData(width, height);
  const frameCache = [];
  let globalMin = Infinity;
  let globalMax = -Infinity;

  for (let f = 0; f < frames; f += 1) {
    const offset = f * hopSize;
    for (let i = 0; i < fftSize; i += 1) {
      frame[i] = (data[offset + i] || 0) * windowValues[i];
    }
    const mags = fftRealMagnitudes(frame);
    const db = new Float32Array(maxBin);
    for (let i = 0; i < maxBin; i += 1) {
      const value = 20 * Math.log10(mags[i] + 1e-8);
      db[i] = value;
      if (value < globalMin) globalMin = value;
      if (value > globalMax) globalMax = value;
    }
    frameCache.push(db);
  }

  const floor = Math.max(globalMin, globalMax - 70);
  const range = Math.max(1, globalMax - floor);
  for (let x = 0; x < width; x += 1) {
    const frameIndex = Math.min(frames - 1, Math.floor((x / width) * frames));
    const db = frameCache[frameIndex];
    for (let y = 0; y < height; y += 1) {
      const bin = Math.min(db.length - 1, Math.floor(((height - 1 - y) / height) * db.length));
      const normalized = (db[bin] - floor) / range;
      const [r, g, b] = colorMap(normalized);
      const idx = (y * width + x) * 4;
      image.data[idx] = r;
      image.data[idx + 1] = g;
      image.data[idx + 2] = b;
      image.data[idx + 3] = 255;
    }
  }

  const spectrogramCanvas = document.createElement('canvas');
  spectrogramCanvas.width = width;
  spectrogramCanvas.height = height;
  spectrogramCanvas.getContext('2d').putImageData(image, 0, 0);

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(spectrogramCanvas, 0, 0, width, height);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
  ctx.fillRect(8, 8, 118, 23);
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Spectrogram', 16, 24);

  const bitmap = await createImageBitmap(canvas);
  imageCache.set(cacheKey, bitmap);
}

export function clearVisualization(canvas) {
  const { ctx, width, height } = setupCanvas(canvas);
  drawEmpty(ctx, width, height, 'Select Waveform or Spectrogram');
}
