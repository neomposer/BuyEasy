/* BuyEasy media compression: shrinks photos and videos on the phone BEFORE upload,
   so they take kilobytes in storage and load fast on mobile data.
   await BuyEasyMedia.image(file, {maxDim, maxKB})  -> File (WebP/JPEG)
   await BuyEasyMedia.video(file, {maxSeconds, maxHeight, onProgress}) -> File (small WebM/MP4) */
(function () {
  'use strict';
  const canvasType = () => { const c = document.createElement('canvas'); c.width = c.height = 1; return c.toDataURL('image/webp').startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg'; };
  const OUT = canvasType();
  const ext = t => (t === 'image/webp' ? 'webp' : 'jpg');
  const toBlob = (c, type, q) => new Promise(r => c.toBlob(b => r(b), type, q));

  async function load(file) {
    if (window.createImageBitmap) { try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* fall through */ } }
    return new Promise((res, rej) => { const u = URL.createObjectURL(file), i = new Image(); i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = () => rej(new Error('That image could not be read.')); i.src = u; });
  }

  async function image(file, o) {
    o = Object.assign({ maxDim: 1000, maxKB: 120 }, o || {});
    const img = await load(file);
    let w = img.width, h = img.height;
    const s0 = Math.min(1, o.maxDim / Math.max(w, h)); w = Math.max(1, Math.round(w * s0)); h = Math.max(1, Math.round(h * s0));
    let blob = null, q = 0.8;
    for (let round = 0; round < 6; round++) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
      for (q = round ? 0.62 : 0.8; q >= 0.4; q -= 0.1) { blob = await toBlob(c, OUT, q); if (blob && blob.size <= o.maxKB * 1024) break; }
      if (blob && blob.size <= o.maxKB * 1024) break;
      w = Math.round(w * 0.85); h = Math.round(h * 0.85);          // still too big: make it a little smaller
    }
    if (!blob) throw new Error('Image compression failed.');
    const base = (file.name || 'photo').replace(/\.[^.]+$/, '');
    return new File([blob], base + '.' + ext(blob.type || OUT), { type: blob.type || OUT });
  }

  function videoMime() {
    const list = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    return list.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
  }
  const canVideo = () => !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream && videoMime());

  async function video(file, o) {
    o = Object.assign({ maxSeconds: 30, maxHeight: 360, videoBps: 350000, audioBps: 40000, fps: 24, maxFallbackMB: 3, onProgress: null }, o || {});
    if (!canVideo()) {
      if (file.size <= o.maxFallbackMB * 1048576) return file;
      throw new Error('This phone cannot shrink videos. Please record a shorter clip (under ' + o.maxFallbackMB + ' MB).');
    }
    const url = URL.createObjectURL(file);
    const v = document.createElement('video'); v.src = url; v.playsInline = true; v.preload = 'auto'; v.muted = false;
    try {
      await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('That video could not be read.')); });
      if (v.duration > o.maxSeconds + 0.5) throw new Error('Videos must be ' + o.maxSeconds + ' seconds or shorter.');
      const scale = Math.min(1, o.maxHeight / v.videoHeight);
      const W = Math.max(2, Math.round(v.videoWidth * scale / 2) * 2), H = Math.max(2, Math.round(v.videoHeight * scale / 2) * 2);
      const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      const stream = canvas.captureStream(o.fps);
      try {                                                        // keep the sound, but do not play it out loud
        const ac = new (window.AudioContext || window.webkitAudioContext)(); const src = ac.createMediaElementSource(v);
        const dest = ac.createMediaStreamDestination(); src.connect(dest); dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
      } catch (e) { /* silent video is fine */ }
      const mime = videoMime(); const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: o.videoBps, audioBitsPerSecond: o.audioBps });
      const chunks = []; rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      const finished = new Promise(res => { rec.onstop = res; });
      let raf = null;
      const draw = () => { ctx.drawImage(v, 0, 0, W, H); if (o.onProgress && v.duration) o.onProgress(Math.min(99, Math.round(v.currentTime / v.duration * 100))); raf = v.paused || v.ended ? null : requestAnimationFrame(draw); };
      v.onplay = () => { draw(); };
      v.onended = () => { try { rec.stop(); } catch (e) {} };
      rec.start(500);
      await v.play();
      await finished;
      if (raf) cancelAnimationFrame(raf);
      const type = mime.startsWith('video/mp4') ? 'video/mp4' : 'video/webm';
      const blob = new Blob(chunks, { type });
      if (!blob.size) throw new Error('Video compression failed.');
      const base = (file.name || 'video').replace(/\.[^.]+$/, '');
      return new File([blob], base + (type === 'video/mp4' ? '.mp4' : '.webm'), { type });
    } finally { URL.revokeObjectURL(url); }
  }
  const kb = b => b < 1048576 ? Math.round(b / 1024) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
  window.BuyEasyMedia = { image, video, canVideo, kb };
})();
