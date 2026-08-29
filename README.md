# H₂S Safety Grid

A real-time worker safety monitoring system designed for hazardous environments. The system monitors H₂S exposure, provides safety alerts, and presents worker and exposure information through a web-based dashboard.

## Features

- Real-time H₂S exposure monitoring
- Worker-wise safety status tracking
- Short-term and cumulative exposure monitoring
- Instant safety alerts when thresholds are exceeded
- Exposure history and time-based monitoring
- Supervisor dashboard for monitoring multiple workers
- Barcode-based worker identification
- Camera and image-processing support
- Supabase integration for storing and retrieving live data
- Responsive web-based interface

## Frontend structure

```text
frontend/
├── index.html
├── css/style.css
└── js/
    ├── config.js
    ├── app.js
    └── services/
        ├── supabase-service.js
        ├── camera-service.js
        ├── barcode-service.js
        └── canvas-service.js
```

`.env.example` documents build/deployment configuration. Plain static browser JavaScript cannot read `.env` directly, so `config.js` is used for this static build.

The complete Arduino/ESP32 firmware was not present in the supplied source and has not been fabricated.
