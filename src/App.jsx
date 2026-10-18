import React, { useState, useEffect, useCallback } from "react";
import { GameCanvas } from "./components/GameCanvas.jsx";
import { PlayerVitals } from "./components/HUD/PlayerVitals.jsx";
import { MinimapPanel } from "./components/HUD/MinimapPanel.jsx";
import { ChatPanel } from "./components/HUD/ChatPanel.jsx";
import { HotbarDock } from "./components/HUD/HotbarDock.jsx";
import { MobileControls } from "./components/MobileControls.jsx";
import { HelpModal } from "./components/Modals/HelpModal.jsx";
import { InventoryModal } from "./components/Modals/InventoryModal.jsx";
import { LoginModal } from "./components/Modals/LoginModal.jsx";
import { bridge, EVENTS } from "./game/bridge.js";
import {
  defaultQuantities,
  applyQuantities,
  setQuantities as rememberQuantities
} from "./game/items.js";
import { StorageManager } from "./game/storage.js";

const INITIAL_LOGS = [
  {
    id: "init-1",
    type: "system",
    text: "Chào mừng hiệp khách đến với Trường An."
  },
  {
    id: "init-2",
    type: "near",
    text: "Lãng Khách: Giang hồ hiểm ác, bảo trọng!"
  },
  {
    id: "init-3",
    type: "guide",
    text: "Dùng WASD di chuyển, Phím 1/2 uống dược phẩm, Chuột/Space đánh, Q kiếm khí."
  }
];

