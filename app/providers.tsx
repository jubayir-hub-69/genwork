'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';

// GenLayer Testnet (Bradbury) Custom Network Configuration
const genLayerTestnet = {
  id: 4221,
  name: 'GenLayer Bradbury',
  iconUrl: 'https://docs.genlayer.com/favicon.ico',
  iconBackground: '#fff',
  nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc-bradbury.genlayer.com'] },
  },
  blockExplorers: {
    default: { name: 'GenLayer Explorer', url: 'https://explorer-bradbury.genlayer.com' },
  },
};

const config = getDefaultConfig({
  appName: 'Genwork',
  projectId: 'a87265882679dc8b17dc94fa915a1331', // Demo Project ID
  chains: [genLayerTestnet],
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}