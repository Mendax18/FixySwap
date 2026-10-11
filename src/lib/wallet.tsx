import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { solBalance } from "@/lib/solana";

export type WalletId = "phantom" | "solflare" | "backpack";

type InjectedWallet = {
  isPhantom?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  disconnect?: () => Promise<void>;
};

export type WalletChoice = {
  id: WalletId;
  name: string;
  install: string;
  provider: InjectedWallet | null;
};

type WalletState = {
  address: string | null;
  name: string | null;
  sol: number | null;
  open: boolean;
  error: string | null;
  pending: boolean;
  choices: WalletChoice[];
  openModal: () => void;
  closeModal: () => void;
  connect: (id: WalletId) => Promise<void>;
  disconnect: () => Promise<void>;
};

const WalletContext = createContext<WalletState | null>(null);

function detect(): WalletChoice[] {
  if (typeof window === "undefined") {
    return [
      { id: "phantom", name: "Phantom", install: "https://phantom.com", provider: null },
      { id: "solflare", name: "Solflare", install: "https://solflare.com", provider: null },
      { id: "backpack", name: "Backpack", install: "https://backpack.app", provider: null },
    ];
  }
  const host = window as Window & {
    phantom?: { solana?: InjectedWallet };
    solflare?: InjectedWallet;
    backpack?: InjectedWallet;
    solana?: InjectedWallet;
  };
  const phantom = host.phantom?.solana ?? (host.solana?.isPhantom ? host.solana : null);
  return [
    { id: "phantom", name: "Phantom", install: "https://phantom.com", provider: phantom ?? null },
    { id: "solflare", name: "Solflare", install: "https://solflare.com", provider: host.solflare ?? null },
    { id: "backpack", name: "Backpack", install: "https://backpack.app", provider: host.backpack ?? null },
  ];
}

export function shortAddress(value: string) {
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [sol, setSol] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [choices, setChoices] = useState<WalletChoice[]>(() => detect());

  const openModal = useCallback(() => {
    setChoices(detect());
    setError(null);
    setOpen(true);
  }, []);

  const connect = useCallback(async (id: WalletId) => {
    const choice = detect().find((item) => item.id === id);
    if (!choice?.provider) {
      setError(`${choice?.name ?? "That wallet"} is not installed in this browser.`);
      setChoices(detect());
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await choice.provider.connect();
      const next = result.publicKey.toString();
      setAddress(next);
      setName(choice.name);
      setOpen(false);
      setSol(await solBalance(next));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Wallet connection was rejected.");
    } finally {
      setPending(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const choice = detect().find((item) => item.name === name);
    try {
      await choice?.provider?.disconnect?.();
    } catch {
      // The session is cleared locally even if the extension ignores disconnect.
    }
    setAddress(null);
    setName(null);
    setSol(null);
  }, [name]);

  const value = useMemo(
    () => ({
      address,
      name,
      sol,
      open,
      error,
      pending,
      choices,
      openModal,
      closeModal: () => setOpen(false),
      connect,
      disconnect,
    }),
    [address, name, sol, open, error, pending, choices, openModal, connect, disconnect],
  );

  return (
    <WalletContext.Provider value={value}>
      {children}
      <WalletModal />
    </WalletContext.Provider>
  );
}

function WalletModal() {
  const wallet = useWallet();
  if (!wallet.open) return null;
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" role="presentation" onClick={wallet.closeModal}>
      <div
        role="dialog"
        aria-labelledby="wallet-title"
        className="glass-panel w-full max-w-sm rounded-2xl p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="wallet-title" className="text-lg font-semibold tracking-tight">
            Connect a wallet
          </h2>
          <button type="button" onClick={wallet.closeModal} className="text-sm text-muted">
            Close
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">Phantom, Solflare, or Backpack on mainnet.</p>
        <ul className="mt-4 grid gap-2">
          {wallet.choices.map((choice) => (
            <li key={choice.id}>
              {choice.provider ? (
                <button
                  type="button"
                  disabled={wallet.pending}
                  onClick={() => void wallet.connect(choice.id)}
                  className="lift flex h-12 w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold"
                >
                  {choice.name}
                  <span className="text-xs font-normal text-primary">Detected</span>
                </button>
              ) : (
                <a
                  href={choice.install}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-12 w-full items-center justify-between rounded-xl border border-white/10 px-4 text-sm text-muted"
                >
                  {choice.name}
                  <span>Install</span>
                </a>
              )}
            </li>
          ))}
        </ul>
        {wallet.error && <p className="mt-3 text-sm text-danger">{wallet.error}</p>}
      </div>
    </div>
  );
}

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used inside WalletProvider");
  return value;
}
