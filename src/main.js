// AR Ring Try-On - main logic

const video = document.getElementById('videoElement');
const canvas = document.getElementById('outputCanvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const loadingEl = document.getElementById('loading');
const sizeSlider = document.getElementById('sizeSlider');
const sizeValue = document.getElementById('sizeValue');
const modeButtons = Array.from(document.querySelectorAll('.mode-btn'));
const glassesButtons = Array.from(document.querySelectorAll('.glasses-btn'));
const controlsEl = document.getElementById('controls');
const toggleBtn = document.getElementById('toggleControls');
const hamburgerBtn = document.getElementById('hamburgerBtn');

// Mobile controls bottom-sheet behavior
function isMobile() {
  return window.matchMedia('(max-width: 768px)').matches;
}

function applyControlsResponsiveState() {
  if (!controlsEl) return;
  if (isMobile()) {
    // Mobile: use left drawer with hamburger, hide old bottom-sheet toggle
    if (toggleBtn) toggleBtn.style.display = 'none';
    if (hamburgerBtn) hamburgerBtn.style.display = 'block';
    controlsEl.classList.remove('collapsed');
    controlsEl.classList.remove('open'); // start closed
  } else {
    // Desktop/tablet: show panel statically on the left
    if (toggleBtn) toggleBtn.style.display = 'none';
    if (hamburgerBtn) hamburgerBtn.style.display = 'none';
    controlsEl.classList.remove('collapsed');
    controlsEl.classList.remove('open');
  }
}

// New mobile hamburger drawer toggle
if (hamburgerBtn && controlsEl) {
  hamburgerBtn.addEventListener('click', () => {
    if (!isMobile()) return;
    controlsEl.classList.toggle('open');
  });
}

// Close drawer after selecting a menu item on mobile
document.addEventListener('click', (e) => {
  if (!isMobile() || !controlsEl) return;
  if (!controlsEl.classList.contains('open')) return;
  if (e.target.closest('.mode-btn') || e.target.closest('.item-btn')) {
    controlsEl.classList.remove('open');
  }
});

// Re-evaluate on resize and on load
window.addEventListener('resize', applyControlsResponsiveState);
applyControlsResponsiveState();

let sizeScalePct = 100;

let currentColor = 'diamond-ring-1707837';
let currentMode = 'rings'; // 'rings' | 'sunglasses'
let currentGlasses = 'aviators-105130';

// Color palettes for procedural ring rendering
const metalColors = {
  gold:   { base: '#d4af37', shadow: '#8e7724', highlight: '#fff6d0' },
  silver: { base: '#c0c0c0', shadow: '#7c7c7c', highlight: '#f5f5f5' },
  rose:   { base: '#b76e79', shadow: '#7a4750', highlight: '#ffd6df' }
};

// External PNG ring images (distinct per option)
const RINGS = {
  'diamond-ring-1707837': 'https://pub-e46fd816b4ee497fb2f639f180c4df20.r2.dev/pngfind.com-diamond-ring-png-1707837.png',
  'loose-diamonds-2037252': 'https://pub-e46fd816b4ee497fb2f639f180c4df20.r2.dev/pngfind.com-loose-diamonds-png-2037252.png',
  'laurel-leaf-6893709': 'https://pub-e46fd816b4ee497fb2f639f180c4df20.r2.dev/pngfind.com-laurel-leaf-png-6893709.png'
};
const ringImgs = Object.fromEntries(Object.keys(RINGS).map(k => [k, new Image()]));
const ringReadyMap = Object.fromEntries(Object.keys(RINGS).map(k => [k, false]));

// Smoothing state to reduce jitter
const SMOOTH_ALPHA = 0.30; // higher = snappier, lower = smoother
let smoothX = null, smoothY = null, smoothAngle = null, smoothR = null;

function smoothValue(curr, target, alpha) {
  return curr == null ? target : curr + alpha * (target - curr);
}

function smoothAngleValue(curr, target, alpha) {
  if (curr == null) return target;
  let diff = target - curr;
  // wrap to [-PI, PI]
  diff = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;
  return curr + alpha * diff;
}

function tryLoadImage(img, url, { useCORS, noReferrer }) {
  if (noReferrer) img.referrerPolicy = 'no-referrer';
  if (useCORS) img.crossOrigin = 'anonymous';
  else img.removeAttribute('crossorigin');
  img.src = `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`; // cache-bust
}

function loadRingForKey(key) {
  const img = ringImgs[key];
  let attempted = 0;
  const strategies = [
    { useCORS: true, noReferrer: true, url: RINGS[key] },
    { useCORS: false, noReferrer: true, url: RINGS[key] },
    { useCORS: false, noReferrer: false, url: RINGS[key] }
  ];

  img.onload = async () => {
    try { if (img.decode) await img.decode(); } catch {}
    ringReadyMap[key] = true;
    console.log(`Ring image ready for ${key} (strategy ${attempted})`);
    statusEl.textContent = `Ring image loaded (${key})`;
  };
  img.onerror = () => {
    console.warn(`Ring image load failed for ${key} (strategy ${attempted}), retrying...`);
    statusEl.textContent = `Loading ring image... (attempt ${attempted + 2})`;
    attempted += 1;
    if (attempted < strategies.length) {
      tryLoadImage(img, strategies[attempted].url, strategies[attempted]);
    }
  };

  // kick off first attempt
  tryLoadImage(img, strategies[attempted].url, strategies[attempted]);
}

for (const key of Object.keys(RINGS)) loadRingForKey(key);

// Initialize dropdown toggles
function initDropdown(selector) {
  const dropdown = document.querySelector(selector);
  if (!dropdown) return;
  
  const header = dropdown.querySelector('.dropdown-header');
  if (!header) return;
  
  header.addEventListener('click', (e) => {
    e.stopPropagation();
    // Close all other dropdowns
    document.querySelectorAll('.dropdown-selector').forEach(d => {
      if (d !== dropdown) d.classList.remove('active');
    });
    // Toggle current dropdown
    dropdown.classList.toggle('active');
  });
}

// Initialize all dropdowns
initDropdown('#ringSelector');
initDropdown('#glassesSelector');
initDropdown('#categorySelector');

// Handle item selection (rings, glasses, etc.)
function handleItemSelection(option, type) {
  let key, name, statusText;
  
  if (type === 'ring') {
    key = option.dataset.color;
    name = option.querySelector('span')?.textContent || 'Ring';
    
    // If the selected key is not in RINGS, show error
    if (!(key in RINGS)) {
      statusEl.textContent = `Error: ${name} style not available`;
      setTimeout(() => { statusEl.style.display = 'none'; }, 1500);
      return;
    }
    
    // Update current color and UI
    currentColor = key;
    statusText = `Selected: ${name}`;
    
    // Update active state for ring options
    document.querySelectorAll('.ring-option').forEach(opt => {
      opt.classList.remove('active');
    });
    
  } else if (type === 'glasses') {
    key = option.dataset.glasses;
    name = option.querySelector('span')?.textContent || 'Sunglasses';
    currentGlasses = key;
    statusText = `Selected: ${name}`;
    
    // Update active state for glasses options
    document.querySelectorAll('.glasses-option').forEach(opt => {
      opt.classList.remove('active');
    });
  }
  
  // Update the active state for the selected option
  option.classList.add('active');
  
  // Update status
  statusEl.textContent = statusText;
  statusEl.style.display = 'block';
  setTimeout(() => { statusEl.style.display = 'none'; }, 1500);
  
  // Close dropdown after selection
  option.closest('.dropdown-selector')?.classList.remove('active');
}

// Use event delegation for all item options
document.addEventListener('click', (e) => {
  // Handle ring selection
  const ringOption = e.target.closest('.ring-option');
  if (ringOption) {
    e.preventDefault();
    handleItemSelection(ringOption, 'ring');
    return;
  }
  
  // Handle glasses selection
  const glassesOption = e.target.closest('.glasses-option');
  if (glassesOption) {
    e.preventDefault();
    handleItemSelection(glassesOption, 'glasses');
    return;
  }
  
  // Close dropdowns when clicking outside
  if (!e.target.closest('.dropdown-selector') && !e.target.closest('.dropdown-content')) {
    document.querySelectorAll('.dropdown-selector').forEach(dropdown => {
      dropdown.classList.remove('active');
    });
  }
});

// Also handle touch events for better mobile support
document.addEventListener('touchend', (e) => {
  const ringOption = e.target.closest('.ring-option');
  const glassesOption = e.target.closest('.glasses-option');
  
  if (ringOption) {
    e.preventDefault();
    handleItemSelection(ringOption, 'ring');
  } else if (glassesOption) {
    e.preventDefault();
    handleItemSelection(glassesOption, 'glasses');
  }
}, { passive: false });

// Initialize the UI
updateSelectors();

if (sizeSlider) {
  const applySizeUI = () => {
    const val = parseInt(sizeSlider.value, 10) || 100;
    sizeScalePct = Math.max(50, Math.min(200, val));
    if (sizeValue) sizeValue.textContent = `${sizeScalePct}%`;
  };
  sizeSlider.addEventListener('input', applySizeUI);
  applySizeUI();
}

// Mode toggle UI
if (modeButtons && modeButtons.length) {
  // Function to show the correct item selector based on current mode
  const updateItemSelectors = () => {
    // Hide all item selectors first
    document.querySelectorAll('.item-selector').forEach(el => {
      el.classList.remove('active');
    });
    
    // Show the active one based on current mode
    if (currentMode === 'rings') {
      document.getElementById('ringSelector')?.classList.add('active');
    } else if (currentMode === 'sunglasses') {
      document.getElementById('glassesSelector')?.classList.add('active');
    }
    // Earrings and Necklace don't have selectors as they have single options
  };

  modeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      modeButtons.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      currentMode = e.currentTarget.dataset.mode;
      
      // Update status message
      statusEl.textContent = (
        currentMode === 'rings' ? 'Select a ring style' :
        currentMode === 'sunglasses' ? 'Select sunglasses style' :
        currentMode === 'earrings' ? 'Earrings mode' :
        'Necklace mode'
      );
      
      // Show the correct item selector
      updateItemSelectors();
    });
  });
  
  // Initialize the correct selector on page load
  updateItemSelectors();
}

