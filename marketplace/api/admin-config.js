import { createClient } from '@supabase/supabase-js';
import { createPublicClient, http, isAddress, parseAbi } from 'viem';
import { recoverMessageAddress } from 'viem/accounts';

const OWNER_ABI = parseAbi([
  'function owner() view returns (address)',
]);

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }

  return JSON.stringify(value);
}

function hashString(input) {
  let hash = 2166136261;

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return `fnv1a_${(hash >>> 0).toString(16)}`;
}

function buildAdminConfigMessage(auth) {
  return [
    'EtherPhunks Admin Config Update',
    `Address: ${auth.address}`,
    `Network: ${auth.network}`,
    `Payload Hash: ${auth.payloadHash}`,
    `Issued At: ${auth.issuedAt}`,
    `Expires At: ${auth.expiresAt}`,
    '',
    'Signing this message does not cost gas.',
  ].join('\n');
}

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminRpcHttpProvider = process.env.ADMIN_RPC_HTTP_PROVIDER;
  const adminMarketAddress = process.env.ADMIN_MARKET_ADDRESS;
  const adminChainId = process.env.ADMIN_CHAIN_ID ? Number(process.env.ADMIN_CHAIN_ID) : null;

  if (!supabaseUrl || !supabaseServiceRoleKey || !adminRpcHttpProvider || !adminMarketAddress) {
    return json(res, 500, { error: 'Missing admin config environment variables' });
  }

  try {
    const { auth, updates, signature } = req.body || {};

    if (!auth || !updates || !signature) {
      return json(res, 400, { error: 'Missing auth, updates, or signature' });
    }

    if (!isAddress(auth.address)) {
      return json(res, 400, { error: 'Invalid admin address' });
    }

    if (!Number.isInteger(auth.network)) {
      return json(res, 400, { error: 'Invalid admin network' });
    }

    if (adminChainId !== null && auth.network !== adminChainId) {
      return json(res, 400, { error: `Wrong admin network for this deployment: ${auth.network}` });
    }

    const now = Date.now();
    if (!Number.isFinite(auth.issuedAt) || !Number.isFinite(auth.expiresAt)) {
      return json(res, 400, { error: 'Invalid auth timestamps' });
    }

    if (auth.expiresAt < now) {
      return json(res, 401, { error: 'Admin signature expired' });
    }

    if (auth.issuedAt > now + 60_000) {
      return json(res, 401, { error: 'Admin signature issued in the future' });
    }

    const expectedPayloadHash = hashString(stableStringify(updates));
    if (auth.payloadHash !== expectedPayloadHash) {
      return json(res, 400, { error: 'Payload hash mismatch' });
    }

    const expectedMessage = buildAdminConfigMessage(auth);
    const recoveredAddress = await recoverMessageAddress({
      message: expectedMessage,
      signature,
    });

    if (recoveredAddress.toLowerCase() !== auth.address.toLowerCase()) {
      return json(res, 401, { error: 'Signature does not match admin wallet' });
    }

    const publicClient = createPublicClient({
      transport: http(adminRpcHttpProvider),
    });

    const marketOwner = await publicClient.readContract({
      address: adminMarketAddress,
      abi: OWNER_ABI,
      functionName: 'owner',
    });

    if (marketOwner.toLowerCase() !== auth.address.toLowerCase()) {
      return json(res, 403, { error: 'Signer is not the market owner' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { data, error } = await supabase
      .from('_global_config')
      .update(updates)
      .eq('network', auth.network)
      .select('*');

    if (error) {
      return json(res, 500, { error: error.message });
    }

    if (!data?.length) {
      return json(res, 404, { error: `No _global_config row found for network ${auth.network}` });
    }

    return json(res, 200, { ok: true, config: data[0] });
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : 'Unknown admin config error' });
  }
}
