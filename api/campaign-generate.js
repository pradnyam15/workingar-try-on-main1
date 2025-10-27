export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    const { prompt, refImageUrl, imageBase64 } = req.body || {};
    if (!prompt || !imageBase64 || !refImageUrl) {
      res.status(400).json({ error: 'Missing prompt, imageBase64 or refImageUrl' });
      return;
    }
    if (!apiKey) {
      res.status(500).json({ error: 'Missing GEMINI_API_KEY (or GOOGLE_API_KEY) in environment' });
      return;
    }

    // Fetch reference image and convert to base64 (improves reliability vs. just passing URL text)
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

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';
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
      contents: [
        {
          role: 'user',
          parts
        }
      ],
      generationConfig: { response_mime_type: 'image/jpeg' }
    };

    const r = await fetch(url + `?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const contentType = r.headers.get('content-type') || '';
    if (!r.ok) {
      const errText = await r.text();
      res.status(r.status).json({ error: errText || 'Upstream error' });
      return;
    }
    const data = contentType.includes('application/json') ? await r.json() : await r.text();

    // Expected: candidates[0].content.parts[0].inline_data.data (base64)
    let imageOut = '';
    try {
      imageOut = data.candidates?.[0]?.content?.parts?.[0]?.inline_data?.data || '';
    } catch {}
    if (!imageOut) {
      res.status(502).json({ error: 'No image returned from AI Studio' });
      return;
    }

    res.status(200).json({ imageBase64: imageOut });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
