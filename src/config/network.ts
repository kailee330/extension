export const SHIBACOIN_NETWORK = {
    chainId: 1337,
    name: 'Shibacoin',
    rpcUrl: '#',
    currency: {
        name: 'Shibacoin',
        symbol: 'SHIC',
        decimals: 8
    },
    explorer: 'https://shibaexplorer.com/'
} as const;

export const NETWORKS = {
    SHIC: SHIBACOIN_NETWORK
} as const;
