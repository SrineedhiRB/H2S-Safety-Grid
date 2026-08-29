/* QR / barcode service */
async function decodeQrFromVideo(video) {
  if (!video || video.readyState < 2) return "";
  if ("BarcodeDetector" in window) {
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    const codes = await detector.detect(video);
    return codes[0] ? codes[0].rawValue : "";
  }
  if (typeof jsQR !== "function" || !video.videoWidth) return "";
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 640 / video.videoWidth);
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" });
  return code ? code.data : "";
}
async function decodeQrFromFile(file) {
  if (!file) return "";
  if ("BarcodeDetector" in window) {
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    const bitmap = await createImageBitmap(file);
    const codes = await detector.detect(bitmap);
    if (bitmap.close) bitmap.close();
    return codes[0] ? codes[0].rawValue : "";
  }
  if (typeof jsQR !== "function") return "";
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" });
        resolve(code ? code.data : "");
      };
      img.onerror = () => resolve("");
      img.src = e.target.result;
    };
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}
window.decodeQrFromVideo = decodeQrFromVideo;
window.decodeQrFromFile = decodeQrFromFile;
