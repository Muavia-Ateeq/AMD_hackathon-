// backend/src/services/evolusClient.js
// Isolated Evolus REST API client with retry backoff and mock support. Owned by Ammar

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const pino = require('pino');
const logger = pino();

// Centralized endpoint paths with TODO verification markers
const ENDPOINTS = {
  // TODO: verify against Evolus API reference
  WORKFLOW_EXECUTE: (workflowId) => `/workflows/${workflowId}/execute`,
  // TODO: verify against Evolus API reference
  WORKFLOW_STATUS: (executionId) => `/workflows/executions/${executionId}`,
  // TODO: verify against Evolus API reference
  AI_TOOL_RUN: (toolName) => `/ai-tools/${toolName}/run`,
  // TODO: verify against Evolus API reference
  AGENT_CHAT: '/chat/completions',
  // TODO: verify against Evolus API reference
  HEALTH_CHECK: '/health'
};

const EVOLUS_BASE_URL = process.env.EVOLUS_BASE_URL || 'https://api.evolus.ai/api/v1';
const EVOLUS_API_KEY = process.env.EVOLUS_API_KEY || '';
const EVOLUS_APPLICATION_ID = process.env.EVOLUS_APPLICATION_ID || '';
const EVOLUS_WORKFLOW_ID = process.env.EVOLUS_WORKFLOW_ID || 'default-workflow';
const EVOLUS_MODE = (process.env.EVOLUS_MODE || 'mock').toLowerCase();

/**
 * Escapes a string for safe use inside a RegExp.
 * Without this, a key containing metacharacters (e.g. "ab.cd+12") was not
 * redacted at all, and one containing "(" threw SyntaxError inside the catch
 * handler, replacing the real error entirely.
 */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Sanitizes errors to ensure API keys and sensitive tokens are never exposed.
 * @param {Error} error
 * @returns {Error}
 */
function sanitizeError(error) {
  let safeMessage = error.message || 'Evolus API error';

  // new RegExp('', 'g') is a valid zero-width pattern that matches between
  // every character. With no API key configured (the default in mock mode)
  // this shredded every message into unreadable "[REDACTED]" interleave.
  if (EVOLUS_API_KEY.length > 0) {
    safeMessage = safeMessage.replace(new RegExp(escapeRegExp(EVOLUS_API_KEY), 'g'), '[REDACTED_API_KEY]');
  }

  safeMessage = safeMessage
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/X-ApiKey:\s*[^\s,]+/gi, 'X-ApiKey: [REDACTED]');

  const safeError = new Error(safeMessage);
  safeError.status = error.response ? error.response.status : (error.status || 500);
  safeError.code = error.code || 'EVOLUS_API_ERROR';
  // Retain the upstream validation body, which is where the actionable detail
  // lives, but only after the message above has been scrubbed.
  if (error.response?.data) {
    safeError.responseData = error.response.data;
  }
  return safeError;
}

/**
 * Helper to execute an HTTP request with up to 2 retries on 5xx, 429, 408 or
 * network errors.
 * @param {Function} requestFn
 * @param {number} retries
 * @param {number} delayMs
 */
async function executeWithRetry(requestFn, retries = 2, delayMs = 1000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await requestFn();
    } catch (err) {
      const status = err.response?.status;
      const isNetworkError = !err.response;
      const is5xx = status >= 500 && status < 600;
      // 429 rate limiting and 408 request timeout are the two most likely
      // transient Evolus failures and were previously not retried at all.
      const isThrottled = status === 429 || status === 408;

      if ((isNetworkError || is5xx || isThrottled) && attempt < retries) {
        const nextDelay = delayMs * Math.pow(2, attempt);
        logger.warn({ attempt: attempt + 1, nextDelay, status }, 'Evolus API call failed, retrying...');
        await new Promise(res => setTimeout(res, nextDelay));
        continue;
      }

      throw sanitizeError(err);
    }
  }
}

/**
 * Creates configured Axios client with required headers.
 */
function getHttpClient() {
  return axios.create({
    baseURL: EVOLUS_BASE_URL,
    timeout: 30000,
    headers: {
      'X-ApiKey': EVOLUS_API_KEY,
      'X-Application-Id': EVOLUS_APPLICATION_ID
    }
  });
}

