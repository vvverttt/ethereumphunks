#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

// Resolve deps from marketplace/ to avoid requiring a root-level install.
const marketplaceNodeModulesRoot = path.resolve(__dirname, 'marketplace');
const FormData = require(require.resolve('form-data', { paths: [marketplaceNodeModulesRoot] }));

// Configuration
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_API_SECRET = process.env.PINATA_API_SECRET;

function findLatestMainnetBrowserFolder() {
  // Prefer running from repo root; fall back to script dir if needed.
  const distRoot = path.resolve(process.cwd(), 'marketplace', 'dist');
  const fallbackDistRoot = path.resolve(__dirname, 'marketplace', 'dist');
  const root = fs.existsSync(distRoot) ? distRoot : fallbackDistRoot;

  if (!fs.existsSync(root)) {
    throw new Error(`Could not find dist folder at: ${root}`);
  }

  const candidates = fs
    .readdirSync(root, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith('etherphunks-market-mainnet_'))
    .map(d => path.join(root, d.name, 'browser'))
    .filter(p => fs.existsSync(p));

  if (!candidates.length) {
    throw new Error(`No mainnet build folders found under: ${root}`);
  }

  candidates.sort((a, b) => {
    const aTime = fs.statSync(a).mtimeMs;
    const bTime = fs.statSync(b).mtimeMs;
    return bTime - aTime;
  });

  return candidates[0];
}

const argFolder = process.argv[2];
const BROWSER_FOLDER =
  process.env.PINATA_FOLDER ||
  argFolder ||
  findLatestMainnetBrowserFolder();

if (!PINATA_API_KEY || !PINATA_API_SECRET) {
  console.error('Error: PINATA_API_KEY and PINATA_API_SECRET environment variables are required');
  console.error('Usage: node pin-to-pinata.js [absolute-or-relative-path-to-browser-folder]');
  console.error('Or set PINATA_FOLDER to override the auto-detected dist folder.');
  process.exit(1);
}

async function pinFolderToPinata() {
  try {
    console.log(`\n📌 Pinning folder to Pinata: ${BROWSER_FOLDER}\n`);

    // Create FormData and add all files from the browser folder
    const form = new FormData();
    
    function addFilesRecursively(dir, baseDir) {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const fullPath = path.join(dir, file);
        const relativePath = path.relative(baseDir, fullPath);
        
        if (fs.statSync(fullPath).isDirectory()) {
          addFilesRecursively(fullPath, baseDir);
        } else {
          form.append('file', fs.createReadStream(fullPath), { filepath: relativePath });
          console.log(`  ✓ Added: ${relativePath}`);
        }
      });
    }

    addFilesRecursively(BROWSER_FOLDER, BROWSER_FOLDER);

    // Upload to Pinata (streamed multipart)
    const headers = {
      ...form.getHeaders(),
      pinata_api_key: PINATA_API_KEY,
      pinata_secret_api_key: PINATA_API_SECRET,
    };

    const cid = await new Promise((resolve, reject) => {
      form.getLength((err, length) => {
        if (!err && Number.isFinite(length)) {
          headers['Content-Length'] = length;
        }

        const req = https.request(
          {
            method: 'POST',
            hostname: 'api.pinata.cloud',
            path: '/pinning/pinFileToIPFS',
            headers,
          },
          (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
              try {
                const json = JSON.parse(body || '{}');
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300 && json.IpfsHash) {
                  resolve(json.IpfsHash);
                  return;
                }
                reject(new Error(`Pinata error (${res.statusCode}): ${body}`));
              } catch (e) {
                reject(new Error(`Pinata non-JSON response (${res.statusCode}): ${body}`));
              }
            });
          }
        );

        req.on('error', reject);
        form.pipe(req);
      });
    });
    console.log(`\n✅ Successfully pinned to Pinata!`);
    console.log(`\n📍 IPFS Hash (CID): ${cid}`);
    console.log(`🌐 Access via: https://${cid}.ipfs.w3s.link`);
    console.log(`🌐 Or via: https://${cid}.ipfs.dweb.link`);
    console.log(`🌐 Or via .eth.limo: https://${cid}.ipfs.eth.limo\n`);

    return cid;
  } catch (error) {
    console.error('Error pinning to Pinata:', error.response?.data || error.message);
    process.exit(1);
  }
}

pinFolderToPinata();