// Sunglasses selector UI
if (glassesButtons && glassesButtons.length) {
  glassesButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      glassesButtons.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      currentGlasses = e.currentTarget.dataset.glasses;
      if (currentMode === 'sunglasses') {
        if (!glassesReadyMap[currentGlasses]) {
          statusEl.textContent = `Loading sunglasses image (${currentGlasses})...`;
        } else {
          statusEl.textContent = `Sunglasses selected: ${currentGlasses}`;
        }
      }
    });
  });
}

function resizeCanvasToVideo() {
  const vw = video.videoWidth || 0;
  const vh = video.videoHeight || 0;
  if (!vw || !vh) return;
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  canvas.width = vw * dpr;
  canvas.height = vh * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawFallbackRing(x, y, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.lineWidth = Math.max(2, radius * 0.28);
  ctx.strokeStyle = metalColors.gold.base;
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = radius * 0.2;
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawRing(centerX, centerY, radius, angle, color) {
  const img = ringImgs[color];
  if (img && ringReadyMap[color]) {
    // Draw the provided PNG, rotated and scaled
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(angle - Math.PI / 2);
    const size = radius * 2.592 * (sizeScalePct / 100); // 20% smaller than 3.24
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
    return;
  }

  // Fallback: procedural metallic ring until image loads
  const pal = metalColors[color] || metalColors.gold;
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(angle - Math.PI / 2);
  const band = Math.max(2, radius * 0.22);
  const grad = ctx.createLinearGradient(-radius, -radius, radius, radius);
  grad.addColorStop(0.0, pal.shadow);
  grad.addColorStop(0.45, pal.base);
  grad.addColorStop(0.55, pal.highlight);
  grad.addColorStop(1.0, pal.shadow);
  ctx.beginPath();
  ctx.lineWidth = band;
  ctx.strokeStyle = grad;
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = radius * 0.18;
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// Initialize category and mode handling
const categorySelector = document.getElementById('categorySelector');
const ringSelector = document.getElementById('ringSelector');
const glassesSelector = document.getElementById('glassesSelector');
let currentMode = 'rings'; // Default mode

// Show the appropriate selector based on current mode
function updateSelectors() {
  // Hide all selectors first
  document.querySelectorAll('.item-selector').forEach(el => {
    el.style.display = 'none';
  });
  
  // Show the active selector
  if (currentMode === 'rings') {
    ringSelector.style.display = 'block';
  } else if (currentMode === 'sunglasses') {
    glassesSelector.style.display = 'block';
  }
  // Add other modes (earrings, necklace) as needed
}

// Category selection
if (categorySelector) {
  const categoryHeader = categorySelector.querySelector('.dropdown-header');
  const categoryOptions = categorySelector.querySelectorAll('.category-option');
  
  categoryHeader?.addEventListener('click', (e) => {
    e.stopPropagation();
    categorySelector.classList.toggle('active');
  });
  
  categoryOptions.forEach(option => {
    option.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Update active state
      categoryOptions.forEach(opt => opt.classList.remove('active'));
      option.classList.add('active');
      
      // Update current mode and UI
      currentMode = option.dataset.mode;
      updateSelectors();
      
      // Update category header
      const icon = option.querySelector('i').cloneNode(true);
      const text = option.querySelector('span').textContent;
      
      const header = categorySelector.querySelector('.dropdown-header');
      header.innerHTML = '';
      header.appendChild(icon);
      header.innerHTML += `<span>${text}</span>`;
      header.innerHTML += '<i class="fas fa-chevron-down"></i>';
      
      // Close dropdown
      categorySelector.classList.remove('active');
    });
  });
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.dropdown-selector')) {
    document.querySelectorAll('.dropdown-selector').forEach(dropdown => {
      dropdown.classList.remove('active');
    });
  }
});

