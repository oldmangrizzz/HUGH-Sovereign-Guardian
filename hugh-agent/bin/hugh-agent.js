#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const fs = require('fs');
const { startServer } = require('../src/server');
const { setupModels } = require('../src/models');

program
  .name('hugh-agent')
  .description('H.U.G.H. Holographic Satellite Node CLI')
  .version('1.0.0');

program
  .command('setup')
  .description('Download and setup the local model cognitive stack')
  .action(async () => {
    require('dotenv').config();
    await setupModels({});
  });

program
  .command('start')
  .description('Start the satellite node agent')
  .option('-p, --port <number>', 'Port to listen on', process.env.PORT || 7734)
  .option('-s, --secret <string>', 'Agent secret for authentication', process.env.KVM_AGENT_SECRET)
  .option('-n, --node-id <string>', 'Unique ID for this node', process.env.NODE_ID)
  .option('-l, --label <string>', 'Human readable label for this node', process.env.NODE_LABEL)
  .option('-t, --tunnel', 'Spontaneously create a Cloudflare tunnel', false)
  .option('-d, --domain <string>', 'Custom domain for tunnel (requires CF credentials)', process.env.TUNNEL_DOMAIN || 'GrizzlyMedicine.ICU')
  .option('--convex-url <string>', 'Convex deployment URL', process.env.CONVEX_URL)
  .option('--convex-site-url <string>', 'Convex site URL for HTTP actions', process.env.CONVEX_SITE_URL)
  .action(async (options) => {
    // Load .env if it exists in current or home dir
    require('dotenv').config();
    
    const config = {
      port: parseInt(options.port),
      secret: options.secret || process.env.KVM_AGENT_SECRET || 'changeme',
      nodeId: options.nodeId || process.env.NODE_ID || require('os').hostname(),
      label: options.label || process.env.NODE_LABEL || require('os').hostname(),
      useTunnel: options.tunnel || process.env.USE_TUNNEL === 'true',
      domain: options.domain,
      convexUrl: options.convexUrl || process.env.CONVEX_URL,
      convexSiteUrl: options.convexSiteUrl || process.env.CONVEX_SITE_URL
    };

    if (config.secret === 'changeme') {
      console.warn('⚠️ Warning: Using default secret. Please set KVM_AGENT_SECRET.');
    }

    if (!config.convexSiteUrl && config.convexUrl) {
      // Try to derive site URL from deployment URL if not provided
      // e.g. https://laudable-minnow-323.convex.cloud -> https://laudable-minnow-323.convex.site
      config.convexSiteUrl = config.convexUrl.replace('.cloud', '.site');
    }

    startServer(config);
  });

program.parse();
