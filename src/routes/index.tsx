import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ConnectWallet } from "@/components/connect-wallet";

export const Route = createFileRoute("/")({ component: Landing });

const faqs = [
  {
    q: "Is FixySwap an AMM?",
    a: "No. The rate is fixed by the desk. Inventory is the limit, not a curve. If the vault is empty, the swap does not fill.",
  },
  {
    q: "What can I swap into?",
    a: "A MetaDAO company token you choose, such as Rip Cars (CARS). You paste both contract addresses, and the ratio stays put.",
  },
  {
    q: "Who can refill the vault?",
    a: "Any wallet. Refill adds the output token. It does not mint shares or a claim on the tokens that come in.",
  },
  {
    q: "Where does the fee go?",
    a: "Each swap pays a flat 0.00165 SOL fee to the wallet that deployed the program. It is not taken from the vault, and it does not go to the desk creator.",
  },
  {
    q: "Does the program mint the company token?",
    a: "No. CARS and any other output token have to be deposited. FixySwap only moves tokens that already exist.",
  },
];

const steps = [
  { n: "01", title: "Paste both addresses", body: "The token holders send, and the MetaDAO token they receive. Both contract addresses are required." },
  { n: "02", title: "Set the rate", body: "Publish a fixed ratio and the opening inventory. The desk does not move with the market." },
  { n: "03", title: "Holders swap", body: "They confirm the same two addresses, send the input token, and the vault pays the output token." },
];

