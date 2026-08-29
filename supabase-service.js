/* Supabase data service */
const supabaseClient = window.supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
);

async function loadLiveSupabaseData() {
  try {
    const { data, error } = await supabaseClient
      .from(APP_CONFIG.SUPABASE_TABLE).select("*")
      .order("created_at", { ascending: false }).limit(1);

    if (error) {
      console.error("Supabase error:", error);
      const el = document.getElementById("live-status");
      if (el) el.textContent = "DATABASE ERROR";
      return;
    }
    if (!data || !data.length) {
      const el = document.getElementById("live-status");
      if (el) el.textContent = "NO SENSOR DATA";
      return;
    }

    const sensor = data[0];
    supervisorFlowPpm = Number(sensor.h2s);
    if (!Number.isFinite(supervisorFlowPpm)) supervisorFlowPpm = null;

    supervisorFlowRecord = {
      adc: sensor.adc, temp: sensor.temp,
      humidity: sensor.humidity, status: sensor.status || "UNKNOWN"
    };

    const ts = Date.parse(sensor.created_at);
    recordSupervisorSample(
      supervisorFlowPpm,
      Number.isFinite(ts) ? ts : Date.now(),
      String(sensor.id || sensor.created_at || ts)
    );

    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };
    const h2s = document.getElementById("live-h2s");
    if (h2s) h2s.innerHTML = (sensor.h2s ?? "--") + "<span> ppm</span>";
    set("live-adc", sensor.adc ?? "--");
    set("live-temp", sensor.temp ?? "--");
    set("live-humidity", sensor.humidity ?? "--");
    set("live-status", sensor.status ?? "UNKNOWN");
    const time = new Date(sensor.created_at);
    set("live-time", "Last update: " +
      (Number.isNaN(time.getTime()) ? "Unknown" : time.toLocaleString()));
  } catch (err) {
    console.error("Live data error:", err);
    const el = document.getElementById("live-status");
    if (el) el.textContent = "CONNECTION ERROR";
  }
}

window.loadLiveSupabaseData = loadLiveSupabaseData;
document.addEventListener("DOMContentLoaded", () => {
  loadLiveSupabaseData();
  setInterval(loadLiveSupabaseData, APP_CONFIG.SUPABASE_POLL_MS);
});
