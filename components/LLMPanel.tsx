"use client";

import { useState } from "react";
import { useGameStore } from "../lib/state/gameStore";
import { dreams } from "../lib/data/scenarios";
import { t } from "../lib/i18n";

export function LLMPanel() {
  const { players, logs, settings, recordLLMAction, board } = useGameStore((state) => ({
    players: state.players,
    logs: state.logs,
    settings: state.settings,
    recordLLMAction: state.recordLLMAction,
    board: state.board
  }));

  const aiPlayers = players.filter((player) => player.isLLM);
  const [selectedPlayerId, setSelectedPlayerId] = useState(aiPlayers[0]?.id ?? "");
  const [prompt, setPrompt] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ summary: string; decision: string } | null>(null);

  const handleRun = async () => {
    const player = players.find((p) => p.id === selectedPlayerId);
    if (!player) return;
    setLoading(true);
    try {
      const response = await fetch("/api/llm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey || undefined,
          model: player.llmModel ?? "gpt-4o-mini",
          prompt: prompt || player.llmPersona,
          state: {
            player,
            board,
            dreams,
            log: logs.slice(-12),
            locale: settings.locale
          }
        })
      });
      const data = await response.json();
      if (data?.action) {
        setResult({ summary: data.action.summary, decision: data.action.decision });
        recordLLMAction(player.id, data.action);
      }
    } finally {
      setLoading(false);
    }
  };

  if (aiPlayers.length === 0) {
    return null;
  }

  return (
    <div className="card grid" style={{ gap: "0.5rem" }}>
      <h3 style={{ margin: 0 }}>{t(settings.locale, "llm.title")}</h3>
      <select
        value={selectedPlayerId}
        onChange={(e) => setSelectedPlayerId(e.target.value)}
        style={{
          borderRadius: 8,
          padding: "0.45rem 0.65rem",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.04)",
          color: "#fff"
        }}
      >
        {aiPlayers.map((player) => (
          <option key={player.id} value={player.id}>
            {player.name}
          </option>
        ))}
      </select>
      <input
        type="password"
        placeholder="Temporary OpenAI API key (optional)"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        style={{
          borderRadius: 8,
          padding: "0.45rem 0.65rem",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.04)",
          color: "#fff"
        }}
      />
      <textarea
        placeholder="Additional instructions"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        style={{
          borderRadius: 8,
          padding: "0.45rem 0.65rem",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.04)",
          color: "#fff",
          minHeight: "70px"
        }}
      />
      <button
        onClick={handleRun}
        disabled={loading}
        style={{
          borderRadius: 10,
          padding: "0.5rem 0.75rem",
          background: loading ? "rgba(255,255,255,0.09)" : "rgba(14,165,233,0.3)",
          color: "#fff"
        }}
      >
        {loading ? "…" : t(settings.locale, "llm.run")}
      </button>
      {result && (
        <div style={{ borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", padding: "0.5rem" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Decision: {result.decision}</div>
          <p style={{ margin: "0.35rem 0" }}>{result.summary}</p>
        </div>
      )}
    </div>
  );
}