// MediaPipe Hands
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});

hands.onResults(onResults);

function onResults(results) {
  if (currentMode !== 'rings') return; // only render in rings mode
  // Ensure canvas matches current video frame dimensions
  resizeCanvasToVideo();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    statusEl.textContent = `Hands detected: ${results.multiHandLandmarks.length}`;

    const pxScaleX = (canvas.width / Math.max(1, Math.floor(window.devicePixelRatio || 1)));
    const pxScaleY = (canvas.height / Math.max(1, Math.floor(window.devicePixelRatio || 1)));

    const candidates = results.multiHandLandmarks.map(landmarks => {
      const ringMCP = landmarks[13];
      const ringPIP = landmarks[14];
      const dx = ringPIP.x - ringMCP.x;
      const dy = ringPIP.y - ringMCP.y;
      const angle = Math.atan2(dy, dx);
      const fingerWidth = Math.hypot(
        (ringPIP.x - ringMCP.x) * pxScaleX,
        (ringPIP.y - ringMCP.y) * pxScaleY
      );
      const lerp = 0.55;
      const cx = (ringMCP.x + dx * lerp) * pxScaleX;
      const cy = (ringMCP.y + dy * lerp) * pxScaleY;
      const ringRadius = Math.max(5, Math.min(24, fingerWidth * 0.30));
      return { cx, cy, angle, ringRadius };
    });

    // Choose best candidate: prefer the one closest to previous smoothed position; if none, pick largest radius
    let chosen;
    if (smoothX != null && smoothY != null) {
      chosen = candidates.reduce((best, c) => {
        const d = Math.hypot(c.cx - smoothX, c.cy - smoothY);
        return !best || d < best.dist ? { ...c, dist: d } : best;
      }, null);
    } else {
      chosen = candidates.reduce((best, c) => (!best || c.ringRadius > best.ringRadius ? c : best), null);
    }

    if (chosen) {
      smoothX = smoothValue(smoothX, chosen.cx, SMOOTH_ALPHA);
      smoothY = smoothValue(smoothY, chosen.cy, SMOOTH_ALPHA);
      smoothAngle = smoothAngleValue(smoothAngle, chosen.angle, SMOOTH_ALPHA);
      smoothR = smoothValue(smoothR, chosen.ringRadius, SMOOTH_ALPHA);
      drawRing(smoothX, smoothY, smoothR, smoothAngle, currentColor);
    }
  } else {
    statusEl.textContent = 'Show your hand to the camera';
    // Reset smoothing so we don't carry over stale state
    smoothX = smoothY = smoothAngle = smoothR = null;
  }
}

