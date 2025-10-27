export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    const { prompt, refImageUrl, imageBase64 } = req.body || {};
    if (!prompt || !imageBase64 || !refImageUrl) {
      res.status(400).json({ error: 'Missing prompt, imageBase64 or refImageUrl' });
      return;
    }
    // Gemini path
    if (!geminiKey) {
      res.status(500).json({ error: 'Missing GEMINI_API_KEY/GOOGLE_API_KEY' });
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
    const body = {
      contents: [{ role: 'user', parts }],
      generationConfig: { response_mime_type: 'image/png' }
    };
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
        const inline = p?.inline_data || p?.inlineData;
        const mt = (inline?.mime_type || inline?.mimeType || '');
        if (inline?.data && mt.startsWith('image/')) {
          imageOut = inline.data;
          break;
        }
      }
    } catch {}
    if (!imageOut) {
      const dbg = (() => {
        try { return JSON.stringify(data).slice(0, 600); } catch { return ''; }
      })();
      res.status(502).json({ error: 'No image returned from Gemini', debug: dbg });
      return;
    }
    res.status(200).json({ imageBase64: imageOut });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