export function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem("jx2_user_session");
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      if (parsed?.token === "offline-guest-token" || String(parsed?.user?.id || "").startsWith("guest_")) {
        localStorage.removeItem("jx2_user_session");
        return null;
      }
      if (parsed?.user?.id) {
        StorageManager.setUserId(parsed.user.id);
        return parsed.user;
      }
      return null;
    } catch {
      return null;
    }
  });
  const [isLoginOpen, setIsLoginOpen] = useState(() => !currentUser);
  const [isStarted, setIsStarted] = useState(true);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [stats, setStats] = useState({
    level: 1,
    hp: 100,
    maxHp: 100,
    mp: 60,
    maxMp: 60,
    exp: 0,
    nextExp: 100,
    coins: 0,
    kills: 0,
    sta: 100,
    maxSta: 100
  });
  const [quest, setQuest] = useState({
    progress: 0,
    total: 3,
    completed: false
  });
  const [logs, setLogs] = useState(INITIAL_LOGS);

  // Inventory stack quantities are persisted in the same save slot as stats.
  // Seeding the shared in-memory store here also lets the Phaser scene persist
  // the loaded values on its first save. Resolved once at mount.
  const [{ quickItems, inventoryItems }] = useState(() =>
    applyQuantities(
      rememberQuantities(StorageManager.loadInventory(defaultQuantities()))
    )
  );

  useEffect(() => {
    const unsubStats = bridge.on(EVENTS.STATS_UPDATED, (newStats) => {
      setStats((prev) => ({ ...prev, ...newStats }));
    });

    const unsubQuest = bridge.on(EVENTS.QUEST_UPDATED, (newQuest) => {
      setQuest(newQuest);
    });

    const unsubLog = bridge.on(EVENTS.LOG_ADDED, (newLog) => {
      setLogs((prev) => [...prev.slice(-25), newLog]);
    });

    const unsubAudio = bridge.on(EVENTS.AUDIO_CHANGED, (enabled) => {
      setAudioEnabled(enabled);
    });

    const unsubStarted = bridge.on(EVENTS.GAME_STARTED, () => {
      setIsStarted(true);
      if (currentUser?.displayName || currentUser?.username) {
        bridge.emit(EVENTS.SET_PLAYER_NAME, currentUser.displayName || currentUser.username);
      }
    });

    return () => {
      unsubStats();
      unsubQuest();
      unsubLog();
      unsubAudio();
      unsubStarted();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== "Escape") return;

      if (isInventoryOpen) {
        setIsInventoryOpen(false);
        return;
      }

      setIsHelpOpen((prev) => {
        const nextState = !prev;
        bridge.emit(EVENTS.ACTION_SET_PAUSED, nextState);
        return nextState;
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isInventoryOpen]);

  const handleAttack = useCallback(() => {
    bridge.emit(EVENTS.ACTION_ATTACK);
  }, []);

  const handleSkill = useCallback(() => {
    bridge.emit(EVENTS.ACTION_SKILL);
  }, []);

  const handleUseItem = useCallback((slot) => {
    bridge.emit(EVENTS.ACTION_USE_POTION, slot);
  }, []);

  const handleMove = useCallback((direction) => {
    bridge.emit(EVENTS.ACTION_MOVE, direction);
  }, []);

  const handleSave = useCallback(() => {
    bridge.emit(EVENTS.ACTION_SAVE);
  }, []);

  const handleReset = useCallback(() => {
    if (window.confirm("Bạn có chắc chắn muốn xóa dữ liệu đã lưu và chơi lại từ đầu không?")) {
      bridge.emit(EVENTS.ACTION_RESET);
    }
  }, []);

  const handleToggleAudio = useCallback(() => {
    bridge.emit(EVENTS.ACTION_TOGGLE_AUDIO);
  }, []);

  const handleOpenHelp = useCallback(() => {
    setIsInventoryOpen(false);
    setIsHelpOpen(true);
    bridge.emit(EVENTS.ACTION_SET_PAUSED, true);
  }, []);

  const handleCloseHelp = useCallback(() => {
    setIsHelpOpen(false);
    bridge.emit(EVENTS.ACTION_SET_PAUSED, false);
  }, []);

  const handleOpenInventory = useCallback(() => {
    setIsHelpOpen(false);
    setIsInventoryOpen(true);
  }, []);

  const handleCloseInventory = useCallback(() => {
    setIsInventoryOpen(false);
  }, []);

  const handleSendMessage = useCallback((text) => {
    const sender = currentUser?.displayName || currentUser?.username || "Lãng Khách";
    bridge.emit(EVENTS.LOG_ADDED, {
      id: `${Date.now()}-${Math.random()}`,
      text: `${sender}: ${text}`,
      type: "near"
    });
    bridge.emit(EVENTS.ACTION_CHAT, { text, sender });
  }, [currentUser]);

  const handleLoginSuccess = useCallback((session) => {
    const playerName = session.user.displayName || session.user.username;
    setCurrentUser(session.user);
    StorageManager.setUserId(session.user.id);
    setIsLoginOpen(false);
    bridge.emit(EVENTS.SET_PLAYER_NAME, playerName);
    bridge.emit(EVENTS.ACTION_START);
    bridge.emit(EVENTS.LOG_ADDED, {
      id: `login-${Date.now()}`,
      text: `Hiệp khách ${playerName} đã gia nhập ${session.server || "Giang Hồ"}!`,
      type: "system"
    });
  }, []);

  const handleLogout = useCallback(() => {
    if (window.confirm("Bạn có chắc chắn muốn đăng xuất khỏi tài khoản không?")) {
      localStorage.removeItem("jx2_user_session");
      setCurrentUser(null);
      StorageManager.setUserId(null);
      setIsLoginOpen(true);
      bridge.emit(EVENTS.SET_PLAYER_NAME, "Lãng Khách");
      bridge.emit(EVENTS.ACTION_SET_PAUSED, true);
    }
  }, []);

  return (
    <main id="game-shell">
      {/* Phaser Canvas Engine */}
      <GameCanvas />

      {/* React MMORPG Wuxia HUD */}
      <div className="hud-overlay" id="hud-overlay">
        <PlayerVitals
          stats={stats}
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        <MinimapPanel
          audioEnabled={audioEnabled}
          onToggleAudio={handleToggleAudio}
          onOpenHelp={handleOpenHelp}
          quest={quest}
        />

        <ChatPanel logs={logs} onSendMessage={handleSendMessage} />

        <HotbarDock
          coins={stats.coins}
          audioEnabled={audioEnabled}
          items={quickItems}
          onUseItem={handleUseItem}
          onAttack={handleAttack}
          onSkill={handleSkill}
          onSave={handleSave}
          onInventory={handleOpenInventory}
          onOpenHelp={handleOpenHelp}
          onToggleAudio={handleToggleAudio}
          onLogout={handleLogout}
        />

        <MobileControls
          onMove={handleMove}
          onAttack={handleAttack}
          onSkill={handleSkill}
        />
      </div>

      {/* JX2 Authentic Login Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Help & Guide Modal */}
      <HelpModal
        isOpen={isHelpOpen}
        onClose={handleCloseHelp}
        onReset={handleReset}
      />

      {/* Character Inventory ("Hành trang") */}
      <InventoryModal
        isOpen={isInventoryOpen}
        onClose={handleCloseInventory}
        onUseItem={handleUseItem}
        coins={stats.coins}
        quickItems={quickItems}
        inventoryItems={inventoryItems}
      />
    </main>
  );
}
