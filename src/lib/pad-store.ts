import { create } from "zustand";

export type Tab = "swap" | "refill" | "treasury";

export type Launch = {
  id: string;
  title: string;
  symbolIn: string;
  symbolOut: string;
  mintIn: string;
  mintOut: string;
  programIn: string;
  programOut: string;
  rateIn: number;
  rateOut: number;
  feeSol: number;
  vaultOut: number;
  vaultCap: number;
  vaultIn: number;
  treasuryUsdc: number;
  feesSol: number;
  paused: boolean;
  pulse: number;
};

type Wallet = { sol: number; tokens: Record<string, number>; fund: Record<string, number> };

type Pad = {
  view: "board" | "create" | "desk";
  tab: Tab;
  launches: Launch[];
  activeId: string | null;
  wallet: Wallet;
  flash: string | null;
  openBoard: () => void;
  openCreate: () => void;
  openDesk: (id: string) => void;
  setTab: (tab: Tab) => void;
  publish: (draft: Draft) => string | null;
  swap: (amount: number) => string | null;
  refill: (amount: number) => string | null;
  harvest: () => string | null;
  claim: () => string | null;
  togglePause: () => void;
  hydrate: () => void;
};

export type Draft = {
  title: string;
  symbolIn: string;
  symbolOut: string;
  mintIn: string;
  mintOut: string;
  programIn: string;
  programOut: string;
  rateIn: number;
  rateOut: number;
  feeSol: number;
  inventory: number;
};

const KEY = "caja-launches-v1";

export const seedLaunch = (): Launch => ({
  id: "allin-cars",
  title: "ALLIN \u2192 CARS",
  symbolIn: "ALLIN",
  symbolOut: "CARS",
  mintIn: "aRvdt6BJBQGUgKUfF9QjeZXvBKAtZjvaby6pqkiBLNK",
  mintOut: "CARSsxWPkpQWvfyRBwfGMGvysJBHdHGfE46X5MNgmeta",
  programIn: "Token-2022",
  programOut: "SPL Token",
  rateIn: 5,
  rateOut: 1,
  feeSol: 0.00165,
  vaultOut: 2500,
  vaultCap: 2500,
  vaultIn: 0,
  treasuryUsdc: 0,
  feesSol: 0,
  paused: false,
  pulse: 0,
});

const seedWallet = (): Wallet => ({
  sol: 0.25,
  tokens: { ALLIN: 500, CARS: 2 },
  fund: { CARS: 8000 },
});

function save(launches: Launch[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(launches.filter((l) => l.id !== "allin-cars")));
  } catch {
    /* ignore */
  }
}

function patch(launches: Launch[], id: string, next: Partial<Launch>): Launch[] {
  return launches.map((l) => (l.id === id ? { ...l, ...next, pulse: (l.pulse ?? 0) + 1 } : l));
}

export function quote(amount: number, rateIn: number, rateOut: number) {
  if (!Number.isFinite(amount) || amount <= 0 || rateIn <= 0 || rateOut <= 0) return 0;
  const out = (amount * rateOut) / rateIn;
  if (!Number.isInteger(out)) return 0;
  return out;
}

