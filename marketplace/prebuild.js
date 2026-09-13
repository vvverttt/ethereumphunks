import moment from 'moment';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const timestamp = moment().format('MMMD').toLowerCase();
const angularJsonPath = path.join(__dirname, 'angular.json');

// Stamp today's date into appConfig so the footer reports which build is live.
const appConfigPath = path.join(__dirname, 'src', 'environments', 'app.ts');
const buildDate = moment().format('YYYY-MM-DD');
const appConfigSrc = fs.readFileSync(appConfigPath, 'utf8');
const stamped = appConfigSrc.replace(/buildDate: '[^']*'/, `buildDate: '${buildDate}'`);
if (stamped !== appConfigSrc) {
  fs.writeFileSync(appConfigPath, stamped);
  console.log(`Build date: ${buildDate}`);
}

let angularJson = JSON.parse(fs.readFileSync(angularJsonPath, 'utf8'));

// Update the outputPath for each configuration. mainnet-ipfs is dated too: it is the
// build that carries the bundled images, so it is the one that gets pinned, and the
// re-pin workflow picks a folder by date.
const folders = {
  sepolia: 'etherphunks-market-sepolia',
  mainnet: 'etherphunks-market-mainnet',
  'mainnet-ipfs': 'etherphunks-market-ipfs',
};

Object.entries(folders).forEach(([config, folder]) => {
  const basePath = `${folder}_${timestamp}`;
  angularJson.projects['etherphunks-market'].architect.build.configurations[config].outputPath.base = `dist/${basePath}`;

  console.log(`Output dir: ${basePath}`);
});

fs.writeFileSync(angularJsonPath, JSON.stringify(angularJson, null, 2));
