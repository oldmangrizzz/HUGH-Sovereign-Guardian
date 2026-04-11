const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Downloads a file from a URL to a local path.
 */
async function downloadFile(url, targetPath, label) {
  const writer = fs.createWriteStream(targetPath);
  
  console.log(`[hugh-agent] Initiating download: ${label}...`);
  
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  });

  const totalLength = response.headers['content-length'];
  let downloadedLength = 0;

  response.data.on('data', (chunk) => {
    downloadedLength += chunk.length;
    if (totalLength) {
      const percent = Math.round((downloadedLength / totalLength) * 100);
      if (percent % 10 === 0) {
        process.stdout.write(`\r[hugh-agent] ${label}: ${percent}% `);
      }
    }
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      console.log(`\n[hugh-agent] ${label} download complete.`);
      resolve();
    });
    writer.on('error', reject);
  });
}

/**
 * Downloads and sets up the local model stack.
 */
async function setupModels(config) {
  const modelDir = path.join(process.env.HOME || '/root', '.hugh-models');
  if (!fs.existsSync(modelDir)) {
    fs.mkdirSync(modelDir, { recursive: true });
  }

  // NOTE: These URLs must be provided by Grizzly Medicine Lab
  const models = [
    { 
      name: 'thinking', 
      filename: 'lmf-2.5-thinking-opus-4.6-heretic-distill.gguf', 
      url: process.env.MODEL_URL_THINKING || 'https://huggingface.co/DavidAU/LFM2.5-1.2B-Thinking-Claude-4.6-Opus-Heretic-Uncensored-DISTILL/resolve/main/LFM2.5-1.2B-Thinking-Claude-4.6-Opus-Heretic-Uncensored-DISTILL.Q8_0.gguf'
    },
    { 
      name: 'audio',    
      filename: 'lfm-audio.bin',                                 
      url: process.env.MODEL_URL_AUDIO 
    },
    { 
      name: 'vision',   
      filename: 'kmfo-vision.gguf',                              
      url: process.env.MODEL_URL_VISION 
    }
  ];

  for (const model of models) {
    const filePath = path.join(modelDir, model.filename);
    if (fs.existsSync(filePath)) {
      console.log(`[hugh-agent] Model ${model.name} already exists. Skipping.`);
      continue;
    }

    if (!model.url) {
      console.warn(`[hugh-agent] No URL provided for ${model.name}. Set MODEL_URL_${model.name.toUpperCase()} in .env`);
      continue;
    }

    try {
      await downloadFile(model.url, filePath, model.name);
    } catch (err) {
      console.error(`[hugh-agent] Failed to download ${model.name}: ${err.message}`);
    }
  }

  console.log('[hugh-agent] Model setup process complete.');
}

module.exports = { setupModels };
