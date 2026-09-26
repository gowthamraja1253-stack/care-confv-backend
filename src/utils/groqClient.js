import https from 'https';

/**
 * Reliable Groq Chat Completion client using Node native HTTPS.
 * Avoids Node 22 Undici/global fetch TLS session reset (ECONNRESET) on Windows.
 */
export async function groqChatCompletion({
  apiKey,
  model,
  messages,
  temperature = 0.3,
  max_tokens = 450,
  timeoutMs = 25000,
}) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Groq API Key is missing or empty');
  }

  const postData = JSON.stringify({
    model,
    messages,
    temperature,
    max_tokens,
  });

  return new Promise((resolve, reject) => {
    const req = https.request('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'RuralHealthLink-Server/1.0',
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            const error = new Error(json.error?.message || `Groq API returned HTTP ${res.statusCode}`);
            error.statusCode = res.statusCode;
            error.data = json;
            reject(error);
          }
        } catch (e) {
          reject(new Error(`Failed to parse Groq response (${res.statusCode}): ${body.slice(0, 200)}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Groq API request timed out after ${timeoutMs}ms`));
    });

    req.write(postData);
    req.end();
  });
}

export default {
  groqChatCompletion,
};
