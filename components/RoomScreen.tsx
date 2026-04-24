"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { useMultiplayerStore } from "../lib/multiplayer/syncStore";
import { readyUp, startGame, getRoomState, leaveRoom } from "../app/actions/roomActions";
import { t } from "../lib/i18n";
import { dreams, scenarios } from "../lib/data/scenarios";

export function RoomScreen() {
  const store = useMultiplayerStore();
  const [players, setPlayers] = useState<Array<{
    id: string;
    name: string;
    color: string;
    player_slot: number;
    is_ready: boolean;
    is_connected: boolean;
    scenario_id?: string;
    dream_id?: string;
    user_id: string;
  }>>([]);
  const [roomStatus, setRoomStatus] = useState("waiting");
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedScenario, setSelectedScenario] = useState(scenarios[0].id);
  const [selectedDream, setSelectedDream] = useState(dreams[0].id);
  const [isReady, setIsReady] = useState(false);

  const roomId = store.roomId;
  const userId = store.userId;
  const isHost = store.isHost;

  // Load room state and subscribe to changes
  useEffect(() => {
    if (!roomId) return;

    let cancelled = false;

    // Initial load + polling fallback (every 3s)
    const load = async () => {
      try {
        const state = await getRoomState(roomId);
        if (cancelled) return;
        if (state.players) setPlayers(state.players);
        if (state.room?.status) setRoomStatus(state.room.status);
        setLoadError(null);
        console.log("[RoomScreen] Loaded players:", state.players?.length ?? 0, state.players);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[RoomScreen] Failed to load room state:", err);
        setLoadError(msg);
      }
    };

    load();
    const pollInterval = setInterval(load, 3000);

    // Realtime subscription (best-effort)
    const supabase = createClient();
    const channel = supabase
      .channel(`room_players:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_players",
          filter: `room_id=eq.${roomId}`
        },
        () => {
          console.log("[RoomScreen] Realtime event received, reloading...");
          load();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`
        },
        (payload) => {
          const newStatus = (payload.new as { status?: string }).status;
          if (newStatus) setRoomStatus(newStatus);
        }
      )
      .subscribe((status) => {
        console.log("[RoomScreen] Realtime subscription status:", status);
      });

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [roomId]);



  const handleReady = async () => {
    if (!roomId || !userId) return;
    setIsLoading(true);
    try {
      await readyUp(roomId, userId, selectedScenario, selectedDream);
      setIsReady(true);
    } catch (err) {
      console.error("Ready up failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartGame = async () => {
    if (!roomId || !userId || !isHost) return;
    const allReady = players.every((p) => p.is_ready);
    if (!allReady) {
      alert("所有玩家必须准备后才能开始");
      return;
    }
    setIsLoading(true);
    try {
      await startGame(roomId, userId);
    } catch (err) {
      console.error("Start game failed:", err);
      alert(err instanceof Error ? err.message : "开始游戏失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!roomId || !userId) return;
    try {
      await leaveRoom(roomId, userId);
      store.clearRoom();
    } catch (err) {
      console.error("Leave room failed:", err);
    }
  };

  const canStart = isHost && players.length > 0 && players.every((p) => p.is_ready);

  if (roomStatus === "playing") {
    return (
      <div className="panel room-screen">
        <h2>{t("zh", "room.gameStarting") || "游戏开始中..."}</h2>
        <p className="text-muted text-sm">
          {t("zh", "room.waitingForState") || "等待游戏状态同步"}
        </p>
      </div>
    );
  }

  return (
    <div className="panel room-screen">
      {loadError && (
        <div style={{ padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid #f43f5e", backgroundColor: "rgba(244,63,94,0.1)", marginBottom: "1rem" }}>
          <p className="text-danger text-sm" style={{ margin: 0 }}>
            加载房间数据失败: {loadError}
          </p>
        </div>
      )}
      <div className="room-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0 }}>
            {t("zh", "room.title") || "房间"}
          </h2>
          <p className="text-muted text-sm" style={{ margin: "0.25rem 0 0 0" }}>
            {t("zh", "room.code") || "房间码"}: <strong style={{ fontSize: "1.25rem", letterSpacing: "0.15em" }}>{store.roomCode}</strong>
          </p>
        </div>
        <button className="btn btn-sm btn-danger" onClick={handleLeave}>
          {t("zh", "room.leave") || "离开"}
        </button>
      </div>

      <div className="players-list" style={{ marginTop: "1.5rem" }}>
        <h3 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>
          {t("zh", "room.players") || "玩家列表"} ({players.length}/6)
        </h3>
        {players.map((player) => (
          <div
            key={player.id}
            className="player-row"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.5rem",
              borderRadius: "0.5rem",
              backgroundColor: player.user_id === userId ? "rgba(16, 185, 129, 0.1)" : "transparent",
              border: `1px solid ${player.color}40`
            }}
          >
            <div
              className="player-color"
              style={{
                width: "1rem",
                height: "1rem",
                borderRadius: "50%",
                backgroundColor: player.color,
                flexShrink: 0
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>
                {player.name}
                {player.user_id === userId && (
                  <span className="text-muted text-sm" style={{ marginLeft: "0.5rem" }}>
                    ({t("zh", "room.you") || "你"})
                  </span>
                )}
              </div>
              <div className="text-muted text-sm">
                {player.is_ready
                  ? t("zh", "room.ready") || "已准备"
                  : t("zh", "room.notReady") || "未准备"}
              </div>
            </div>
            <div
              style={{
                width: "0.75rem",
                height: "0.75rem",
                borderRadius: "50%",
                backgroundColor: player.is_ready ? "#10b981" : "#f59e0b",
                flexShrink: 0
              }}
            />
          </div>
        ))}
      </div>

      {!isReady && (
        <div className="setup-section" style={{ marginTop: "1.5rem" }}>
          <h3 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>
            {t("zh", "room.selectRole") || "选择职业"}
          </h3>
          <div className="field">
            <label className="field-label">{t("zh", "setup.scenario") || "职业"}</label>
            <select
              className="input"
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value)}
            >
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginTop: "0.75rem" }}>
            <label className="field-label">{t("zh", "setup.dream") || "梦想"}</label>
            <select
              className="input"
              value={selectedDream}
              onChange={(e) => setSelectedDream(e.target.value)}
            >
              {dreams.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleReady}
            disabled={isLoading}
            style={{ marginTop: "1rem", width: "100%" }}
          >
            {isLoading
              ? t("zh", "multiplayer.loading") || "加载中..."
              : t("zh", "room.readyUp") || "准备"}
          </button>
        </div>
      )}

      {isHost && (
        <div className="host-controls" style={{ marginTop: "1.5rem" }}>
          <button
            className="btn btn-primary"
            onClick={handleStartGame}
            disabled={!canStart || isLoading}
            style={{ width: "100%" }}
          >
            {isLoading
              ? t("zh", "multiplayer.loading") || "加载中..."
              : t("zh", "room.startGame") || "开始游戏"}
          </button>
          {!canStart && (
            <p className="text-muted text-sm" style={{ marginTop: "0.5rem", textAlign: "center" }}>
              {t("zh", "room.waitingForReady") || "等待所有玩家准备..."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
