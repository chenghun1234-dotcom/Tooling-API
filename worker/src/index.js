/**
 * Privacy-Scrub Worker (v1.1.0)
 * Serves Wasm modules and provides Hybrid Fallback API.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Enhanced CORS Headers for Tooling API delivery
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
      'Access-Control-Expose-Headers': 'Content-Length, X-Wasm-Version',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 1. Fetch Metadata: Informs the client where to find the latest Wasm logic
    if (path === '/v1/wasm/fetch') {
      const metadata = {
        version: env.WASM_VERSION || "1.0.0",
        wasm_url: `${url.origin}/v1/wasm/logic.wasm`,
        supported_patterns: ["email", "phone", "kr-rrn", "credit-card", "ip", "address", "name"],
        checksum: "sha256:7e4e892c...", // Should be dynamically generated in production
        timestamp: new Date().toISOString()
      };
      return new Response(JSON.stringify(metadata), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Serve Wasm Binary: Delivered to client for on-device execution
    if (path === '/v1/wasm/logic.wasm') {
      const version = env.WASM_VERSION || "1.0.0";
      const objectName = `logic-${version}.wasm`;
      
      // Cache-Control is critical for "Tooling API" performance
      const cache = caches.default;
      let response = await cache.match(request);
      if (response) return response;

      // Try fetching from R2 (if bound)
      try {
        if (!env.WASM_BUCKET) {
           return new Response("Wasm storage not yet configured", { status: 503, headers: corsHeaders });
        }
        const object = await env.WASM_BUCKET.get(objectName);
        if (!object) {
          return new Response("Wasm module not found in storage", { 
            status: 404, 
            headers: corsHeaders 
          });
        }

        response = new Response(object.body, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/wasm',
            'X-Wasm-Version': version,
            'Cache-Control': 'public, max-age=31536000, immutable',
          }
        });

        ctx.waitUntil(cache.put(request, response.clone()));
        return response;
      } catch (err) {
        return new Response("Storage error: " + err.message, { status: 500, headers: corsHeaders });
      }
    }

    // 3. Hybrid Fallback: For clients that cannot run Wasm locally
    if (path === '/v1/scrub' && request.method === 'POST') {
      try {
        const { text, config = {} } = await request.json();
        
        // Server-side scrubbing logic
        // In production, we'd use the same Wasm module via Worker Wasm imports
        // for 100% deterministic results between client and server.
        const scrubbed = hybridScrub(text, config);
        
        return new Response(JSON.stringify({ 
          scrubbed, 
          mode: "hybrid-fallback",
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

    return new Response("Privacy-Scrub Tooling API Gateway Active", { 
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
