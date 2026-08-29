/* Browser camera service */
function cameraSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}
async function openEnvironmentCamera(videoElement, constraints) {
  if (!cameraSupported()) throw new Error("Camera API unavailable");
  const stream = await navigator.mediaDevices.getUserMedia(
    constraints || APP_CONFIG.CAMERA_CONSTRAINTS
  );
  videoElement.srcObject = stream;
  return stream;
}
function stopCameraStream(stream, videoElement) {
  if (stream) stream.getTracks().forEach(track => track.stop());
  if (videoElement) videoElement.srcObject = null;
}
window.cameraSupported = cameraSupported;
window.openEnvironmentCamera = openEnvironmentCamera;
window.stopCameraStream = stopCameraStream;
