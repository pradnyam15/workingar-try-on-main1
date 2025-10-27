const $ = (s) => document.querySelector(s);
const apiKeyInput = $('#apiKey');
const personInput = $('#personImage');
const promptInput = $('#prompt');
const generateBtn = $('#generateBtn');
const downloadBtn = $('#downloadBtn');
const statusEl = $('#status');
const errorEl = $('#error');
const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
const refImgEl = document.getElementById('refImg');

let lastOutputDataUrl = '';

function setStatus(msg) {
  statusEl.textContent = msg || '';
}

function setError(msg) {
  errorEl.textContent = msg || '';
}

function toDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function drawImageToCanvas(img) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const maxW = 1024;
  const scale = Math.min(1, maxW / w);
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  canvas.width = cw;
  canvas.height = ch;
  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(img, 0, 0, cw, ch);
}

async function previewLocal(file) {
  const dataUrl = await toDataURL(file);
  const img = new Image();
  img.onload = () => drawImageToCanvas(img);
  img.src = dataUrl;
}

personInput.addEventListener('change', async () => {
  setError('');
  if (personInput.files && personInput.files[0]) {
    await previewLocal(personInput.files[0]);
  }
});

downloadBtn.addEventListener('click', () => {
  if (!lastOutputDataUrl) return;
  const a = document.createElement('a');
  a.href = lastOutputDataUrl;
  a.download = 'campaign.jpg';
  document.body.appendChild(a);
  a.click();
  a.remove();
});

async function postJson(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    let text = await res.text();
    throw new Error(text || ('HTTP ' + res.status));
  }
  if (contentType.includes('application/json')) {
    return await res.json();
  }
  return await res.text();
}

function getImageBase64FromCanvas() {
  return canvas.toDataURL('image/jpeg', 0.95);
}

function extractBase64(dataUrl) {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

function buildPrompt(userPrompt) {
  const base = 'Create a high-end fashion campaign portrait in regal Mughal-era style.' +
    ' Preserve the person\'s identity, skin tone, and facial structure.' +
    ' Apply styling and aesthetic inspired by the reference jewelry image: ornate, luxurious, refined lighting, editorial composition, premium color grading.' +
    ' 8k, photorealistic, studio quality.';
  if (!userPrompt || !userPrompt.trim()) return base;
  return userPrompt.trim();
}

async function handleGenerate() {
  try {
    setError('');
    downloadBtn.disabled = true;
    if (!personInput.files || !personInput.files[0]) {
      setError('Please upload a person image.');
      return;
    }
    setStatus('Preparing image...');
    await previewLocal(personInput.files[0]);

    const personDataUrl = getImageBase64FromCanvas();
    const personBase64 = extractBase64(personDataUrl);

    const refUrl = refImgEl.getAttribute('src');
    const prompt = buildPrompt(promptInput.value);

    setStatus('Calling backend...');
    const res = await postJson('/api/campaign-generate', {
      prompt,
      refImageUrl: refUrl,
      imageBase64: personBase64
    });

    if (!res || !res.imageBase64) {
      throw new Error('No image returned from backend.');
    }

    lastOutputDataUrl = 'data:image/jpeg;base64,' + res.imageBase64;
    const outImg = new Image();
    await new Promise((resolve) => {
      outImg.onload = resolve;
      outImg.src = lastOutputDataUrl;
    });
    drawImageToCanvas(outImg);
    downloadBtn.disabled = false;
    setStatus('Done');
  } catch (err) {
    setStatus('');
    setError(String(err.message || err));
  }
}

generateBtn.addEventListener('click', () => {
  handleGenerate();
});