/**
 * 1. executeWorkflow
 * Starts a workflow with file, language, and optional callbackUrl.
 * @param {object} params
 * @param {string} params.filePath
 * @param {string} [params.language='en']
 * @param {string} [params.callbackUrl]
 * @returns {Promise<{ executionId: string, status: string }>}
 */
async function executeWorkflow({ filePath, language = 'en', callbackUrl = null }) {
  if (EVOLUS_MODE === 'mock') {
    logger.info({ filePath, callbackUrl }, 'Evolus mock mode: executeWorkflow');
    const fixturePath = path.resolve(__dirname, '../../fixtures/workflow_execution.json');
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    return {
      executionId: fixture.executionId,
      status: 'PENDING'
    };
  }

  return executeWithRetry(async () => {
    const client = getHttpClient();
    const form = new FormData();

    if (filePath && fs.existsSync(filePath)) {
      form.append('file', fs.createReadStream(filePath));
    }
    form.append('language', language);
    if (callbackUrl) {
      form.append('callbackUrl', callbackUrl);
    }

    // TODO: verify against Evolus API reference
    const url = ENDPOINTS.WORKFLOW_EXECUTE(EVOLUS_WORKFLOW_ID);
    const response = await client.post(url, form, {
      headers: form.getHeaders()
    });

    return response.data;
  });
}

/**
 * 2. getExecution
 * Retrieves the status and result of a workflow execution.
 * @param {string} executionId
 * @returns {Promise<object>}
 */
async function getExecution(executionId) {
  if (EVOLUS_MODE === 'mock') {
    logger.info({ executionId }, 'Evolus mock mode: getExecution');
    const fixturePath = path.resolve(__dirname, '../../fixtures/workflow_execution.json');
    return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  }

  return executeWithRetry(async () => {
    const client = getHttpClient();
    // TODO: verify against Evolus API reference
    const url = ENDPOINTS.WORKFLOW_STATUS(executionId);
    const response = await client.get(url);
    return response.data;
  });
}

/**
 * 3. runAiTool
 * Runs an Evolus AI Tool (e.g., PII redaction).
 * @param {string} toolName
 * @param {object|FormData} payload
 * @returns {Promise<object>}
 */
async function runAiTool(toolName, payload) {
  if (EVOLUS_MODE === 'mock') {
    logger.info({ toolName }, 'Evolus mock mode: runAiTool');
    const fixturePath = path.resolve(__dirname, '../../fixtures/ai_tool_redaction.json');
    return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  }

  return executeWithRetry(async () => {
    const client = getHttpClient();
    // TODO: verify against Evolus API reference
    const url = ENDPOINTS.AI_TOOL_RUN(toolName);

    const headers = payload instanceof FormData ? payload.getHeaders() : { 'Content-Type': 'application/json' };
    const response = await client.post(url, payload, { headers });
    return response.data;
  });
}

/**
 * 4. chatWithAgent
 * Communicates with an Evolus agent using OpenAI-compatible payload.
 * @param {Array<{ role: string, content: string }>} messages
 * @param {object} options
 * @returns {Promise<object>}
 */
async function chatWithAgent(messages, options = {}) {
  if (EVOLUS_MODE === 'mock') {
    logger.info('Evolus mock mode: chatWithAgent');
    const fixturePath = path.resolve(__dirname, '../../fixtures/agent_chat.json');
    return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  }

  return executeWithRetry(async () => {
    const client = getHttpClient();
    // TODO: verify against Evolus API reference
    const url = ENDPOINTS.AGENT_CHAT;
    const body = {
      messages,
      model: options.model || 'evolus-agent',
      temperature: options.temperature ?? 0.1,
      ...options
    };
    const response = await client.post(url, body, {
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data;
  });
}

/**
 * Health check ping for check_evolus.js script.
 */
async function checkHealth() {
  if (EVOLUS_MODE === 'mock') {
    return { status: 'ok', mode: 'mock' };
  }

  return executeWithRetry(async () => {
    const client = getHttpClient();
    // TODO: verify against Evolus API reference
    const url = ENDPOINTS.HEALTH_CHECK;
    const response = await client.get(url);
    return response.data;
  });
}

module.exports = {
  executeWorkflow,
  getExecution,
  runAiTool,
  chatWithAgent,
  checkHealth,
  ENDPOINTS,
  sanitizeError
};
