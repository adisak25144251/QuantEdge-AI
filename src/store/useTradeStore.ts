import { create } from 'zustand';

export interface Trade {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entry: number;
  sl: number;
  tp: number;
  sizeUSD: number;
  sizeUnits: number;
  status: 'OPEN' | 'WON' | 'LOST';
  date: string;
  pnlUSD?: number;
  createdAt?: number;
}

interface TradeStore {
  portfolioSize: number;
  riskPercent: number;
  setPortfolioSize: (size: number) => void;
  setRiskPercent: (percent: number) => void;
  journal: Trade[];
  setJournal: (journal: Trade[]) => void;
  executeTrade: (trade: Omit<Trade, 'id' | 'status' | 'date'>) => Trade; // Returns trade so caller can sync
  closeTrade: (id: string, result: 'WON' | 'LOST', pnlUSD: number) => Trade | undefined; // Returns updated trade so caller can sync
  clearJournal: () => void;
}

export const useTradeStore = create<TradeStore>()((set, get) => ({
  portfolioSize: 10000,
  riskPercent: 1,
  setPortfolioSize: (size) => set({ portfolioSize: size }),
  setRiskPercent: (percent) => set({ riskPercent: percent }),
  journal: [],
  setJournal: (journal) => set({ journal }),
  executeTrade: (tradeData) => {
    const newTrade: Trade = {
      ...tradeData,
      id: Math.random().toString(36).substring(2, 9),
      status: 'OPEN',
      date: new Date().toISOString(),
      createdAt: Date.now()
    };
    set((state) => ({ journal: [newTrade, ...state.journal] }));
    return newTrade;
  },
  closeTrade: (id, result, pnlUSD) => {
    let updatedTrade: Trade | undefined;
    set((state) => {
        const newJournal = state.journal.map(t => {
            if (t.id === id) {
                updatedTrade = { ...t, status: result, pnlUSD };
                return updatedTrade;
            }
            return t;
        });
        return { journal: newJournal };
    });
    return updatedTrade;
  },
  clearJournal: () => set({ journal: [] })
}));
