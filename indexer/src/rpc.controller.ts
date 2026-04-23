import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';

const ALLOWED_RPC_METHODS = new Set([
  'eth_blockNumber',
  'eth_call',
  'eth_chainId',
  'eth_estimateGas',
  'eth_feeHistory',
  'eth_gasPrice',
  'eth_getBalance',
  'eth_getBlockByNumber',
  'eth_getCode',
  'eth_getLogs',
  'eth_getStorageAt',
  'eth_getTransactionByHash',
  'eth_getTransactionCount',
  'eth_getTransactionReceipt',
  'net_version',
  'web3_clientVersion',
]);

type JsonRpcBody = {
  id?: number | string | null;
  jsonrpc?: string;
  method?: string;
  params?: unknown[];
};

function getRelayRpcUrl(): string {
  const backupUrls = (process.env.RPC_URL_MAINNET_BACKUP || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  return (
    process.env.RPC_URL_MAINNET_SERVER_FALLBACK ||
    process.env.RPC_URL_MAINNET_ALCHEMY ||
    process.env.ALCHEMY_RPC_URL ||
    process.env.RPC_URL_MAINNET_2 ||
    backupUrls.find((url) => url.includes('alchemy')) ||
    process.env.RPC_URL_MAINNET ||
    ''
  );
}

@Controller()
export class RpcController {
  @Post('rpc')
  async proxy(@Body() body: JsonRpcBody) {
    const method = body?.method || '';
    if (!ALLOWED_RPC_METHODS.has(method)) {
      throw new HttpException('Unsupported RPC method', HttpStatus.BAD_REQUEST);
    }

    const rpcUrl = getRelayRpcUrl();
    if (!rpcUrl) {
      throw new HttpException('RPC relay unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: body?.id ?? 1,
        jsonrpc: body?.jsonrpc || '2.0',
        method,
        params: body?.params || [],
      }),
    });

    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { error: { message: text || 'Invalid RPC response' } };
    }

    if (!response.ok) {
      throw new HttpException(payload || 'RPC relay request failed', response.status);
    }

    return payload;
  }
}
