import wasmModule from '../logic.wasm'; // Linked via build process

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
      'Access-Control-Expose-Headers': 'Content-Length, X-Wasm-Version',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 1. Fetch Metadata
    if (path === '/v1/wasm/fetch') {
      const metadata = {
        version: env.WASM_VERSION || "1.1.0",
        wasm_url: `${url.origin}/v1/wasm/logic.wasm`,
        supported_patterns: ["email", "phone", "rrn", "address", "name", "credit-card"],
        mode: "direct-bundle",
        timestamp: new Date().toISOString()
      };
      return new Response(JSON.stringify(metadata), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Serve Wasm Binary: Delivered directly from the Worker bundle
    if (path === '/v1/wasm/logic.wasm') {
      return new Response(wasmModule, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/wasm',
          'X-Wasm-Version': env.WASM_VERSION || "1.1.0",
          'Cache-Control': 'public, max-age=31536000, immutable',
        }
      });
    }

    // 3. Hybrid Fallback (Server-side)
    if (path === '/v1/scrub' && request.method === 'POST') {
      try {
        const { text, config = {} } = await request.json();
        const scrubbed = hybridScrub(text, config);
        
        return new Response(JSON.stringify({ 
          scrubbed, 
          mode: "hybrid-fallback-worker",
          processed_at: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response("Privacy-Scrub Tooling API (Direct Bundle Mode) Active", { 
      status: 200,
      headers: corsHeaders
    });
  }
};

/**
 * Server-side Hybrid Fallback Logic
 * Matches the Rust-Wasm logic for consistency.
 */
function hybridScrub(text, config) {
  let result = text;
  
  const patterns = {
    email: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi,
    phone: /(\d{2,3}[-.\s]?\d{3,4}[-.\s]?\d{4})/g,
    rrn: /(\d{6}[-.\s]?[1-4]\d{6})/g
  };

  if (config.email !== false) result = result.replace(patterns.email, "[EMAIL]");
  if (config.phone !== false) result = result.replace(patterns.phone, "[PHONE]");
  if (config.rrn !== false) result = result.replace(patterns.rrn, "[RRN]");
  
  return result;
}
