/* MRPL Safety Grid runtime configuration */
window.APP_CONFIG = Object.freeze({
  SUPABASE_URL: "https://uvbbzkjbnqaeyunwgljq.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmJ6a2pibnFhZXl1bndnbGpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4MjU0MjAsImV4cCI6MjEwMzQwMTQyMH0.eEJDBgt_QTaOUA9QjTvIOL86BK8-Jw3Wv3FAs7js1mU",
  SUPABASE_TABLE: "h2s_datas",
  SUPABASE_POLL_MS: 1000,
  COLOR_SAMPLE_SIZE: 48,
  CAMERA_CONSTRAINTS: {
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false
  }
});
