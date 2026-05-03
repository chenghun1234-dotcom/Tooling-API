/**
 * Privacy-Scrub Dashboard Logic (v1.1.0)
 * Implements the "Tooling API" model: Fetching and executing Rust-Wasm on-device.
 */

class PrivacyEngine {
    constructor() {
        this.isWasmLoaded = false;
        this.workerUrl = "https://toolingapi.chenghun1234.workers.dev"; // Production Worker URL
        this.wasmInstance = null;
        this.isFallback = false;
        
        // JS Fallback Patterns (Used if Wasm fails to load or for basic validation)
        this.fallbackPatterns = [
            { id: 'email', regex: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, mask: '[EMAIL]' },
            { id: 'phone', regex: /(\d{2,3}[-.\s]?\d{3,4}[-.\s]?\d{4})/g, mask: '[PHONE]' },
            { id: 'rrn', regex: /(\d{6}[-.\s]?[1-4]\d{6})/g, mask: '[RRN]' }
        ];
    }

    /**
     * Initialize the Wasm Engine by fetching it from the Tooling API (Worker)
     */
    async init() {
        console.log("🚀 Initializing Privacy Engine from Tooling API...");
        
        try {
            // 1. Fetch Metadata
            const metaRes = await fetch(`${this.workerUrl}/v1/wasm/fetch`);
            if (!metaRes.ok) throw new Error("Metadata fetch failed");
            const metadata = await metaRes.json();
            console.log("📦 Loaded Wasm Metadata:", metadata);

            // 2. Load Wasm Logic via wasm-bindgen glue
            // We expect the glue JS to be available at /pkg/wasm_engine.js
            const { default: initWasm, scrub_text_custom } = await import('./pkg/wasm_engine.js');
            
            // Initialize the Wasm module with the binary URL from Worker
            await initWasm(metadata.wasm_url);

            this.wasmInstance = { scrub_text_custom };
            this.isWasmLoaded = true;
            console.log("✅ Wasm Engine Ready (v" + metadata.version + ")");
            return true;
        } catch (err) {
            console.warn("⚠️ Wasm Load Failed. Falling back to JS Engine.", err);
            this.isFallback = true;
            this.isWasmLoaded = true;
            return false;
        }
    }

    /**
     * Scrub text using the high-performance Wasm logic
     */
    scrub(text, config) {
        if (!this.isWasmLoaded) throw new Error("Engine not initialized");

        if (this.isFallback) {
            return this.jsScrub(text, config);
        }

        try {
            const configJson = JSON.stringify(config);
            // Execute the Rust logic
            const resultJson = this.wasmInstance.scrub_text_custom(text, configJson);
            const result = JSON.parse(resultJson);

            return { 
                scrubbed: result.scrubbed_text, 
                piiCount: result.pii_count, 
                categories: result.categories,
                engine: "Rust-Wasm (Edge)"
            };
        } catch (err) {
            console.error("Wasm execution error, falling back:", err);
            return this.jsScrub(text, config);
        }
    }

    jsScrub(text, config) {
        let piiCount = 0;
        let resultText = text;
        let detectedCategories = [];

        this.fallbackPatterns.forEach(p => {
            const shouldMask = config[p.id] !== false;
            const matches = text.match(p.regex);
            if (matches) {
                piiCount += matches.length;
                if (shouldMask) resultText = resultText.replace(p.regex, p.mask);
                detectedCategories.push(p.id);
            }
        });

        return { 
            scrubbed: resultText, 
            piiCount, 
            categories: [...new Set(detectedCategories)],
            engine: this.isFallback ? "JavaScript (Fallback)" : "Rust-Wasm (Edge)"
        };
    }
}

// UI Controller
document.addEventListener('DOMContentLoaded', () => {
    const engine = new PrivacyEngine();
    
    // DOM Elements
    const elements = {
        input: document.getElementById('input-text'),
        output: document.getElementById('output-text'),
        btnScrub: document.getElementById('btn-scrub'),
        btnLoad: document.getElementById('btn-load-wasm'),
        statusBadge: document.getElementById('wasm-status'),
        piiCount: document.getElementById('pii-count'),
        latency: document.getElementById('latency')
    };

    const configs = {
        email: document.getElementById('cfg-email'),
        phone: document.getElementById('cfg-phone'),
        rrn: document.getElementById('cfg-rrn'),
        address: document.getElementById('cfg-address'),
        name: document.getElementById('cfg-name'),
        card: document.getElementById('cfg-card')
    };

    elements.btnLoad.addEventListener('click', async () => {
        elements.btnLoad.disabled = true;
        elements.btnLoad.innerHTML = '<i data-lucide="refresh-cw" class="spin"></i> Loading Engine...';
        
        const success = await engine.init();

        elements.statusBadge.classList.add('status-active');
        elements.statusBadge.innerHTML = `<span class="dot"></span> ${engine.isFallback ? 'JS Fallback Active' : 'Wasm Engine Ready'}`;
        elements.btnLoad.innerHTML = `<i data-lucide="${success ? 'check-circle' : 'alert-circle'}"></i> ${success ? 'Engine Loaded' : 'Fallback Active'}`;
        elements.btnLoad.classList.add(success ? 'btn-success' : 'btn-warning');
    });

    elements.btnScrub.addEventListener('click', () => {
        const text = elements.input.value.trim();
        if (!text) return;

        if (!engine.isWasmLoaded) {
            alert("Please initialize the Engine first.");
            return;
        }

        const currentConfig = {
            mask_email: configs.email.checked,
            mask_phone: configs.phone.checked,
            mask_rrn: configs.rrn.checked,
            mask_address: configs.address.checked,
            mask_name: configs.name.checked,
            mask_credit_card: configs.card.checked,
            mask_ip: true, // Hidden defaults
            mask_passport: true
        };

        const start = performance.now();
        const { scrubbed, piiCount, engine: usedEngine } = engine.scrub(text, currentConfig);
        const end = performance.now();

        elements.output.textContent = scrubbed;
        elements.output.classList.remove('placeholder');
        elements.piiCount.textContent = piiCount;
        elements.latency.textContent = `${(end - start).toFixed(2)}ms`;
        
        console.log(`[${usedEngine}] Scrubbing completed in ${(end - start).toFixed(4)}ms`);
    });
});
