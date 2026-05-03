# Privacy-Scrub: Wasm-Based Tooling API

This repository contains the implementation of a high-performance PII (Personally Identifiable Information) de-identification system designed for "Zero-Knowledge" client-side processing.

## 🚀 Key Concept: The "Tooling API" Model

Unlike traditional APIs that process data on the server, **Privacy-Scrub** delivers the logic (via Wasm) to the client. This ensures:
- **Maximum Privacy**: Sensitive data is masked *before* it leaves the browser/app.
- **Zero Egress Cost**: Using Cloudflare R2's free data transfer.
- **Deterministic Reliability**: Rust-based regex matching ensures consistent results across all platforms.

## 📁 Project Structure

- `wasm-engine/`: Rust source code for the Wasm masking logic.
- `worker/`: Cloudflare Worker that serves the Wasm module and provides a hybrid fallback API.
- `dashboard/`: A premium, glassmorphic demonstration interface.

## 🛠 Setup & Deployment

### 1. Build the Wasm Engine
Requires `wasm-pack`.
```bash
cd wasm-engine
wasm-pack build --target web
```
Upload the resulting `.wasm` file to your Cloudflare R2 bucket.

### 2. Deploy the Worker
```bash
cd worker
npm install
wrangler deploy
```

### 3. Run the Dashboard
Open `dashboard/index.html` in any modern browser.

## 📋 API Specification

### Fetch Wasm Metadata
`GET /v1/wasm/fetch`
Returns the latest version, binary URL, and supported patterns.

### Hybrid Fallback (Server-side)
`POST /v1/scrub`
```json
{
  "text": "My phone is 010-1234-5678"
}
```
Returns:
```json
{
  "scrubbed": "My phone is [PHONE]",
  "mode": "hybrid-fallback"
}
```

## 🔒 Security
This engine focuses on:
- Email addresses
- Phone numbers (KR/International)
- Korean Resident Registration Numbers (RRN)
- Credit Card numbers
- IP Addresses
