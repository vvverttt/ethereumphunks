require('dotenv').config();
const fs=require('fs'),path=require('path');const {ethers}=require('ethers');
const ART=path.join(process.env.TEMP,'ethereumphunks-hardhat','artifacts');
const dbg=JSON.parse(fs.readFileSync(path.join(ART,'@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol/ERC1967Proxy.dbg.json'),'utf8'));
const bi=JSON.parse(fs.readFileSync(path.join(ART,'@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol',dbg.buildInfo),'utf8'));
const KEY=process.env.ETHERSCAN_API_KEY||process.env.ETHERSCAN_KEY;
const PROXY='0xE3C8d1cf63456535Ad41E47932AF1Fe1708E84C2', IMPL='0xac0dac97C04cEf01F93D5085266F8C5754781d33';
const args=require(path.join(process.env.TEMP,'proxy-args.js'));
const ctor=ethers.AbiCoder.defaultAbiCoder().encode(['address','bytes'],args).slice(2);
const api='https://api.etherscan.io/v2/api?chainid=1';
async function post(params){const r=await fetch(api,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...params,apikey:KEY})});return r.json();}
async function get(params){const r=await fetch(api+'&'+new URLSearchParams({...params,apikey:KEY}));return r.json();}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  console.log('solc',bi.solcLongVersion);
  // keep only sources needed? Etherscan accepts the full standard-json input.
  let r=await post({module:'contract',action:'verifysourcecode',contractaddress:PROXY,sourceCode:JSON.stringify(bi.input),codeformat:'solidity-standard-json-input',contractname:'@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy',compilerversion:'v'+bi.solcLongVersion,constructorArguements:ctor});
  console.log('submit:',r.status,r.result);
  if(r.status==='1'){for(let i=0;i<20;i++){await sleep(5000);const s=await get({module:'contract',action:'checkverifystatus',guid:r.result});console.log('status:',s.result);if(!/Pending/i.test(s.result))break;}}
  r=await post({module:'contract',action:'verifyproxycontract',address:PROXY,expectedimplementation:IMPL});
  console.log('proxy link submit:',r.status,r.result);
  if(r.status==='1'){for(let i=0;i<12;i++){await sleep(5000);const s=await get({module:'contract',action:'checkproxyverification',guid:r.result});console.log('proxy link:',s.result);if(!/pending|in progress/i.test(s.result))break;}}
})().catch(e=>{console.error(e.message);process.exit(1)});
