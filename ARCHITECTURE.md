# Architecture

```text
H2S / environment sensors
        ↓
Arduino / ESP32
        ↓
Supabase PostgreSQL
        ↓
supabase-service.js
        ↓
app.js
        ↓
Worker / Supervisor dashboards

Camera
  ↓
camera-service.js
  ↓
barcode-service.js OR canvas-service.js
  ↓
app.js
```

Each browser-facing subsystem now has its own JavaScript module. `app.js` remains the application orchestrator.
