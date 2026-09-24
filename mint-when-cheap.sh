#!/usr/bin/env bash
# Wait for baseFee to fall under the cap, then mint — one token first as a live test,
# and only then the rest. mint-v67.mjs skips anything already minted, so every step
# here is safe to repeat and nothing is ever minted twice.
set -u
cd "$(dirname "$0")"

CAP=${MAX_GWEI:-0.09}
TO=0x702862d4cb2E55452170814AAb9117cDE8287e61
export OUT=./v67_new1066 URIS=dataURIs-1054.json MAX_GWEI="$CAP"

gas() {
  node -e "
const {JsonRpcProvider,formatUnits}=require('./contracts/node_modules/ethers');
new JsonRpcProvider('https://ethereum-rpc.publicnode.com',1,{staticNetwork:true})
 .getBlock('latest').then(b=>console.log(Number(formatUnits(b.baseFeePerGas,'gwei')).toFixed(4)));"
}

echo "waiting for baseFee <= $CAP gwei (checking every 60s)"
while :; do
  g=$(gas)
  if awk "BEGIN{exit !($g <= $CAP)}"; then
    echo "$(date -u +%H:%M:%S)  baseFee $g — go"
    break
  fi
  echo "$(date -u +%H:%M:%S)  baseFee $g — waiting"
  sleep 60
done

echo ""
echo "=== test mint: 1 token ==="
RUN=1 node mint-v67.mjs --to "$TO" --limit 1 2>&1 | tr -d '\r' | grep -v "already minted… [0-9]"

# Only continue if that single token really landed with the destination.
minted=$(node -e "
const {JsonRpcProvider,Contract}=require('./contracts/node_modules/ethers');
const p=new JsonRpcProvider('https://ethereum-rpc.publicnode.com',1,{staticNetwork:true});
new Contract('0x67B850C3C8790cc7ec76261b65fde60eFb6F1fe3',['function ownerOf(uint256) view returns (address)'],p)
 .ownerOf(4).then(o=>console.log(o.toLowerCase())).catch(()=>console.log('none'));")

if [ "$minted" != "$(echo $TO | tr 'A-Z' 'a-z')" ]; then
  echo ""
  echo "STOP: test token #4 is not held by the lottery (ownerOf = $minted)."
  echo "Not sending the remaining batches."
  exit 1
fi
echo ""
echo "test ok — #4 is held by the lottery. minting the rest."
echo ""

echo "=== full mint ==="
RUN=1 node mint-v67.mjs --to "$TO" 2>&1 | tr -d '\r' | grep -v "already minted… [0-9]"