export const usePad = create<Pad>((set, get) => ({
  view: "board",
  tab: "swap",
  launches: [seedLaunch()],
  activeId: null,
  wallet: seedWallet(),
  flash: null,
  openBoard: () => set({ view: "board", flash: null, activeId: null }),
  openCreate: () => set({ view: "create", flash: null }),
  openDesk: (id) => set({ view: "desk", activeId: id, tab: "swap", flash: null }),
  setTab: (tab) => set({ tab, flash: null }),
  hydrate: () => {
    if (get().launches.some((l) => l.id !== "allin-cars")) return;
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const extra = JSON.parse(raw) as Launch[];
      if (!Array.isArray(extra)) return;
      set({ launches: [seedLaunch(), ...extra.filter((l) => l && l.id && l.id !== "allin-cars")] });
    } catch {
      /* ignore */
    }
  },
  publish: (draft) => {
    if (!draft.title.trim() || !draft.symbolIn.trim() || !draft.symbolOut.trim()) {
      return "Name both tokens and the desk.";
    }
    if (draft.symbolIn.toUpperCase() === draft.symbolOut.toUpperCase()) {
      return "The input and output tokens must be different.";
    }
    if (draft.rateIn <= 0 || draft.rateOut <= 0 || draft.inventory <= 0) {
      return "Ratio and inventory must be greater than zero.";
    }
    if (draft.feeSol < 0) return "The fee cannot be negative.";
    const symbolIn = draft.symbolIn.trim().toUpperCase();
    const symbolOut = draft.symbolOut.trim().toUpperCase();
    const launch: Launch = {
      id: crypto.randomUUID(),
      title: draft.title.trim(),
      symbolIn,
      symbolOut,
      mintIn: draft.mintIn.trim(),
      mintOut: draft.mintOut.trim(),
      programIn: draft.programIn,
      programOut: draft.programOut,
      rateIn: draft.rateIn,
      rateOut: draft.rateOut,
      feeSol: draft.feeSol,
      vaultOut: draft.inventory,
      vaultCap: draft.inventory,
      vaultIn: 0,
      treasuryUsdc: 0,
      feesSol: 0,
      paused: false,
      pulse: 1,
    };
    const wallet = get().wallet;
    const launches = [seedLaunchFrom(get().launches), launch, ...get().launches.filter((l) => l.id !== "allin-cars" && l.id !== launch.id)];
    const tokens = { ...wallet.tokens, [symbolIn]: wallet.tokens[symbolIn] ?? 1000 };
    const fund = { ...wallet.fund, [symbolOut]: (wallet.fund[symbolOut] ?? 0) + draft.inventory };
    set({
      launches,
      wallet: { ...wallet, tokens, fund },
      view: "desk",
      activeId: launch.id,
      flash: "Desk published",
    });
    save(launches);
    return null;
  },
  swap: (amount) => {
    const s = get();
    const desk = s.launches.find((l) => l.id === s.activeId);
    if (!desk) return "Pick a desk.";
    if (desk.paused) return "This desk is paused.";
    const out = quote(amount, desk.rateIn, desk.rateOut);
    if (out <= 0) return `Amount must be a multiple of ${desk.rateIn} ${desk.symbolIn}.`;
    const held = s.wallet.tokens[desk.symbolIn] ?? 0;
    if (held < amount) return `Not enough ${desk.symbolIn}.`;
    if (s.wallet.sol < desk.feeSol) return `Not enough SOL for the ${desk.feeSol} fee.`;
    if (desk.vaultOut < out) return `Not enough ${desk.symbolOut} in the vault.`;
    const launches = patch(s.launches, desk.id, {
      vaultOut: round(desk.vaultOut - out),
      vaultIn: round(desk.vaultIn + amount),
      feesSol: round(desk.feesSol + desk.feeSol, 6),
    });
    set({
      launches,
      wallet: {
        sol: round(s.wallet.sol - desk.feeSol, 6),
        tokens: {
          ...s.wallet.tokens,
          [desk.symbolIn]: round(held - amount),
          [desk.symbolOut]: round((s.wallet.tokens[desk.symbolOut] ?? 0) + out),
        },
        fund: s.wallet.fund,
      },
      flash: `You received ${out} ${desk.symbolOut}`,
    });
    save(launches);
    return null;
  },
  refill: (amount) => {
    const s = get();
    const desk = s.launches.find((l) => l.id === s.activeId);
    if (!desk) return "Pick a desk.";
    if (!Number.isFinite(amount) || amount <= 0) return "Enter an amount.";
    const pile = s.wallet.fund[desk.symbolOut] ?? 0;
    if (pile < amount) return `That wallet does not hold enough ${desk.symbolOut}.`;
    const launches = patch(s.launches, desk.id, {
      vaultOut: round(desk.vaultOut + amount),
      vaultCap: Math.max(desk.vaultCap, desk.vaultOut + amount),
    });
    set({
      launches,
      wallet: { ...s.wallet, fund: { ...s.wallet.fund, [desk.symbolOut]: round(pile - amount) } },
      flash: `Vault received ${amount} ${desk.symbolOut}`,
    });
    save(launches);
    return null;
  },
  harvest: () => {
    const s = get();
    const desk = s.launches.find((l) => l.id === s.activeId);
    if (!desk) return "Pick a desk.";
    if (desk.vaultIn <= 0) return `No ${desk.symbolIn} has been collected yet.`;
    const usdc = round(desk.vaultIn * 0.0024, 4);
    const launches = patch(s.launches, desk.id, { vaultIn: 0, treasuryUsdc: round(desk.treasuryUsdc + usdc, 4) });
    set({ launches, flash: `Harvest left ${usdc} USDC in treasury` });
    save(launches);
    return null;
  },
  claim: () => {
    const s = get();
    const desk = s.launches.find((l) => l.id === s.activeId);
    if (!desk) return "Pick a desk.";
    if (desk.treasuryUsdc <= 0) return "Treasury is empty.";
    const launches = patch(s.launches, desk.id, { treasuryUsdc: 0 });
    set({ launches, flash: `${desk.treasuryUsdc} USDC sent to the creator wallet` });
    save(launches);
    return null;
  },
  togglePause: () => {
    const s = get();
    const desk = s.launches.find((l) => l.id === s.activeId);
    if (!desk) return;
    const launches = patch(s.launches, desk.id, { paused: !desk.paused });
    set({ launches, flash: desk.paused ? "Desk open" : "Desk paused" });
    save(launches);
  },
}));

function seedLaunchFrom(launches: Launch[]) {
  return launches.find((l) => l.id === "allin-cars") ?? seedLaunch();
}

function round(n: number, digits = 4) {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

export function activeLaunch(s: { launches: Launch[]; activeId: string | null }) {
  return s.launches.find((l) => l.id === s.activeId) ?? null;
}
