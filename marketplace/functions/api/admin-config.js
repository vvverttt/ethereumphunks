import { createClient } from '@supabase/supabase-js';
import { createPublicClient, http, isAddress, parseAbi, recoverMessageAddress } from 'viem';

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

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost(context) {
  const env = context.env;

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const adminRpcHttpProvider = env.ADMIN_RPC_HTTP_PROVIDER;
  const adminMarketAddress = env.ADMIN_MARKET_ADDRESS;
  const adminChainId = env.ADMIN_CHAIN_ID ? Number(env.ADMIN_CHAIN_ID) : null;

  if (!supabaseUrl || !supabaseServiceRoleKey || !adminRpcHttpProvider || !adminMarketAddress) {
    return json(500, {
      error: 'Missing admin config environment variables',
      missing: [
        !supabaseUrl && 'SUPABASE_URL',
        !supabaseServiceRoleKey && 'SUPABASE_SERVICE_ROLE_KEY',
        !adminRpcHttpProvider && 'ADMIN_RPC_HTTP_PROVIDER',
        !adminMarketAddress && 'ADMIN_MARKET_ADDRESS',
      ].filter(Boolean),
      envKeys: Object.keys(env),
    });
  }

  try {
    const body = await context.request.json().catch(() => null);
    const { auth, updates, signature } = body || {};

    if (!auth || !updates || !signature) {
      return json(400, { error: 'Missing auth, updates, or signature' });
    }

    if (!isAddress(auth.address)) {
      return json(400, { error: 'Invalid admin address' });
    }

    if (!Number.isInteger(auth.network)) {
      return json(400, { error: 'Invalid admin network' });
    }

    if (adminChainId !== null && auth.network !== adminChainId) {
      return json(400, { error: `Wrong admin network for this deployment: ${auth.network}` });
    }

    const now = Date.now();
    if (!Number.isFinite(auth.issuedAt) || !Number.isFinite(auth.expiresAt)) {
      return json(400, { error: 'Invalid auth timestamps' });
    }

    if (auth.expiresAt < now) {
      return json(401, { error: 'Admin signature expired' });
    }

    if (auth.issuedAt > now + 60_000) {
      return json(401, { error: 'Admin signature issued in the future' });
    }

    const expectedPayloadHash = hashString(stableStringify(updates));
    if (auth.payloadHash !== expectedPayloadHash) {
      return json(400, { error: 'Payload hash mismatch' });
    }

    const expectedMessage = buildAdminConfigMessage(auth);
    const recoveredAddress = await recoverMessageAddress({
      message: expectedMessage,
      signature,
    });

    if (recoveredAddress.toLowerCase() !== auth.address.toLowerCase()) {
      return json(401, { error: 'Signature does not match admin wallet' });
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
      return json(403, { error: 'Signer is not the market owner' });
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
      return json(500, { error: error.message });
    }

    if (!data?.length) {
      return json(404, { error: `No _global_config row found for network ${auth.network}` });
    }

    return json(200, { ok: true, config: data[0] });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'Unknown admin config error' });
  }
}
