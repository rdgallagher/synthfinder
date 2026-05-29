"use client";

import { useState, useRef } from "react";
import type { ScoredListing } from "@synthfinder/shared";

const TIER_ORDER: Record<string, number> = {
  "strong-bargain": 0,
  "fair-deal": 1,
  overpriced: 2,
};

const TIER_LABEL: Record<string, string> = {
  "strong-bargain": "Strong Bargain",
  "fair-deal": "Fair Deal",
  overpriced: "Overpriced",
};

const TIER_COLOR: Record<string, string> = {
  "strong-bargain": "var(--tier-bargain)",
  "fair-deal": "var(--tier-fair)",
  overpriced: "var(--tier-over)",
};

function centsToUSD(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function ResultCard({ scored }: { scored: ScoredListing }) {
  const { normalizedListing: nl, dealTier, comparables } = scored;
  const { originalListing: ol } = nl;

  return (
    <div
      style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 14,
        marginBottom: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            background: TIER_COLOR[dealTier],
            color: "#fff",
            fontSize: 11,
            fontWeight: "bold",
            padding: "2px 10px",
            borderRadius: 12,
          }}
        >
          {TIER_LABEL[dealTier]}
        </span>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "var(--text)", fontWeight: "bold" }}>
            {centsToUSD(nl.price)}
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
            {comparables}
          </div>
        </div>
      </div>
      <div
        style={{
          color: "var(--text)",
          fontSize: 14,
          fontWeight: 500,
          marginBottom: 8,
        }}
      >
        {ol.title}
      </div>
      <div
        style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}
      >
        {nl.extras.map((e, i) => (
          <span
            key={i}
            style={{
              background: "var(--chip-green-bg)",
              color: "var(--green)",
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 12,
            }}
          >
            {e}
          </span>
        ))}
        {nl.redFlags.map((f, i) => (
          <span
            key={i}
            style={{
              background: "var(--chip-red-bg)",
              color: "var(--red)",
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 12,
            }}
          >
            ⚠ {f}
          </span>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid var(--border)",
          paddingTop: 8,
        }}
      >
        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
          {nl.conditionTier} · {ol.marketplace}
        </span>
        <a
          href={ol.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--accent)", fontSize: 12 }}
        >
          ↗ View on Reverb
        </a>
      </div>
    </div>
  );
}

export default function Home() {
  const [model, setModel] = useState("Roland Juno-106");
  const [scanning, setScanning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [results, setResults] = useState<ScoredListing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  async function startScan() {
    setScanning(true);
    setLog([]);
    setResults([]);
    setError(null);

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });

      if (!response.ok || !response.body) {
        setError(`Request failed: ${response.status}`);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          if (!part.trim()) continue;
          const lines = part.split("\n");
          const eventType = lines
            .find((l) => l.startsWith("event:"))
            ?.slice(6)
            .trim();
          const dataStr = lines
            .find((l) => l.startsWith("data:"))
            ?.slice(5)
            .trim();
          if (!eventType || !dataStr) continue;

          const data = JSON.parse(dataStr) as Record<string, unknown>;

          if (eventType === "progress") {
            setLog((prev) => [...prev, data.message as string]);
            setTimeout(() => {
              if (logRef.current)
                logRef.current.scrollTop = logRef.current.scrollHeight;
            }, 0);
          } else if (eventType === "result") {
            setResults((prev) =>
              [...prev, data.listing as ScoredListing].sort(
                (a, b) => TIER_ORDER[a.dealTier] - TIER_ORDER[b.dealTier],
              ),
            );
          } else if (eventType === "error") {
            setError(data.message as string);
          }
        }
      }
    } finally {
      setScanning(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: "var(--bg)",
        fontFamily: "var(--font-geist-sans)",
        overflow: "hidden",
      }}
    >
      {/* Left panel: form + progress log */}
      <div
        style={{
          width: "40%",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          padding: 20,
          gap: 16,
          minHeight: 0,
        }}
      >
        <h1 style={{ color: "var(--text)", fontSize: 20, fontWeight: "bold" }}>
          SynthFinder
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={scanning}
            placeholder="e.g. Roland Juno-106"
            style={{
              flex: 1,
              background: "var(--bg-panel)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "8px 12px",
              color: "var(--text)",
              fontSize: 14,
            }}
          />
          <button
            onClick={startScan}
            disabled={scanning || !model.trim()}
            style={{
              background: scanning ? "var(--border)" : "#238636",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "8px 16px",
              cursor: scanning ? "not-allowed" : "pointer",
              fontSize: 14,
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            {scanning ? "Scanning…" : "Scan"}
          </button>
        </div>
        {error && (
          <div
            style={{
              background: "var(--chip-red-bg)",
              color: "var(--red)",
              border: "1px solid var(--red)",
              borderRadius: 6,
              padding: "8px 12px",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}
        <div
          ref={logRef}
          style={{
            flex: 1,
            background: "var(--bg-panel)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: 12,
            overflowY: "auto",
            fontFamily: "var(--font-geist-mono)",
            fontSize: 12,
            color: "var(--green)",
            lineHeight: 1.6,
            minHeight: 0,
          }}
        >
          {log.length === 0 ? (
            <span style={{ color: "var(--text-muted)" }}>
              Enter a model and click Scan
            </span>
          ) : (
            log.map((line, i) => <div key={i}>{line}</div>)
          )}
        </div>
      </div>

      {/* Right panel: result cards */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 20,
        }}
      >
        {results.length === 0 ? (
          <div
            style={{
              color: "var(--text-muted)",
              fontSize: 14,
              marginTop: 40,
              textAlign: "center",
            }}
          >
            Results will appear here as the scan runs
          </div>
        ) : (
          results.map((scored, i) => <ResultCard key={i} scored={scored} />)
        )}
      </div>
    </div>
  );
}
