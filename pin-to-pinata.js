#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// Configuration
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_API_SECRET = process.env.PINATA_API_SECRET;
const BROWSER_FOLDER = 'C:\\Users\\alber\\OneDrive\\Desktop\\market\\ethereumphunks\\marketplace\\dist\\etherphunks-market-mainnet_may7\\browser';

if (!PINATA_API_KEY || !PINATA_API_SECRET) {
  console.error('Error: PINATA_API_KEY and PINATA_API_SECRET environment variables are required');
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

    // Upload to Pinata
    const response = await axios({
      method: 'post',
      url: 'https://api.pinata.cloud/pinning/pinFileToIPFS',
      data: form,
      maxBodyLength: Infinity,
      headers: {
        ...form.getHeaders(),
        pinata_api_key: PINATA_API_KEY,
        pinata_secret_api_key: PINATA_API_SECRET,
      },
    });

    const cid = response.data.IpfsHash;
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
