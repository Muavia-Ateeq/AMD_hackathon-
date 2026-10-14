// backend/scripts/check_vllm.js
// Verification script for AMD Developer Cloud vLLM ROCm endpoint. Owned by Muawia & Ammar

require('dotenv').config();
const axios = require('axios');

const VLLM_BASE_URL = process.env.VLLM_BASE_URL || 'http://localhost:8000/v1';
const VLLM_API_KEY = process.env.VLLM_API_KEY || 'token-not-set';
const VLLM_MODEL = process.env.VLLM_MODEL || 'meta-llama/Llama-2-70b-chat-hf';

async function checkVllm() {
  console.log('====================================================');
  console.log('AMD Developer Cloud vLLM (ROCm) Endpoint Health Check');
  console.log('====================================================');
  console.log(`Endpoint URL : ${VLLM_BASE_URL}/chat/completions`);
  console.log(`Model ID     : ${VLLM_MODEL}`);
  console.log('----------------------------------------------------');

  const client = axios.create({
    baseURL: VLLM_BASE_URL,
    timeout: 30000,
    headers: {
      Authorization: `Bearer ${VLLM_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  let test1Passed = false;
  let test2Passed = false;

  // Test 1: Basic connectivity & token generation speed
  try {
    process.stdout.write('Test 1: Chat Completion Connectivity & Speed... ');
    const t0 = Date.now();
    const response = await client.post('/chat/completions', {
      model: VLLM_MODEL,
      messages: [
        { role: 'user', content: 'Reply with the single word: READY' }
      ],
      max_tokens: 10,
      temperature: 0.1
    });
    const latencyMs = Date.now() - t0;
    const choice = response.data.choices?.[0]?.message?.content?.trim();
    const usage = response.data.usage;

    console.log('[OK]');
    console.log(`  Response Content : "${choice}"`);
    console.log(`  Latency          : ${latencyMs} ms`);

    if (usage && usage.completion_tokens) {
      const tokensPerSec = ((usage.completion_tokens / latencyMs) * 1000).toFixed(1);
      console.log(`  Tokens / Second  : ${tokensPerSec} tps (${usage.completion_tokens} tokens)`);
    }

    test1Passed = true;
  } catch (err) {
    console.log('[FAIL]');
    console.error(`  Error: ${err.response?.data?.error?.message || err.message}`);
  }

  // Test 2: Structured JSON extraction generation
  try {
    process.stdout.write('Test 2: Structured JSON Output Verification... ');
    const t0 = Date.now();
    const response = await client.post('/chat/completions', {
      model: VLLM_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are an extraction assistant. You must respond in valid JSON only with keys: "status", "ready".'
        },
        {
          role: 'user',
          content: 'Return JSON confirming readiness.'
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 50,
      temperature: 0.0
    });
    const latencyMs = Date.now() - t0;
    const rawContent = response.data.choices?.[0]?.message?.content?.trim();

    let parsed = null;
    try {
      parsed = JSON.parse(rawContent);
    } catch (_) {
      // attempt regex extraction if wrapped in code blocks
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    }

    if (parsed && typeof parsed === 'object') {
      console.log('[OK]');
      console.log(`  Parsed JSON      : ${JSON.stringify(parsed)}`);
      console.log(`  Latency          : ${latencyMs} ms`);
      test2Passed = true;
    } else {
      console.log('[FAIL]');
      console.error(`  Output was not valid JSON: "${rawContent}"`);
    }
  } catch (err) {
    console.log('[FAIL]');
    console.error(`  Error: ${err.response?.data?.error?.message || err.message}`);
  }

  console.log('----------------------------------------------------');
  if (test1Passed && test2Passed) {
    console.log('OVERALL STATUS: [PASS] - AMD GPU vLLM endpoint is ready for production.');
    process.exit(0);
  } else {
    console.log('OVERALL STATUS: [FAIL] - One or more tests failed. Check endpoint configuration.');
    process.exit(1);
  }
}

if (require.main === module) {
  checkVllm();
}

module.exports = { checkVllm };
