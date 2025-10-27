import sharp from 'sharp';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const stabilityKey = process.env.STABILITY_API_KEY || '';
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    const { prompt, refImageUrl, imageBase64 } = req.body || {};
    const provider = ((req.body && req.body.provider) || process.env.DEFAULT_PROVIDER || '').toLowerCase();
    const useGemini = provider === 'gemini' || (
      !provider && !!geminiKey && (
        !stabilityKey || (process.env.DEFAULT_PROVIDER || '').toLowerCase() === 'gemini'
      )
    );
    if (!prompt || !imageBase64 || !refImageUrl) {
      res.status(400).json({ error: 'Missing prompt, imageBase64 or refImageUrl' });
      return;
    }
    // Use Stability only if not using Gemini
    if (!useGemini && stabilityKey) {
      // Build multipart form for image-to-image (Stability v1)
      const personBuffer = Buffer.from(imageBase64, 'base64');

      // Fetch and prepare the jewelry image
      const jewelryImageResponse = await fetch(refImageUrl);
      if (!jewelryImageResponse.ok) {
        throw new Error(`Failed to fetch reference image: ${jewelryImageResponse.statusText}`);
      }
      const jewelryBuffer = Buffer.from(await jewelryImageResponse.arrayBuffer());

      // Composite the jewelry onto the person image
      const baseResized = await sharp(personBuffer)
        .resize(896, 1152)
        .jpeg()
        .toBuffer();

      const baseMeta = await sharp(baseResized).metadata();
      const jewelMeta = await sharp(jewelryBuffer).metadata();

      const maxW = Math.floor((baseMeta.width || 896) * 0.4);
      const maxH = Math.floor((baseMeta.height || 1152) * 0.4);
      let overlayBuf = jewelryBuffer;
      if ((jewelMeta.width || 0) > maxW || (jewelMeta.height || 0) > maxH) {
        overlayBuf = await sharp(jewelryBuffer)
          .resize({ width: maxW, height: maxH, fit: 'inside', withoutEnlargement: true })
          .toBuffer();
      }

      const overlayMeta = await sharp(overlayBuf).metadata();
      const left = Math.max(0, Math.floor(((baseMeta.width || 896) - (overlayMeta.width || 0)) / 2));
      const top = Math.max(0, Math.floor(((baseMeta.height || 1152) - (overlayMeta.height || 0)) / 2));

      const compositedBuffer = await sharp(baseResized)
        .composite([{ input: overlayBuf, left, top }])
        .jpeg()
        .toBuffer();

      const form = new FormData();
      const fullPrompt = `${prompt}. The subject must be wearing the provided jewelry overlay. Do not alter the jewelry's appearance. Preserve subject identity.`;
      form.append('init_image', new Blob([compositedBuffer], { type: 'image/jpeg' }), 'init.jpg');
      form.append('image_strength', '0.25');
      form.append('init_image_mode', 'IMAGE_STRENGTH');
      form.append('text_prompts[0][text]', fullPrompt);
      form.append('cfg_scale', '7');
      form.append('samples', '1');
      form.append('steps', '30');

      async function callStability(engine) {
        const url = `https://api.stability.ai/v1/generation/${engine}/image-to-image`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${stabilityKey}`,
          },
          body: form,
        });
        return resp;
      }

      const engines = [
        'stable-diffusion-xl-1024-v1-0'
      ];
      let sr;
      for (const eng of engines) {
        sr = await callStability(eng);
        if (sr.ok) break;
        if (!(sr.status === 404 || sr.status === 400)) break;
      }
      if (!sr.ok) {
        const errText = await sr.text();
        res.status(sr.status).json({ error: errText || 'Stability upstream error' });
        return;
      }
      const ct = sr.headers.get('content-type') || '';
      if (ct.startsWith('application/json')) {
        const json = await sr.json();
        const artifact = Array.isArray(json?.artifacts) ? json.artifacts.find(a => a?.base64) : null;
        if (!artifact?.base64) {
          res.status(502).json({ error: 'No image returned from Stability (json response)' });
          return;
        }
        res.status(200).json({ imageBase64: artifact.base64 });
        return;
      } else if (ct.startsWith('image/')) {
        const ab = await sr.arrayBuffer();
        const b64 = Buffer.from(ab).toString('base64');
        res.status(200).json({ imageBase64: b64 });
        return;
      } else {
        const text = await sr.text();
        res.status(502).json({ error: `Unexpected Stability response (${ct}): ${text}` });
        return;
      }
    }

    // Gemini path (either explicitly chosen or fallback when available)
    if (!geminiKey) {
      res.status(500).json({ error: 'Missing STABILITY_API_KEY. Optionally set GEMINI_API_KEY/GOOGLE_API_KEY to use Gemini fallback.' });
      return;
    }

    // Minimal Gemini fallback path (unchanged from prior, but without response_mime_type)
    let refMime = 'image/jpeg';
    if (/\.png($|\?)/i.test(refImageUrl)) refMime = 'image/png';
    if (/\.webp($|\?)/i.test(refImageUrl)) refMime = 'image/webp';
    try {
      const rf = await fetch(refImageUrl);
      if (rf.ok) {
        const ct = rf.headers.get('content-type');
        if (ct && ct.startsWith('image/')) refMime = ct.split(';')[0];
        const ab = await rf.arrayBuffer();
        var refBase64 = Buffer.from(ab).toString('base64');
      }
    } catch {}
    const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';
    const parts = [
      { text: `${prompt} Preserve the subject's identity. Style must harmonize with the reference jewelry.` },
      { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
    ];
    if (typeof refBase64 === 'string' && refBase64.length > 0) {
      parts.push({ inline_data: { mime_type: refMime, data: refBase64 } });
    } else {
      parts.push({ text: `Reference jewelry image URL: ${refImageUrl}` });
    }
    const body = { contents: [{ role: 'user', parts }] };
    const r = await fetch(geminiUrl + `?key=${encodeURIComponent(geminiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const errText = await r.text();
      res.status(r.status).json({ error: errText || 'Gemini upstream error' });
      return;
    }
    const data = await r.json();
    let imageOut = '';
    try {
      const partsOut = data.candidates?.[0]?.content?.parts || [];
      for (const p of partsOut) {
        if (p?.inline_data?.data && (p?.inline_data?.mime_type || '').startsWith('image/')) {
          imageOut = p.inline_data.data;
          break;
        }
      }
    } catch {}
    if (!imageOut) {
      res.status(502).json({ error: 'No image returned from Gemini' });
      return;
    }
    res.status(200).json({ imageBase64: imageOut });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
