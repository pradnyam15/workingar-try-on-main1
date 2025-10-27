export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const stabilityKey = process.env.STABILITY_API_KEY || '';
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    const { prompt, refImageUrl, imageBase64 } = req.body || {};
    if (!prompt || !imageBase64 || !refImageUrl) {
      res.status(400).json({ error: 'Missing prompt, imageBase64 or refImageUrl' });
      return;
    }
    // Prefer Stability AI if key is provided
    if (stabilityKey) {
      // Build multipart form for image-to-image
      const initBuffer = Buffer.from(imageBase64, 'base64');
      const form = new FormData();
      form.append('prompt', `${prompt} Style harmonized with this reference jewelry: ${refImageUrl}. Preserve subject identity.`);
      form.append('output_format', 'jpeg');
      // Many Stability endpoints accept 'image' for init image
      form.append('image', new Blob([initBuffer], { type: 'image/jpeg' }), 'init.jpg');
      // Optional strength parameter (0..1). 0.35 is a safe default to preserve identity
      form.append('strength', '0.35');

      // Using v2beta stable-image edit endpoint for image-to-image
      const stabilityUrl = 'https://api.stability.ai/v2beta/stable-image/edit';
      const sr = await fetch(stabilityUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stabilityKey}`,
          Accept: 'image/*',
        },
        body: form,
      });
      if (!sr.ok) {
        const errText = await sr.text();
        res.status(sr.status).json({ error: errText || 'Stability upstream error' });
        return;
      }
      const ab = await sr.arrayBuffer();
      const b64 = Buffer.from(ab).toString('base64');
      res.status(200).json({ imageBase64: b64 });
      return;
    }

    // Fallback to Gemini only if Stability key missing
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
