import React, { useState, useEffect, useCallback, useRef } from "react";
import { GameCanvas } from "./components/GameCanvas.jsx";
import { PlayerVitals } from "./components/HUD/PlayerVitals.jsx";
import { MinimapPanel } from "./components/HUD/MinimapPanel.jsx";
import { ChatPanel } from "./components/HUD/ChatPanel.jsx";
import { HotbarDock } from "./components/HUD/HotbarDock.jsx";
import { MobileControls } from "./components/MobileControls.jsx";
import { HelpModal } from "./components/Modals/HelpModal.jsx";
import { InventoryModal } from "./components/Modals/InventoryModal.jsx";
import { LoginModal } from "./components/Modals/LoginModal.jsx";
import { CharacterSelectModal } from "./components/Modals/CharacterSelectModal.jsx";
import { bridge, EVENTS } from "./game/bridge.js";
import {
  defaultQuantities,
  applyQuantities,
  setQuantities as rememberQuantities
} from "./game/items.js";
import { StorageManager } from "./game/storage.js";
import { apiClient } from "./game/apiClient.js";
import {
  readSession,
  writeSession,
  persistSessionUser,
  isSessionUser,
  clearSession
} from "./game/session.js";

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

const isGuestSession = (session) =>
  session?.token === "offline-guest-token" ||
  String(session?.user?.id || "").startsWith("guest_");

/**
 * Point the persisted bag and the shared in-memory store at one character, and
 * return the render-ready inventory for the HUD. `characterId` may be null
 * (no character chosen), which falls back to the account-scoped guest bag.
 * @param {string|null} characterId
 * @returns {{ quickItems: Array<object>, inventoryItems: Array<object|null> }}
 */
const loadCharacterInventory = (characterId) => {
  StorageManager.setCharacterId(characterId || null);
  return applyQuantities(
    rememberQuantities(StorageManager.loadInventory(defaultQuantities()))
  );
};