// Sunglasses AR using MediaPipe FaceMesh
const faceMesh = new FaceMesh({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.6
});

// Sunglasses catalog
const GLASSES = {
  'aviators-105130': 'https://pub-e46fd816b4ee497fb2f639f180c4df20.r2.dev/pngfind.com-aviators-png-105130.png',
  'aviators-105839': 'https://pub-e46fd816b4ee497fb2f639f180c4df20.r2.dev/pngfind.com-aviators-png-105839.png',
  'chasma-248748': 'https://pub-e46fd816b4ee497fb2f639f180c4df20.r2.dev/pngfind.com-chasma-png-248748.png',
  'round-glasses-2333295': 'https://pub-e46fd816b4ee497fb2f639f180c4df20.r2.dev/pngfind.com-round-glasses-png-2333295.png',
  'sunglasses-vector-5936502': 'https://pub-e46fd816b4ee497fb2f639f180c4df20.r2.dev/pngfind.com-sunglasses-vector-png-5936502.png'
};
const glassesImgs = Object.fromEntries(Object.keys(GLASSES).map(k => [k, new Image()]));
const glassesReadyMap = Object.fromEntries(Object.keys(GLASSES).map(k => [k, false]));

function loadGlassesForKey(key) {
  const img = glassesImgs[key];
  let attempted = 0;
  const strategies = [
    { useCORS: true, noReferrer: true, url: GLASSES[key] },
    { useCORS: false, noReferrer: true, url: GLASSES[key] },
    { useCORS: false, noReferrer: false, url: GLASSES[key] }
  ];
  img.onload = async () => {
    try { if (img.decode) await img.decode(); } catch {}
    glassesReadyMap[key] = true;
    console.log(`Glasses ready for ${key} (strategy ${attempted})`);
    if (currentMode === 'sunglasses') statusEl.textContent = `Sunglasses image loaded (${key})`;
  };
  img.onerror = () => {
    console.warn(`Glasses load failed for ${key} (strategy ${attempted}), retrying...`);
    if (currentMode === 'sunglasses') statusEl.textContent = `Loading sunglasses image (${key})... (attempt ${attempted + 2})`;
    attempted += 1;
    if (attempted < strategies.length) {
      tryLoadImage(img, strategies[attempted].url, strategies[attempted]);
    }
  };
  tryLoadImage(img, strategies[attempted].url, strategies[attempted]);
}

for (const key of Object.keys(GLASSES)) loadGlassesForKey(key);

faceMesh.onResults(onFaceResults);

