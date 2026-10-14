// backend/src/clients/llmClient.js
// Simple client for calling the VLLM inference endpoint.
// Returns { explanation, reply, usage } where usage includes modelMs and token count.
// In mock mode (no endpoint) returns a static placeholder.
const axios = require('axios');
const logger = require('pino')();

/**
 * Generate explanation and supplier reply via LLM.
 * @param {Object} params
 * @param {string} params.language - ISO language code (e.g., 'en', 'it', 'de').
 * @param {string} params.supplierName - Name of the supplier.
 * @param {Array} params.issues - Array of issue objects with a `message` field.
 * @param {Object} params.extracted - Extracted data from the document (used for invoice number, etc.).
 * @returns {Promise<{explanation:string, reply:string, usage:{totalTokens:number,modelMs:number}}>} 
 */
async function generate({ language, supplierName, issues, extracted }) {
  const endpoint = process.env.VLLM_ENDPOINT;
  const apiKey = process.env.VLLM_API_KEY;
  const model = process.env.VLLM_MODEL || 'llama2-70b';

  // If endpoint not configured, operate in mock mode.
  if (!endpoint) {
    logger.warn('VLLM_ENDPOINT not set – returning mock LLM response');
    const explanation = issues.map((i, idx) => `${idx + 1}. ${i.message}`).join('\n');
    const reply = `Dear ${supplierName},\n\nPlease address the issues listed.\n\nBest regards,\nAccounts Payable`;
    return { explanation, reply, usage: { totalTokens: null, modelMs: 0 } };
  }

  // Build prompt – ask LLM to produce JSON with fields explanation and reply.
  const issueList = issues.map((i, idx) => `${idx + 1}. ${i.message}`).join('\n');
  const prompt = `You are an AI assistant for a purchasing department. The supplier is "${supplierName}" and the document language is "${language}". The document (invoice ${extracted.invoiceNumber || ''}) has the following issues:\n${issueList}\n\nProduce a JSON object with two fields:\n- "explanation": a concise numbered explanation of each issue in plain language (same language if possible).\n- "reply": a polite draft email to the supplier in the same language, asking them to correct the issues.\nDo NOT perform any calculations. Return only valid JSON.`;

  const payload = {
    model,
    prompt,
    max_tokens: 800,
    stream: false
  };

  const headers = {
    'Content-Type': 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
  };

  const start = Date.now();
  const response = await axios.post(endpoint, payload, { headers });
  const modelMs = Date.now() - start;

  const data = response.data;
  let parsed;
  try {
    // Assume the model returns a JSON string in the first choice.
    const text = data.choices?.[0]?.text?.trim();
    parsed = JSON.parse(text);
  } catch (e) {
    logger.error({ err: e.message }, 'Failed to parse LLM JSON response, falling back to raw text');
    const text = data.choices?.[0]?.text || '';
    // Simple fallback split.
    const parts = text.split('\n\n');
    parsed = {
      explanation: parts[0] ? parts[0].trim() : '',
      reply: parts[1] ? parts[1].trim() : ''
    };
  }

  return {
    explanation: parsed.explanation || '',
    reply: parsed.reply || '',
    usage: {
      totalTokens: data.usage?.total_tokens || null,
      modelMs
    }
  };
}

module.exports = { generate };
