import { shortAddress, useWallet } from "@/lib/wallet";

export function ConnectWallet({ block = false }: { block?: boolean }) {
  const wallet = useWallet();
  if (wallet.address) {
    return (
      <button
        type="button"
        onClick={() => void wallet.disconnect()}
        className={`lift glass-panel inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold ${block ? "w-full justify-center" : ""}`}
      >
        <span className="live-dot" />
        {shortAddress(wallet.address)}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={wallet.openModal}
      className={`lift inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-ink ${block ? "h-14 w-full rounded-2xl text-base" : ""}`}
    >
      Connect wallet
    </button>
  );
}