// Necklace asset (robust loader)
const NECKLACE_URL = 'https://pub-e46fd816b4ee497fb2f639f180c4df20.r2.dev/pngfind.com-indian-gold-jewellery-necklace-1635999.png';
if (!window.__necklaceImg) {
  window.__necklaceImg = new Image();
  window.__necklaceReady = false;
  let attemptedNeck = 0;
  const strategiesNeck = [
    { useCORS: true, noReferrer: true, url: NECKLACE_URL },
    { useCORS: false, noReferrer: true, url: NECKLACE_URL },
    { useCORS: false, noReferrer: false, url: NECKLACE_URL }
  ];
  const nimg = window.__necklaceImg;
  nimg.onload = async () => { try { if (nimg.decode) await nimg.decode(); } catch {} window.__necklaceReady = true; };
  nimg.onerror = () => { attemptedNeck++; if (attemptedNeck < strategiesNeck.length) tryLoadImage(nimg, strategiesNeck[attemptedNeck].url, strategiesNeck[attemptedNeck]); };
  tryLoadImage(nimg, strategiesNeck[attemptedNeck].url, strategiesNeck[attemptedNeck]);
}

function onFaceResults(results) {
  if (currentMode !== 'sunglasses' && currentMode !== 'earrings' && currentMode !== 'necklace') return; // only render in face modes
  resizeCanvasToVideo();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
    statusEl.textContent = 'Show your face to the camera';
    return;
  }

  const landmarks = results.multiFaceLandmarks[0];
  // Use outer eye corners: 33 (right eye) and 263 (left eye)
  const right = landmarks[33];
  const left = landmarks[263];
  const pxScaleX = (canvas.width / Math.max(1, Math.floor(window.devicePixelRatio || 1)));
  const pxScaleY = (canvas.height / Math.max(1, Math.floor(window.devicePixelRatio || 1)));
  const rx = right.x * pxScaleX;
  const ry = right.y * pxScaleY;
  const lx = left.x * pxScaleX;
  const ly = left.y * pxScaleY;

  const cx = (rx + lx) / 2;
  const cy = (ry + ly) / 2;
  const angle = Math.atan2(ly - ry, lx - rx);
  const eyeDist = Math.hypot(lx - rx, ly - ry);
  
  if (currentMode === 'sunglasses') {
    // Size glasses relative to eye distance; adjust multiplier for fit (reduced by 35%)
    const width = eyeDist * 2.4 * 0.65 * (sizeScalePct / 100);
    const img = glassesImgs[currentGlasses];
    const ready = glassesReadyMap[currentGlasses];
    const aspect = img && img.naturalWidth ? (img.naturalWidth / (img.naturalHeight || 1)) : 1;
    const height = width / (aspect || 1);
    if (ready && img) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.drawImage(img, -width / 2, -height * 0.45, width, height);
      ctx.restore();
      statusEl.textContent = `Sunglasses overlay active (${currentGlasses})`;
    } else {
      statusEl.textContent = `Loading sunglasses image (${currentGlasses})...`;
    }
    return;
  }

  if (currentMode === 'necklace') {
    // Landmarks we have available:
    // chin: 152, leftNeck: 234, rightNeck: 454, neckBase: 199
    const chin = landmarks[152];
    const leftNeck = landmarks[234];
    const rightNeck = landmarks[454];
    const neckBase = landmarks[199];

    // Pixel coords
    const chinX = chin.x * pxScaleX, chinY = chin.y * pxScaleY;
    const leftNeckX = leftNeck.x * pxScaleX, leftNeckY = leftNeck.y * pxScaleY;
    const rightNeckX = rightNeck.x * pxScaleX, rightNeckY = rightNeck.y * pxScaleY;
    const neckBaseX = neckBase.x * pxScaleX, neckBaseY = neckBase.y * pxScaleY;

    // Midpoints
    const neckSidesMidX = (leftNeckX + rightNeckX) / 2;
    const neckSidesMidY = (leftNeckY + rightNeckY) / 2;

    // Face metrics to size the necklace
    // eyeDist is already in pixels (computed from pixel coords lx,rx,ly,ry)
    const eyeDistPx = eyeDist;

    // faceHeight: distance from chin up to eye-line center (cx,cy)
    const faceHeight = Math.hypot(cx - chinX, cy - chinY);

    // compute desired width: mix of eye distance and face height to be robust
    const width = Math.max(eyeDistPx * 1.2, faceHeight * 0.9) * (sizeScalePct / 100);

    // aspect and final height
    const necklaceImg = window.__necklaceImg;
    const necklaceReady = window.__necklaceReady;
    if (!necklaceReady || !necklaceImg) {
      statusEl.textContent = 'Loading necklace image...';
      return;
    }
    const aspect = (necklaceImg.naturalWidth || 1) / (necklaceImg.naturalHeight || 1);
    const height = width / (aspect || 1);

    // Vertical anchor: start from neckBase (low neck) and move slightly toward chin
    // This pushes the anchor below the jawline, roughly toward the collarbone
    // The factor controls how far toward chin we pull the anchor (0 = neckBase, 1 = chin)
    const anchorBlend = 0.10; // lower anchor (closer to neck base)
    let targetX = neckSidesMidX * 0.6 + neckBaseX * 0.4; // prefer neck sides mid for horizontal stability
    let targetY = neckBaseY + (chinY - neckBaseY) * anchorBlend;

    // adjust further down by a fraction of necklace height so the necklace sits below chin
    targetY += height * 0.52; // bring necklace slightly up

    // Compute angle from left->right neck side, using pixel coords for stability
    const neckAngle = Math.atan2(rightNeckY - leftNeckY, rightNeckX - leftNeckX);

    // Apply smoothing (stronger smoothing for necklace)
    if (!window.necklaceSmoothX) window.necklaceSmoothX = targetX;
    if (!window.necklaceSmoothY) window.necklaceSmoothY = targetY;
    if (!window.necklaceSmoothA) window.necklaceSmoothA = neckAngle;

    window.necklaceSmoothX = smoothValue(window.necklaceSmoothX, targetX, 0.12);
    window.necklaceSmoothY = smoothValue(window.necklaceSmoothY, targetY, 0.12);
    window.necklaceSmoothA = smoothAngleValue(window.necklaceSmoothA, neckAngle, 0.12);

    // Clamp to canvas bounds to avoid drawing completely offscreen
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const drawX = clamp(window.necklaceSmoothX, 0 + width * 0.1, canvas.width - width * 0.1);
    const drawY = clamp(window.necklaceSmoothY, 0 + height * 0.05, canvas.height - height * 0.05);

    // Draw the necklace with subtle shadow and slight upward offset (so anchor is below image)
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;

    ctx.translate(drawX, drawY);
    ctx.rotate(window.necklaceSmoothA);

    // Because anchor sits below image, draw the image slightly above the anchor point
    // tweak the vertical offset multiplier if it looks too high/low
    const verticalDrawOffset = -height * 0.20;
    ctx.drawImage(necklaceImg, -width / 2, verticalDrawOffset, width, height);

    ctx.restore();

    // Update status and hide quickly if previously loading
    if (statusEl.textContent.includes('Loading')) {
      statusEl.textContent = 'Necklace active';
      setTimeout(() => { statusEl.style.display = 'none'; }, 1200);
    }
    return;
  }

  // Earrings mode
  {
    // Helper to ensure landmark is within normalized frame
    const inBounds = (p) => p && p.x > 0.01 && p.x < 0.99 && p.y > 0.01 && p.y < 0.99;

    // Use proper ear landmarks for earring placement
    // MediaPipe face mesh ear landmarks: 
    // Left ear: 234 (ear tragus), 127 (ear lobe area)
    // Right ear: 454 (ear tragus), 356 (ear lobe area)
    const leftEarTragus = landmarks[234];   // Left ear tragus (better for earring placement)
    const rightEarTragus = landmarks[454];  // Right ear tragus
    const leftEarLobe = landmarks[127];     // Left ear lobe area
    const rightEarLobe = landmarks[356];    // Right ear lobe area

    // Check visibility with improved logic
    const faceCenter = (right.x + left.x) / 2;
    const earMargin = 0.05;
    
    // An ear is visible if its landmark is in bounds and positioned correctly relative to face center
    const leftEarVisible = inBounds(leftEarTragus) && leftEarTragus.x < (faceCenter - earMargin);
    const rightEarVisible = inBounds(rightEarTragus) && rightEarTragus.x > (faceCenter + earMargin);

    // Size relative to eye distance and slider (reduced by 35%)
    const erBaseSize = eyeDist * 0.2275;
    const erSize = erBaseSize * (sizeScalePct / 100);
    // Front view detection: both ears visible
    const isFront = leftEarVisible && rightEarVisible;

    // Calculate earring positions using ear tragus as primary anchor
    // For more natural earring placement, position slightly below and outward from tragus
    let leftTargetX = 0, leftTargetY = 0, rightTargetX = 0, rightTargetY = 0;

    if (leftEarVisible) {
      leftTargetX = leftEarTragus.x * pxScaleX;
      leftTargetY = leftEarTragus.y * pxScaleY;
      
      // Adjust position for natural earring placement
      // Closer in front view; spaced for side view
      const outwardOffset = erSize * (isFront ? 0.18 : 0.65);
      const downwardOffset = erSize * 1.7; // slightly lower
      
      leftTargetX -= outwardOffset; // Move left (outward from face)
      leftTargetY += downwardOffset; // Move down
    }

    if (rightEarVisible) {
      rightTargetX = rightEarTragus.x * pxScaleX;
      rightTargetY = rightEarTragus.y * pxScaleY;
      
      // Adjust position for natural earring placement
      // Closer in front view; spaced for side view
      const outwardOffset = erSize * (isFront ? 0.18 : 0.65);
      const downwardOffset = erSize * 1.7; // slightly lower
      
      rightTargetX += outwardOffset; // Move right (outward from face)
      rightTargetY += downwardOffset; // Move down
    }

    // Face tilt angle for earring rotation
    const faceAngle = Math.atan2(ly - ry, lx - rx);

    // Initialize smoothing stores if missing
    if (window.earLeftSmoothX == null) {
      window.earLeftSmoothX = leftTargetX;
      window.earLeftSmoothY = leftTargetY;
      window.earLeftSmoothA = faceAngle;
    }
    if (window.earRightSmoothX == null) {
      window.earRightSmoothX = rightTargetX;
      window.earRightSmoothY = rightTargetY;
      window.earRightSmoothA = faceAngle;
    }

    // Per-ear visibility flags (to snap on first visible frame)
    if (window.__earLeftPrevVisible == null) window.__earLeftPrevVisible = false;
    if (window.__earRightPrevVisible == null) window.__earRightPrevVisible = false;

    const smoothingFactor = 0.28; // a bit snappier to avoid floaty feel
    const angleSmoothingFactor = 0.18;

    // Left ear: only smooth when visible; snap on first visible
    if (leftEarVisible) {
      if (!window.__earLeftPrevVisible) {
        window.earLeftSmoothX = leftTargetX;
        window.earLeftSmoothY = leftTargetY;
        window.earLeftSmoothA = faceAngle;
      } else {
        window.earLeftSmoothX = smoothValue(window.earLeftSmoothX, leftTargetX, smoothingFactor);
        window.earLeftSmoothY = smoothValue(window.earLeftSmoothY, leftTargetY, smoothingFactor);
        window.earLeftSmoothA = smoothAngleValue(window.earLeftSmoothA, faceAngle, angleSmoothingFactor);
      }
    }

    // Right ear: only smooth when visible; snap on first visible
    if (rightEarVisible) {
      if (!window.__earRightPrevVisible) {
        window.earRightSmoothX = rightTargetX;
        window.earRightSmoothY = rightTargetY;
        window.earRightSmoothA = faceAngle;
      } else {
        window.earRightSmoothX = smoothValue(window.earRightSmoothX, rightTargetX, smoothingFactor);
        window.earRightSmoothY = smoothValue(window.earRightSmoothY, rightTargetY, smoothingFactor);
        window.earRightSmoothA = smoothAngleValue(window.earRightSmoothA, faceAngle, angleSmoothingFactor);
      }
    }

    // Update previous visibility state
    window.__earLeftPrevVisible = leftEarVisible;
    window.__earRightPrevVisible = rightEarVisible;

    // Clamp to canvas bounds
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const leftDrawX = clamp(window.earLeftSmoothX, erSize * 0.5, canvas.width - erSize * 0.5);
    const leftDrawY = clamp(window.earLeftSmoothY, erSize * 0.5, canvas.height - erSize * 0.5);
    const rightDrawX = clamp(window.earRightSmoothX, erSize * 0.5, canvas.width - erSize * 0.5);
    const rightDrawY = clamp(window.earRightSmoothY, erSize * 0.5, canvas.height - erSize * 0.5);

    // Load earring images if not already initialized (robust loader with fallback)
    const ER_LEFT_URL = 'https://pub-e46fd816b4ee497fb2f639f180c4df20.r2.dev/85ef607d-7716-4a42-abf3-ee8fb30ecd29.png';
    const ER_RIGHT_URL = 'https://pub-e46fd816b4ee497fb2f639f180c4df20.r2.dev/85ef607d-7716-4a42-abf3-ee8fb30ecd29.png';
    const ER_FALLBACK_URL = 'https://pub-e46fd816b4ee497fb2f639f180c4df20.r2.dev/85ef607d-7716-4a42-abf3-ee8fb30ecd29.png';

    if (!window.__earringLeftImg) {
      window.__earringLeftImg = new Image();
      window.__earringLeftReady = false;
      let attemptedL = 0;
      const strategiesL = [
        { useCORS: true, noReferrer: true, url: ER_LEFT_URL },
        { useCORS: false, noReferrer: true, url: ER_LEFT_URL },
        { useCORS: false, noReferrer: false, url: ER_LEFT_URL },
        { useCORS: true, noReferrer: true, url: ER_FALLBACK_URL }
      ];
      const imgL = window.__earringLeftImg;
      imgL.onload = async () => { try { if (imgL.decode) await imgL.decode(); } catch {} window.__earringLeftReady = true; };
      imgL.onerror = () => { attemptedL++; if (attemptedL < strategiesL.length) tryLoadImage(imgL, strategiesL[attemptedL].url, strategiesL[attemptedL]); };
      tryLoadImage(imgL, strategiesL[attemptedL].url, strategiesL[attemptedL]);
    }

    if (!window.__earringRightImg) {
      window.__earringRightImg = new Image();
      window.__earringRightReady = false;
      let attemptedR = 0;
      const strategiesR = [
        { useCORS: true, noReferrer: true, url: ER_RIGHT_URL },
        { useCORS: false, noReferrer: true, url: ER_RIGHT_URL },
        { useCORS: false, noReferrer: false, url: ER_RIGHT_URL },
        { useCORS: true, noReferrer: true, url: ER_FALLBACK_URL }
      ];
      const imgR = window.__earringRightImg;
      imgR.onload = async () => { try { if (imgR.decode) await imgR.decode(); } catch {} window.__earringRightReady = true; };
      imgR.onerror = () => { attemptedR++; if (attemptedR < strategiesR.length) tryLoadImage(imgR, strategiesR[attemptedR].url, strategiesR[attemptedR]); };
      tryLoadImage(imgR, strategiesR[attemptedR].url, strategiesR[attemptedR]);
    }

    // Load earring images (reuse code but ensure ready flags exist)
    const leftImg = window.__earringLeftImg;
    const rightImg = window.__earringRightImg;
    const leftReady = !!window.__earringLeftReady;
    const rightReady = !!window.__earringRightReady;

    if ((!leftReady || !leftImg) && (!rightReady || !rightImg)) {
      statusEl.textContent = 'Loading earring image...';
      return;
    }

    // Build face oval clip so earrings do not appear over the face
    const faceOvalIdx = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
    let hasOval = true;
    for (const i of faceOvalIdx) { if (!landmarks[i]) { hasOval = false; break; } }
    const doOcclude = hasOval && leftEarVisible && rightEarVisible; // only in front view
    if (doOcclude) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height);
      // Expand the face oval slightly outward from face center so face has priority
      const centerX = cx;
      const centerY = cy;
      // Dynamic expansion with slightly more padding
      const expand = (leftEarVisible && rightEarVisible) ? 1.06 : 1.03;
      const p0 = landmarks[faceOvalIdx[0]];
      const p0x = p0.x * pxScaleX, p0y = p0.y * pxScaleY;
      ctx.moveTo(centerX + (p0x - centerX) * expand, centerY + (p0y - centerY) * expand);
      for (let k = 1; k < faceOvalIdx.length; k++) {
        const p = landmarks[faceOvalIdx[k]];
        const px = p.x * pxScaleX, py = p.y * pxScaleY;
        ctx.lineTo(centerX + (px - centerX) * expand, centerY + (py - centerY) * expand);
      }
      ctx.closePath();
      ctx.clip('evenodd');
    }

    // Draw left earring if visible and image is ready
    if (leftReady && leftImg && leftEarVisible) {
      const aspectRatio = (leftImg.naturalWidth || 1) / (leftImg.naturalHeight || 1);
      const width = erSize;
      const height = width / aspectRatio;
      
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
      
      ctx.translate(leftDrawX, leftDrawY);
      ctx.rotate(window.earLeftSmoothA);
      
      // Center the earring image properly
      ctx.drawImage(leftImg, -width * 0.5, -height * 0.5, width, height);
      ctx.restore();
    }

    // Draw right earring if visible and image is ready
    if (rightReady && rightImg && rightEarVisible) {
      const aspectRatio = (rightImg.naturalWidth || 1) / (rightImg.naturalHeight || 1);
      const width = erSize;
      const height = width / aspectRatio;
      
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
      
      ctx.translate(rightDrawX, rightDrawY);
      ctx.rotate(window.earRightSmoothA);
      
      // Center the earring image properly
      ctx.drawImage(rightImg, -width * 0.5, -height * 0.5, width, height);
      ctx.restore();
    }

    if (doOcclude) ctx.restore();

    statusEl.textContent = 'Earrings overlay active';
  }
}

