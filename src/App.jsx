import React, { useState, useEffect, useCallback } from "react";
import { GameCanvas } from "./components/GameCanvas.jsx";
import { PlayerVitals } from "./components/HUD/PlayerVitals.jsx";
import { MinimapPanel } from "./components/HUD/MinimapPanel.jsx";
import { ChatPanel } from "./components/HUD/ChatPanel.jsx";
import { HotbarDock } from "./components/HUD/HotbarDock.jsx";
import { MobileControls } from "./components/MobileControls.jsx";
import { HelpModal } from "./components/Modals/HelpModal.jsx";
import { InventoryModal } from "./components/Modals/InventoryModal.jsx";
import { bridge, EVENTS } from "./game/bridge.js";

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
    bridge.emit(EVENTS.LOG_ADDED, {
      id: `${Date.now()}-${Math.random()}`,
      text: `Lãng Khách: ${text}`,
      type: "near"
    });
  }, []);

  return (
    <main id="game-shell">
      {/* Phaser Canvas Engine */}
      <GameCanvas />

      {/* React MMORPG Wuxia HUD */}
      <div className="hud-overlay" id="hud-overlay">
        <PlayerVitals stats={stats} />

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
          onUseItem={handleUseItem}
          onAttack={handleAttack}
          onSkill={handleSkill}
          onSave={handleSave}
          onInventory={handleOpenInventory}
          onOpenHelp={handleOpenHelp}
          onToggleAudio={handleToggleAudio}
        />

        <MobileControls
          onMove={handleMove}
          onAttack={handleAttack}
          onSkill={handleSkill}
        />
      </div>


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
      />
    </main>
  );
}
