import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowDown } from "lucide-react";
import { ConnectWallet } from "@/components/connect-wallet";
import { activeLaunch, usePad, type Draft, type Tab } from "@/lib/pad-store";
import { describeMint, parseAddress, tokenUiBalance } from "@/lib/solana";
import { useWallet } from "@/lib/wallet";

export const Route = createFileRoute("/app")({ component: Home });

function Home() {
  const view = usePad((s) => s.view);
  useEffect(() => {
    usePad.getState().hydrate();
  }, []);

  return (
    <main className="relative flex min-h-screen flex-col px-4 py-5 sm:px-8">
      <div key={view} className="rise flex flex-1 flex-col">
        {view === "board" && <Board />}
        {view === "create" && <Create />}
        {view === "desk" && <Desk />}
      </div>
    </main>
  );
}

function Board() {
  const launches = usePad((s) => s.launches);
  const openCreate = usePad((s) => s.openCreate);
  const openDesk = usePad((s) => s.openDesk);
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-widest text-cyan">LAUNCHPAD · MAINNET</p>
          <h1 className="wordmark text-3xl sm:text-5xl">FixySwap</h1>
          <p className="mt-2 max-w-md text-sm text-muted">
            Publish a fixed-rate desk. Pick the token you take, the token you pay out, and the ratio.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ConnectWallet />
          <button
            type="button"
            onClick={openCreate}
            className="lift h-10 rounded-full border border-white/15 px-4 text-sm font-semibold"
          >
            Launch desk
          </button>
        </div>
      </header>
      <p className="mt-3 font-mono text-xs text-muted">Mainnet · fixed rate</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {launches.map((item) => (
          <li key={item.id}>
            <button type="button" onClick={() => openDesk(item.id)} className="hud hud-card w-full rounded-lg p-4 text-left">
              <p className="font-mono text-xs text-pink">
                {item.paused ? "PAUSED" : <><span className="live-dot" />LIVE</>}
              </p>
              <p className="mt-1 text-xl text-fg">{item.title}</p>
              <p className="mt-2 font-mono text-sm text-primary">
                {item.rateIn} {item.symbolIn} → {item.rateOut} {item.symbolOut}
              </p>
              <p className="mt-1 text-sm text-muted">
                Vault {item.vaultOut} {item.symbolOut} · fee {item.feeSol} SOL
              </p>
              <p className="mt-1 font-mono text-xs text-cyan">
                {item.programIn} → {item.programOut}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function Create() {
  const publish = usePad((s) => s.publish);
  const back = usePad((s) => s.openBoard);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    title: "",
    symbolIn: "",
    symbolOut: "",
    mintIn: "",
    mintOut: "",
    programIn: "",
    programOut: "",
    rateIn: 5,
    rateOut: 1,
    feeSol: 0.00165,
    inventory: 1000,
  });
  const set = (key: keyof Draft, value: string) => {
    setDraft((current) => ({
      ...current,
      [key]:
        key === "rateIn" || key === "rateOut" || key === "feeSol" || key === "inventory" ? Number(value) : value,
    }));
  };

  return (
    <form
      className="hud mx-auto mt-8 w-full max-w-xl rounded-lg p-4 sm:p-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!parseAddress(draft.mintIn) || !parseAddress(draft.mintOut)) {
          setError("Both contract addresses must be valid Solana addresses.");
          return;
        }
        setBusy(true);
        setError(null);
        void (async () => {
          try {
            const [inputMint, outputMint] = await Promise.all([
              describeMint(draft.mintIn),
              describeMint(draft.mintOut),
            ]);
            setError(
              publish({
                ...draft,
                mintIn: inputMint.address,
                mintOut: outputMint.address,
                programIn: `${inputMint.program} · ${inputMint.decimals} decimals`,
                programOut: `${outputMint.program} · ${outputMint.decimals} decimals`,
              }),
            );
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Mint lookup failed.");
          } finally {
            setBusy(false);
          }
        })();
      }}
    >
      <p className="font-mono text-xs tracking-widest text-primary">NEW DESK</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">Arm the pair</h2>
      <p className="mt-1 text-sm text-muted">
        Paste the contract address of the token swapped in and the token received. Both are required.
      </p>
      <div className="mt-4 grid gap-3">
        <Field label="Contract address — token swapped in" value={draft.mintIn} onChange={(value) => set("mintIn", value)} mono />
        <Field label="Contract address — token received" value={draft.mintOut} onChange={(value) => set("mintOut", value)} mono />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Name" value={draft.title} onChange={(value) => set("title", value)} />
        <Field label="Fee in SOL" value={String(draft.feeSol)} onChange={(value) => set("feeSol", value)} />
        <Field label="Symbol in" value={draft.symbolIn} onChange={(value) => set("symbolIn", value)} />
        <Field label="Symbol out" value={draft.symbolOut} onChange={(value) => set("symbolOut", value)} />
        <Field label="You send" value={String(draft.rateIn)} onChange={(value) => set("rateIn", value)} />
        <Field label="You receive" value={String(draft.rateOut)} onChange={(value) => set("rateOut", value)} />
        <Field
          label="Starting inventory of the output token"
          value={String(draft.inventory)}
          onChange={(value) => set("inventory", value)}
        />
      </div>
      <p className="mt-3 font-mono text-sm text-primary">
        {draft.rateIn || 0} {draft.symbolIn || "IN"} → {draft.rateOut || 0} {draft.symbolOut || "OUT"}
      </p>
      <p className="mt-1 text-sm text-muted">Addresses are checked on mainnet before the desk goes live.</p>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="lift h-12 flex-1 rounded-full bg-primary font-semibold text-primary-ink disabled:opacity-40"
        >
          {busy ? "Checking addresses…" : "Publish"}
        </button>
        <button type="button" onClick={back} className="h-12 rounded-full border border-border px-4 text-fg">
          Back
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mono?: boolean;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <label className="block" htmlFor={id}>
      <span className="font-mono text-xs tracking-wide text-muted">{label}</span>
      <input
        id={id}
        required
        value={value}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        className={`field mt-1 h-11 w-full rounded-md border border-white/10 bg-black/50 px-3 text-fg outline-none ${mono ? "ca-input" : ""}`}
      />
    </label>
  );
}

