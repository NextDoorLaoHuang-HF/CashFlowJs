"use client";

import { useState } from "react";
import { createClient } from "../lib/supabase/client";
import { createRoom, joinRoom } from "../app/actions/roomActions";
import { useMultiplayerStore } from "../lib/multiplayer/syncStore";
import { t } from "../lib/i18n";

export function MultiplayerLobby() {
  const [mode, setMode] = useState<"menu" | "create" | "join">("menu");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const store = useMultiplayerStore();

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      setError("Please enter your name");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      if (authError) throw authError;

      const userId = authData.user?.id;
      if (!userId) throw new Error("Failed to authenticate");

      const room = await createRoom(userId);

      // Auto-join as host
      const { player } = await joinRoom(room.code, userId, playerName.trim(), "#10b981");

      store.setRoom(room.id, room.code, userId, player.player_slot, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!playerName.trim()) {
      setError("Please enter your name");
      return;
    }
    if (!roomCode.trim() || roomCode.trim().length !== 6) {
      setError("Please enter a valid 6-character room code");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      if (authError) throw authError;

      const userId = authData.user?.id;
      if (!userId) throw new Error("Failed to authenticate");

      const { room, player } = await joinRoom(roomCode.trim(), userId, playerName.trim(), "#3b82f6");

      store.setRoom(room.id, room.code, userId, player.player_slot, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join room");
    } finally {
      setIsLoading(false);
    }
  };

  if (mode === "menu") {
    return (
      <div className="panel multiplayer-lobby">
        <h2>{t("zh", "multiplayer.title") || "联机游戏"}</h2>
        <p className="text-muted text-sm">
          {t("zh", "multiplayer.subtitle") || "与朋友在不同设备上一起玩"}
        </p>
        <div className="lobby-actions" style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
          <button
            className="btn btn-primary"
            onClick={() => setMode("create")}
            style={{ flex: 1 }}
            data-testid="lobby-create-room-btn"
          >
            {t("zh", "multiplayer.createRoom") || "创建房间"}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setMode("join")}
            style={{ flex: 1 }}
            data-testid="lobby-join-room-btn"
          >
            {t("zh", "multiplayer.joinRoom") || "加入房间"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel multiplayer-lobby">
      <h2>
        {mode === "create"
          ? t("zh", "multiplayer.createRoom") || "创建房间"
          : t("zh", "multiplayer.joinRoom") || "加入房间"}
      </h2>

      <div className="field" style={{ marginTop: "1rem" }}>
        <label className="field-label">
          {t("zh", "multiplayer.yourName") || "你的名字"}
        </label>
        <input
          type="text"
          className="input"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder={t("zh", "multiplayer.namePlaceholder") || "输入昵称"}
          maxLength={20}
          data-testid="lobby-name-input"
        />
      </div>

      {mode === "join" && (
        <div className="field" style={{ marginTop: "1rem" }}>
          <label className="field-label">
            {t("zh", "multiplayer.roomCode") || "房间码"}
          </label>
          <input
            type="text"
            className="input"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder={t("zh", "multiplayer.codePlaceholder") || "6位房间码"}
            maxLength={6}
            style={{ textTransform: "uppercase", letterSpacing: "0.2em", fontSize: "1.25rem" }}
            data-testid="lobby-code-input"
          />
        </div>
      )}

      {error && (
        <p className="text-danger text-sm" style={{ marginTop: "0.5rem" }}>
          {error}
        </p>
      )}

      <div className="lobby-actions" style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
        <button
          className="btn btn-secondary"
          onClick={() => {
            setMode("menu");
            setError(null);
          }}
          style={{ flex: 1 }}
          data-testid="lobby-back-btn"
        >
          {t("zh", "setup.prev") || "返回"}
        </button>
        <button
          className="btn btn-primary"
          onClick={mode === "create" ? handleCreateRoom : handleJoinRoom}
          disabled={isLoading}
          style={{ flex: 1 }}
          data-testid="lobby-submit-btn"
        >
          {isLoading
            ? t("zh", "multiplayer.loading") || "加载中..."
            : mode === "create"
              ? t("zh", "multiplayer.create") || "创建"
              : t("zh", "multiplayer.join") || "加入"}
        </button>
      </div>
    </div>
  );
}
