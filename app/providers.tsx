"use client";

import * as React from "react";
import {
  RainbowKitProvider,
  getDefaultConfig,
} from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@rainbow-me/rainbowkit/styles.css";

const genlayerStudio = {
  id: 61999,
  name: 'GenLayer Studio',
  nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://studio.genlayer.com/api'] },
  },
  blockExplorers: {
    default: { name: 'StudioExplorer', url: 'https://explorer-studio.genlayer.com' },
  },
  testnet: true,
} as const;

const config = getDefaultConfig({
  appName: "Genwork",
  projectId: "eb874c3711679c7e6dbe8051f9507d2a",
  chains: [genlayerStudio],
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