function Desk() {
  const desk = usePad((s) => activeLaunch(s));
  const tab = usePad((s) => s.tab);
  const book = usePad((s) => s.wallet);
  const flash = usePad((s) => s.flash);
  const setTab = usePad((s) => s.setTab);
  const swap = usePad((s) => s.swap);
  const refill = usePad((s) => s.refill);
  const harvest = usePad((s) => s.harvest);
  const claim = usePad((s) => s.claim);
  const togglePause = usePad((s) => s.togglePause);
  const back = usePad((s) => s.openBoard);
  const connected = useWallet();
  const [raw, setRaw] = useState("50");
  const [refillRaw, setRefillRaw] = useState("100");
  const [caIn, setCaIn] = useState("");
  const [caOut, setCaOut] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [held, setHeld] = useState<{ pay: string | null; receive: string | null }>({ pay: null, receive: null });

  useEffect(() => {
    if (!connected.address || !desk) return;
    let stop = false;
    void Promise.all([
      tokenUiBalance(connected.address, desk.mintIn),
      tokenUiBalance(connected.address, desk.mintOut),
    ]).then(([pay, receive]) => {
      if (!stop) setHeld({ pay, receive });
    });
    return () => {
      stop = true;
    };
  }, [connected.address, desk]);

  if (!desk) return null;
  const out = Number.isFinite(Number(raw)) ? (Number(raw) * desk.rateOut) / desk.rateIn : 0;
  const shown = Number.isInteger(out) ? out : 0;
  const armed = parseAddress(caIn)?.toBase58() === desk.mintIn && parseAddress(caOut)?.toBase58() === desk.mintOut;

  return (
    <>
      <header className="flex items-center justify-between gap-3">
        <button type="button" onClick={back} className="text-sm font-semibold tracking-tight">
          FixySwap
        </button>
        <ConnectWallet />
      </header>
      <section className="glass-panel mx-auto mt-10 w-full max-w-[440px] rounded-3xl p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between px-1">
          <h1 className="text-lg font-semibold tracking-tight">Swap</h1>
          <p className="font-mono text-xs text-muted">
            {desk.paused ? "Paused" : "Live"} · {desk.rateIn} {desk.symbolIn} = {desk.rateOut} {desk.symbolOut}
          </p>
        </div>
        <nav className="mb-3 grid grid-cols-3 gap-1 rounded-2xl bg-white/5 p-1" aria-label="Desk actions">
          {(["swap", "refill", "treasury"] as Tab[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`h-9 rounded-xl text-sm transition-colors duration-200 ${tab === id ? "bg-white/10 text-fg" : "text-muted"}`}
            >
              {id === "swap" ? "Swap" : id === "refill" ? "Refill" : "Admin"}
            </button>
          ))}
        </nav>
        <div key={tab} className="rise">
          {tab === "swap" && (
            <form
              className="grid gap-1"
              onSubmit={(event) => {
                event.preventDefault();
                if (!connected.address) {
                  connected.openModal();
                  return;
                }
                if (!armed) {
                  setError("Paste both contract addresses. They have to match this desk.");
                  return;
                }
                setError(swap(Number(raw)));
              }}
            >
              <div className="pay-box">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>You pay</span>
                  <span>Balance {held.pay ?? "—"}</span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    id="amount-in"
                    aria-label={`You pay ${desk.symbolIn}`}
                    value={raw}
                    inputMode="decimal"
                    onChange={(event) => setRaw(event.target.value)}
                    className="w-full bg-transparent font-mono text-4xl tracking-tight outline-none"
                  />
                  <span className="token-pill shrink-0">{desk.symbolIn}</span>
                </div>
                <label className="mt-3 block" htmlFor="ca-in">
                  <span className="font-mono text-[11px] tracking-wide text-muted">CONTRACT ADDRESS</span>
                  <input
                    id="ca-in"
                    required
                    spellCheck={false}
                    value={caIn}
                    onChange={(event) => setCaIn(event.target.value)}
                    placeholder={desk.mintIn}
                    className="field ca-input mt-1 h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 outline-none"
                  />
                </label>
              </div>
              <div className="flip-btn" aria-hidden>
                <ArrowDown className="size-4" />
              </div>
              <div className="pay-box">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>You receive</span>
                  <span>Balance {held.receive ?? "—"}</span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <p key={shown} className="tick w-full font-mono text-4xl tracking-tight">
                    {shown}
                  </p>
                  <span className="token-pill shrink-0">{desk.symbolOut}</span>
                </div>
                <label className="mt-3 block" htmlFor="ca-out">
                  <span className="font-mono text-[11px] tracking-wide text-muted">CONTRACT ADDRESS</span>
                  <input
                    id="ca-out"
                    required
                    spellCheck={false}
                    value={caOut}
                    onChange={(event) => setCaOut(event.target.value)}
                    placeholder={desk.mintOut}
                    className="field ca-input mt-1 h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 outline-none"
                  />
                </label>
              </div>
              <div className="mt-3 grid gap-1 px-1 text-sm text-muted">
                <p className="flex justify-between">
                  <span>Rate</span>
                  <span className="text-fg">
                    {desk.rateIn} {desk.symbolIn} = {desk.rateOut} {desk.symbolOut}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span>Protocol fee</span>
                  <span className="text-fg">{desk.feeSol} SOL</span>
                </p>
                <p className={`flex justify-between ${armed ? "text-primary" : ""}`}>
                  <span>Pair</span>
                  <span>{armed ? "Armed" : "Waiting for both addresses"}</span>
                </p>
              </div>
              {error && <p className="px-1 text-sm text-danger">{error}</p>}
              {flash && <p className="px-1 text-sm text-cyan">{flash}</p>}
              <div className="mt-3">
                {connected.address ? (
                  <button
                    type="submit"
                    disabled={desk.paused || !armed}
                    className="lift h-14 w-full rounded-2xl bg-primary text-base font-semibold text-primary-ink disabled:opacity-40"
                  >
                    {desk.paused ? "Paused" : armed ? "Swap" : "Enter both addresses"}
                  </button>
                ) : (
                  <ConnectWallet block />
                )}
              </div>
            </form>
          )}
          {tab === "refill" && (
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                setError(refill(Number(refillRaw)));
              }}
            >
              <div className="pay-box">
                <p className="text-xs text-muted">Add {desk.symbolOut} to the vault. No shares.</p>
                <input
                  id="refill-amount"
                  aria-label="Refill amount"
                  value={refillRaw}
                  inputMode="decimal"
                  onChange={(event) => setRefillRaw(event.target.value)}
                  className="mt-2 w-full bg-transparent font-mono text-4xl outline-none"
                />
                <p className="mt-2 text-xs text-muted">Desk balance {book.fund[desk.symbolOut] ?? 0}</p>
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <button type="submit" className="lift h-14 rounded-2xl bg-primary text-base font-semibold text-primary-ink">
                Refill vault
              </button>
            </form>
          )}
          {tab === "treasury" && (
            <div className="grid gap-3">
              <div className="pay-box text-sm">
                <p className="flex justify-between text-muted">
                  <span>USDC</span>
                  <span className="text-fg">{desk.treasuryUsdc}</span>
                </p>
                <p className="mt-2 flex justify-between text-muted">
                  <span>Fees</span>
                  <span className="text-fg">{desk.feesSol} SOL</span>
                </p>
                <p className="mt-2 text-xs text-muted">
                  Vault {desk.vaultOut} {desk.symbolOut} · collected {desk.vaultIn} {desk.symbolIn}
                </p>
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <button type="button" onClick={() => setError(harvest())} className="lift h-12 rounded-2xl bg-primary font-semibold text-primary-ink">
                Harvest {desk.symbolIn} to USDC
              </button>
              <button type="button" onClick={() => setError(claim())} className="lift h-12 rounded-2xl border border-primary font-semibold text-primary">
                Claim to creator
              </button>
              <button type="button" onClick={togglePause} className="h-10 text-sm text-muted">
                {desk.paused ? "Reopen desk" : "Pause desk"}
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
