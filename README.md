# MRPL Safety Grid — Final Integrated Project

## Run in VS Code

Open this folder in VS Code and right-click either:
- `index.html` at the project root, or
- `frontend/index.html`

Choose **Open with Live Server**.

The root `index.html` redirects to the real application in `frontend/index.html`.

## Stack

HTML5, CSS3, Vanilla JavaScript, Supabase JS/PostgreSQL, MediaDevices API, BarcodeDetector/jsQR, Canvas API, local/session storage, and the Arduino/ESP32 sensor layer.

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
