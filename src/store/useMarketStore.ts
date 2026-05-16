import { create } from 'zustand';

export interface MarketData {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  volume: string;
}

interface MarketStore {
  marketData: MarketData[];
  setMarketData: (data: MarketData[] | ((prev: MarketData[]) => MarketData[])) => void;
}

export const useMarketStore = create<MarketStore>((set) => ({
  marketData: [],
  setMarketData: (updater) => set((state) => ({
    marketData: typeof updater === 'function' ? updater(state.marketData) : updater
  }))
}));