async function startCamera() {
  try {
    if (!('mediaDevices' in navigator) || !navigator.mediaDevices.getUserMedia) {
      statusEl.textContent = 'Error: Camera API not supported in this browser';
      loadingEl.textContent = 'Use a modern browser with camera support';
      return;
    }
    const localHostnames = ['localhost', '127.0.0.1', '::1'];
    if (!window.isSecureContext && !localHostnames.includes(location.hostname)) {
      statusEl.textContent = 'This page must be served over HTTPS or localhost for camera access';
      loadingEl.textContent = 'Open via a dev server (http://localhost) or HTTPS';
      return;
    }

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
    } catch (e1) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (e2) {
        console.error('Error accessing camera:', e2);
        statusEl.textContent = 'Error: Camera access denied or unavailable';
        loadingEl.textContent = 'Check browser permissions and reload';
        return;
      }
    }

    video.srcObject = stream;

    const onReady = () => {
      loadingEl.style.display = 'none';
      statusEl.textContent = 'Camera ready. Show your hand or face!';
      const cameraInstance = new Camera(video, {
        onFrame: async () => {
          await hands.send({ image: video });
          await faceMesh.send({ image: video });
        },
        width: 1280,
        height: 720
      });
      cameraInstance.start();
    };

    if (video.readyState >= 2) {
      onReady();
    } else {
      video.addEventListener('loadedmetadata', () => { resizeCanvasToVideo(); onReady(); }, { once: true });
    }
    try { await video.play(); } catch {}
  } catch (err) {
    console.error('Error accessing camera:', err);
    statusEl.textContent = 'Error: Camera access denied or unavailable';
    loadingEl.textContent = 'Please allow camera access and reload';
  }
}

window.addEventListener('resize', resizeCanvasToVideo);
startCamera();
