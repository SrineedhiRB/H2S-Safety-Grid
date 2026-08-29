/* Canvas / image analysis service */
function canvasAdjustImage(dataUrl, brightness = 100, contrast = 100) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.filter = `brightness(${brightness / 100}) contrast(${contrast / 100})`;
        ctx.drawImage(img, 0, 0);
        const crop = document.createElement("canvas");
        crop.width = Math.max(1, Math.round(canvas.width * .5));
        crop.height = Math.max(1, Math.round(canvas.height * .5));
        crop.getContext("2d").drawImage(
          canvas, canvas.width*.25, canvas.height*.25,
          canvas.width*.5, canvas.height*.5, 0, 0, crop.width, crop.height
        );
        resolve(crop.toDataURL("image/jpeg", .9));
      } catch (e) { console.error(e); resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
function extractAverageRgb(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const size = APP_CONFIG.COLOR_SAMPLE_SIZE;
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        let rs=0,gs=0,bs=0,r2=0,g2=0,b2=0,n=0;
        for (let i=0;i<data.length;i+=4) {
          const r=data[i],g=data[i+1],b=data[i+2];
          rs+=r;gs+=g;bs+=b;r2+=r*r;g2+=g*g;b2+=b*b;n++;
        }
        const r=rs/n,g=gs/n,b=bs/n;
        const variance=(r2/n-r*r)+(g2/n-g*g)+(b2/n-b*b);
        resolve({r,g,b,stdDev:Math.sqrt(Math.max(0,variance/3))});
      } catch(e) { console.error(e); resolve(null); }
    };
    img.onerror=()=>resolve(null);
    img.src=dataUrl;
  });
}
window.canvasAdjustImage=canvasAdjustImage;
window.extractAverageRgb=extractAverageRgb;