export function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const session = readSession();
    if (!session) return null;
    if (isGuestSession(session)) {
      clearSession();
      return null;
    }
    if (session?.user?.id) {
      StorageManager.setUserId(session.user.id);
      return session.user;
    }
    return null;
  });
  const [isLoginOpen, setIsLoginOpen] = useState(() => !currentUser);
  const [activeCharacter, setActiveCharacter] = useState(() => {
    const session = readSession();
    if (!isGuestSession(session) && session?.activeCharacter?.id && session.activeCharacter.name) {
      return session.activeCharacter;
    }
    return null;
  });
  const [serverName, setServerName] = useState(() => readSession()?.server || "");
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

  // Inventory stack quantities are persisted per character and mirrored to that
  // character's server bag. Live edits (use / loot) arrive over the bridge, so the
  // HUD is no longer a mount-time snapshot.
  const [inventory, setInventory] = useState(() =>
    loadCharacterInventory(readSession()?.activeCharacter?.id)
  );

  // Bridge subscriptions live for the whole session, so they read the latest user
  // through this ref instead of a stale render's closure.
  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Re-sync the cached session against the authoritative profile so an out-of-band
  // rename in the users table reaches the HUD, the game scene and the network join.
  useEffect(() => {
    const sessionUser = currentUserRef.current;
    if (!sessionUser?.id) return;

    let isMounted = true;

    (async () => {
      try {
        const profile = await apiClient.getProfile(sessionUser.id);
        // The cached session may have been replaced (logout, account switch) while
        // the request was in flight; never overwrite a newer session with an older one.
        if (!isMounted || !profile || !isSessionUser(sessionUser.id)) return;

        const nextUser = { ...sessionUser, ...profile };
        const activeName = readSession()?.activeCharacter?.name;
        const nextName = activeName || nextUser.displayName || nextUser.username;
        const prevName = activeName || sessionUser.displayName || sessionUser.username;
        if (nextName === prevName) return;

        persistSessionUser(nextUser);
        setCurrentUser((prev) => (prev?.id === sessionUser.id ? nextUser : prev));
        bridge.emit(EVENTS.SET_PLAYER_NAME, nextName);
      } catch (error) {
        if (error?.status === 404 && isMounted && isSessionUser(sessionUser.id)) {
          // The account no longer exists: drop the stale session and ask to log in again.
          clearSession();
          setCurrentUser(null);
          setIsLoginOpen(true);
        }
        // Otherwise the backend is unreachable: keep the cached profile.
      }
    })();

    return () => {
      isMounted = false;
    };
    // Runs once on mount with the session cached at page load.
  }, []);

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

    const unsubInventory = bridge.on(EVENTS.INVENTORY_UPDATED, (next) => {
      if (next) setInventory(next);
    });

    const unsubStarted = bridge.on(EVENTS.GAME_STARTED, () => {
      setIsStarted(true);
      const user = currentUserRef.current;
      const session = readSession();
      const name =
        session?.activeCharacter?.name ||
        user?.displayName ||
        user?.username;
      if (name) {
        bridge.emit(EVENTS.SET_PLAYER_NAME, name);
      }
    });

    return () => {
      unsubStats();
      unsubQuest();
      unsubLog();
      unsubAudio();
      unsubInventory();
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
    const sender =
      activeCharacter?.name || currentUser?.displayName || currentUser?.username || "Lãng Khách";
    bridge.emit(EVENTS.LOG_ADDED, {
      id: `${Date.now()}-${Math.random()}`,
      text: `${sender}: ${text}`,
      type: "near"
    });
    bridge.emit(EVENTS.ACTION_CHAT, { text, sender });
  }, [activeCharacter, currentUser]);

  const handleLoginSuccess = useCallback((session) => {
    setCurrentUser(session.user);
    setActiveCharacter(null);
    setServerName(session.server || "");
    StorageManager.setUserId(session.user.id);
    StorageManager.setCharacterId(null);
    setIsLoginOpen(false);
  }, []);

  const handleCharacterStart = useCallback((character) => {
    writeSession({
      ...(readSession() || {}),
      activeCharacter: character,
      characterChosenAt: Date.now()
    });

    setActiveCharacter(character);
    // Switch the shared bag store to this character's own inventory before the
    // scene enters the world, so the server fallback can never leak another
    // character's items.
    setInventory(loadCharacterInventory(character.id));

    bridge.emit(EVENTS.SET_PLAYER_NAME, character.name);
    bridge.emit(EVENTS.ACTION_START);
    bridge.emit(EVENTS.LOG_ADDED, {
      id: `character-${Date.now()}`,
      text: `Hiệp khách ${character.name} đã gia nhập ${serverName || "Giang Hồ"}!`,
      type: "system"
    });
  }, [serverName]);

  const handleLogout = useCallback(() => {
    if (window.confirm("Bạn có chắc chắn muốn đăng xuất khỏi tài khoản không?")) {
      clearSession();
      setCurrentUser(null);
      setActiveCharacter(null);
      setServerName("");
      StorageManager.setUserId(null);
      StorageManager.setCharacterId(null);
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
          playerName={currentUser ? activeCharacter?.name || currentUser.username : ""}
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
          items={inventory.quickItems}
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
      {isLoginOpen && (
        <LoginModal
          isOpen={isLoginOpen}
          onLoginSuccess={handleLoginSuccess}
        />
      )}

      {/* JX2 Character Selection & Creation */}
      {!!currentUser && !activeCharacter && !isLoginOpen && (
        <CharacterSelectModal
          isOpen={true}
          user={currentUser}
          server={serverName}
          onStart={handleCharacterStart}
          onLogout={handleLogout}
        />
      )}

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
        quickItems={inventory.quickItems}
        inventoryItems={inventory.inventoryItems}
      />
    </main>
  );
}