function Landing() {
  const [open, setOpen] = useState(0);
  const [amount, setAmount] = useState("50");
  const parsed = Number(amount);
  const out = Number.isFinite(parsed) && parsed > 0 && parsed % 5 === 0 ? parsed / 5 : 0;

  return (
    <div className="min-h-screen text-fg">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#060a14]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <a href="#top" className="text-sm font-semibold tracking-tight">
            FixySwap
          </a>
          <nav className="flex items-center gap-5 text-sm text-muted" aria-label="Primary">
            <a href="#product" className="nav-link hover:text-fg">
              Product
            </a>
            <a href="#how" className="nav-link hover:text-fg">
              How it works
            </a>
            <a href="#faq" className="nav-link hover:text-fg">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <ConnectWallet />
            <Link
              to="/app"
              className="lift inline-flex h-9 items-center rounded-md border border-white/15 px-3 text-sm font-semibold"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div className="rise">
            <p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">For MetaDAO holders</p>
            <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight sm:text-6xl sm:leading-[1.05]">
              Swap into a company token. Keep the rate fixed.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-muted">
              Pools move the second someone arbs them. FixySwap is a desk: one token in, a MetaDAO token out, and a ratio that does not drift.
            </p>
            <div className="mt-8">
              <Link
                to="/app"
                className="lift inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-ink"
              >
                Open a desk
              </Link>
            </div>
          </div>

          <div className="glass-panel sheen rise overflow-hidden rounded-2xl" style={{ animationDelay: "90ms" }}>
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span className="ml-2 font-mono text-xs text-muted">fixyswap.app/app</span>
            </div>
            <form
              className="space-y-4 p-5"
              onSubmit={(event) => {
                event.preventDefault();
              }}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">ALLIN → CARS</p>
                <p className="font-mono text-xs text-primary">5 : 1</p>
              </div>
              <label className="block" htmlFor="hero-amount">
                <span className="font-mono text-xs tracking-wide text-muted">YOU SEND ALLIN</span>
                <input
                  id="hero-amount"
                  value={amount}
                  inputMode="decimal"
                  onChange={(event) => setAmount(event.target.value)}
                  className="mt-1 w-full border-b border-white/10 bg-transparent py-2 font-mono text-4xl tracking-tight outline-none"
                />
              </label>
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                <p className="font-mono text-xs text-muted">YOU RECEIVE</p>
                <p key={String(out)} className="tick mt-1 font-mono text-2xl text-fg">
                  {out} CARS
                </p>
              </div>
              <Link
                to="/app"
                className="lift inline-flex h-11 w-full items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-ink"
              >
                Swap on the desk
              </Link>
            </form>
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[0.02]" aria-label="Tokens desks settle into">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-10 gap-y-3 px-4 py-6">
            <p className="text-xs tracking-[0.14em] text-muted uppercase">Settle into</p>
            {["MetaDAO", "Rip Cars", "USDC", "wSOL"].map((name) => (
              <p key={name} className="text-sm font-semibold tracking-tight text-fg/85">
                {name}
              </p>
            ))}
          </div>
        </section>

        <section id="product" className="mx-auto max-w-6xl px-4 py-20">
          <p className="text-xs tracking-[0.16em] text-primary uppercase">Product</p>
          <h2 className="mt-3 max-w-lg text-3xl font-semibold tracking-tight sm:text-4xl">A desk, not a pool.</h2>
          <div className="mt-8 grid gap-3 md:grid-cols-3 stagger">
            <article className="glass-panel glass-card rounded-2xl p-6 md:col-span-2">
              <h3 className="text-lg font-semibold tracking-tight">You set the ratio</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
                Publish the token in, the MetaDAO token out, and the rate. 5 to 1 stays 5 to 1 until you change it. Nothing for a bot to walk.
              </p>
            </article>
            <article className="glass-panel glass-card rounded-2xl p-6">
              <h3 className="text-lg font-semibold tracking-tight">Both addresses, every time</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                The desk will not arm until the holder pastes the contract address of the token in and the token out.
              </p>
            </article>
            <article className="glass-panel glass-card rounded-2xl p-6">
              <h3 className="text-lg font-semibold tracking-tight">Anyone can refill</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Inventory is deposited, not minted. A refill does not earn a share of what comes in.
              </p>
            </article>
            <article className="glass-panel glass-card rounded-2xl p-6 md:col-span-2">
              <h3 className="text-lg font-semibold tracking-tight">Treasury stays with the desk</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
                Incoming tokens sit in the program until the desk creator harvests them. The protocol fee in SOL is separate, and it goes to the deployer.
              </p>
            </article>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-4 pb-20">
          <p className="text-xs tracking-[0.16em] text-primary uppercase">How it works</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Three steps. No curve.</h2>
          <ol className="stagger mt-8 grid gap-3 md:grid-cols-3">
            {steps.map((step) => (
              <li key={step.n} className="glass-panel glass-card rounded-2xl p-6">
                <p className="font-mono text-xs text-primary">{step.n}</p>
                <h3 className="mt-3 text-lg font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="faq" className="mx-auto max-w-3xl px-4 pb-20" aria-labelledby="faq-title">
          <h2 id="faq-title" className="text-3xl font-semibold tracking-tight">
            FAQ
          </h2>
          <div className="glass-panel mt-6 divide-y divide-white/10 rounded-2xl px-5">
            {faqs.map((item, index) => {
              const shown = open === index;
              return (
                <div key={item.q}>
                  <button
                    type="button"
                    aria-expanded={shown}
                    onClick={() => setOpen(shown ? -1 : index)}
                    className="flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-medium"
                  >
                    {item.q}
                    <span className={`faq-mark text-muted ${shown ? "open" : ""}`}>+</span>
                  </button>
                  <div className="faq-panel" data-open={shown ? "true" : "false"} aria-hidden={shown ? undefined : true}>
                    <div>
                      <p className="pb-4 text-sm leading-relaxed text-muted">{item.a}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="px-4 pb-16">
          <div className="glass-panel mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 rounded-2xl px-6 py-10">
            <h2 className="max-w-md text-3xl font-semibold tracking-tight">Post the rate. Let holders swap.</h2>
            <Link
              to="/app"
              className="lift inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-ink"
            >
              Get Started
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted">
          <p className="font-semibold text-fg">FixySwap</p>
          <p>Fixed-rate desks for MetaDAO tokens.</p>
        </div>
      </footer>
    </div>
  );
}
