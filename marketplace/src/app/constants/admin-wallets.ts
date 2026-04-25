export const ADMIN_WALLET_WHITELIST = [
  '0xf1Aa941d56041d47a9a18e99609A047707Fe96c7',
  '0x19d57a31b982d3d75c16358795a4d19c803e4a72',
];

export function isAdminWallet(address?: string | null): boolean {
  if (!address) return false;
  return ADMIN_WALLET_WHITELIST
    .map((wallet) => wallet.toLowerCase())
    .includes(address.toLowerCase());
}
