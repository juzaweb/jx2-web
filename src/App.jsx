import React, { useState, useEffect, useCallback, useRef } from "react";
import { GameCanvas } from "./components/GameCanvas.jsx";
import { PlayerVitals } from "./components/HUD/PlayerVitals.jsx";
import { MinimapPanel } from "./components/HUD/MinimapPanel.jsx";
import { ChatPanel } from "./components/HUD/ChatPanel.jsx";
import { HotbarDock } from "./components/HUD/HotbarDock.jsx";
import { MobileControls } from "./components/MobileControls.jsx";
import { HelpModal } from "./components/Modals/HelpModal.jsx";
import { InventoryModal } from "./components/Modals/InventoryModal.jsx";
import { CharacterModal } from "./components/Modals/CharacterModal.jsx";
import { CityMapModal } from "./components/Modals/CityMapModal.jsx";
import { LoginModal } from "./components/Modals/LoginModal.jsx";
import { CharacterSelectModal } from "./components/Modals/CharacterSelectModal.jsx";
import { SkillPickerModal } from "./components/Modals/SkillPickerModal.jsx";
import { ShopModal } from "./components/Modals/ShopModal.jsx";
import { bridge, EVENTS } from "./game/bridge.js";
import { normalizeGender } from "./game/gender.js";
import { loadSkillLoadout, saveSkillLoadout } from "./game/skillLoadout.js";
import { skillsForSect } from "./game/skills.js";
import {
  defaultQuantities,
  applyQuantities,
  setQuantities as rememberQuantities
} from "./game/items.js";
import { defaultEquipment } from "./game/equipment.js";
import { StorageManager } from "./game/storage.js";
import { useI18n } from "./i18n/I18nProvider.jsx";
import { apiClient } from "./game/apiClient.js";
import {
  readSession,
  writeSession,
  persistSessionUser,
  isSessionUser,
  clearSession
} from "./game/session.js";
import { requestLandscapeFullscreen, isMobileDevice } from "./game/orientation.js";

const INITIAL_LOGS = [
  {
    id: "init-1",
    type: "system",
    textKey: "app.log.welcome"
  },
  {
    id: "init-2",
    type: "near",
    textKey: "app.log.near"
  },
  {
    id: "init-3",
    type: "guide",
    textKey: "app.log.guide"
  }
];

const isGuestSession = (session) =>
  session?.token === "offline-guest-token" ||
  String(session?.user?.id || "").startsWith("guest_");

/** True while the user is typing in a chat/modal field, where shortcuts must not fire. */
const isTypingTarget = (target) => {
  const tag = target?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable === true;
};

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
  const { t } = useI18n();
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
  const [isCharacterOpen, setIsCharacterOpen] = useState(false);
  const [isMinimapZoomed, setIsMinimapZoomed] = useState(false);
  const [isCityMapOpen, setIsCityMapOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMinimapOpen, setIsMinimapOpen] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [pkEnabled, setPkEnabled] = useState(false);
  const [skillLoadout, setSkillLoadout] = useState(() =>
    loadSkillLoadout(readSession()?.activeCharacter?.id)
  );
  const selectedSkillSlot = skillLoadout.i;
  const leftSkillSlot = skillLoadout.u;
  const [skillPickerHand, setSkillPickerHand] = useState(null);
  const [shopNpc, setShopNpc] = useState(null);
  const [shopResult, setShopResult] = useState(null);
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

  // Worn equipment (slot -> item id), scoped per character like the bag.
  const [equipment, setEquipment] = useState(() => StorageManager.loadEquipment());

  // Bridge subscriptions live for the whole session, so they read the latest user
  // through this ref instead of a stale render's closure.
  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Switching characters loads that hero's skill layout and sect kit.
  useEffect(() => {
    const loadout = loadSkillLoadout(activeCharacter?.id);
    const kit = activeCharacter?.sect ? skillsForSect(activeCharacter.sect) : [];
    const validLeftSkills = kit.filter((skill) => skill.target !== "self");
    const firstLeftSlot = validLeftSkills[0]?.slot;
    const firstSlot = kit[0]?.slot;
    if (Number.isInteger(firstSlot)) {
      if (!kit.some((skill) => skill.slot === loadout.u)) loadout.u = firstSlot;
      if (!kit.some((skill) => skill.slot === loadout.i)) loadout.i = firstSlot;
      if (!kit.some((skill) => skill.slot === loadout.o)) loadout.o = firstSlot;
      if (!kit.some((skill) => skill.slot === loadout.p)) loadout.p = firstSlot;
      if (Number.isInteger(firstLeftSlot) && !validLeftSkills.some((skill) => skill.slot === loadout.left)) {
        loadout.left = firstLeftSlot;
      } else if (!Number.isInteger(loadout.left)) {
        loadout.left = firstLeftSlot ?? loadout.u;
      }
      if (!kit.some((skill) => skill.slot === loadout.right)) {
        loadout.right = loadout.i ?? firstSlot;
      }
    }
    setSkillLoadout(loadout);
    bridge.emit(EVENTS.SET_SKILL_LOADOUT, loadout);
    if (activeCharacter?.sect) {
      bridge.emit(EVENTS.SET_PLAYER_SECT, activeCharacter.sect);
    }
  }, [activeCharacter?.id, activeCharacter?.sect]);

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

  // Automatically attempt landscape fullscreen on mobile touch when active
  useEffect(() => {
    if (!activeCharacter || !isMobileDevice()) return;

    const handleMobileTouch = () => {
      requestLandscapeFullscreen();
    };

    window.addEventListener("touchstart", handleMobileTouch, { passive: true, once: true });
    window.addEventListener("pointerdown", handleMobileTouch, { passive: true, once: true });

    return () => {
      window.removeEventListener("touchstart", handleMobileTouch);
      window.removeEventListener("pointerdown", handleMobileTouch);
    };
  }, [activeCharacter]);

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

    const unsubPk = bridge.on(EVENTS.PK_CHANGED, (enabled) => {
      setPkEnabled(enabled);
    });

    const unsubInventory = bridge.on(EVENTS.INVENTORY_UPDATED, (next) => {
      if (next) setInventory(next);
    });

    const unsubEquipment = bridge.on(EVENTS.EQUIPMENT_UPDATED, (next) => {
      if (next?.equipment) setEquipment(next.equipment);
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

    const unsubSkillSelected = bridge.on(EVENTS.SKILL_SELECTED, (slot) => {
      if (typeof slot === "number") setSelectedSkillSlot(slot);
    });

    const unsubLeftSkillSelected = bridge.on(EVENTS.LEFT_SKILL_SELECTED, (slot) => {
      if (typeof slot === "number") setLeftSkillSlot(slot);
    });

    const unsubShopOpened = bridge.on(EVENTS.SHOP_OPENED, (npc) => {
      if (!npc?.npcId) return;
      setShopNpc(npc);
      setShopResult(null);
      bridge.emit(EVENTS.ACTION_SET_PAUSED, true);
    });

    const unsubShopResult = bridge.on(EVENTS.SHOP_RESULT, (result) => {
      setShopResult(result || null);
    });

    return () => {
      unsubStats();
      unsubQuest();
      unsubLog();
      unsubAudio();
      unsubPk();
      unsubInventory();
      unsubEquipment();
      unsubStarted();
      unsubSkillSelected();
      unsubLeftSkillSelected();
      unsubShopOpened();
      unsubShopResult();
    };
  }, []);

  // Closing the help overlay also lifts the pause it applied. Opening a docked
  // panel (character / inventory) dismisses help the same way.
  const dismissHelp = useCallback(() => {
    setIsHelpOpen(false);
    bridge.emit(EVENTS.ACTION_SET_PAUSED, false);
  }, []);

  const handleOpenCharacter = useCallback(() => {
    dismissHelp();
    setIsCharacterOpen(true);
  }, [dismissHelp]);

  const handleCloseCharacter = useCallback(() => {
    setIsCharacterOpen(false);
  }, []);

  const handleOpenInventory = useCallback(() => {
    dismissHelp();
    setIsInventoryOpen(true);
  }, [dismissHelp]);

  const handleCloseInventory = useCallback(() => {
    setIsInventoryOpen(false);
  }, []);

  const handleCloseShop = useCallback(() => {
    setShopNpc(null);
    setShopResult(null);
    bridge.emit(EVENTS.ACTION_SET_PAUSED, false);
  }, []);

  const handleBuyShopItem = useCallback((itemId) => {
    setShopResult(null);
    bridge.emit(EVENTS.ACTION_BUY_ITEM, { itemId, qty: 1 });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isTypingTarget(e.target)) return;
      if (e.repeat) return;

      // The shop is a focused modal: only Escape leaves it, so global panel
      // shortcuts cannot open a hidden window underneath the counter.
      if (shopNpc) {
        if (e.key === "Escape") {
          e.preventDefault();
          handleCloseShop();
        }
        return;
      }

      const key = e.key.toLowerCase();
      const hasOpenModal =
        isHelpOpen ||
        isInventoryOpen ||
        isCharacterOpen ||
        isCityMapOpen ||
        !!shopNpc ||
        isLoginOpen ||
        (!activeCharacter && !!currentUser);

      // Tab doubles the minimap. Leave Tab alone while a modal is open so it
      // keeps its normal focus-navigation behavior.
      if (key === "tab") {
        if (hasOpenModal) return;
        e.preventDefault();
        setIsMinimapZoomed((prev) => !prev);
        return;
      }

      // M shows the whole Biện Kinh city map.
      if (key === "m") {
        if (isLoginOpen || (!activeCharacter && currentUser)) return;
        e.preventDefault();
        if (isCityMapOpen) {
          setIsCityMapOpen(false);
        } else {
          setIsCityMapOpen(true);
          setIsHelpOpen(false);
          setIsInventoryOpen(false);
          setIsCharacterOpen(false);
          bridge.emit(EVENTS.ACTION_SET_PAUSED, false);
        }
        return;
      }

      if (e.key === "F3") {
        e.preventDefault();
        if (isCharacterOpen) {
          handleCloseCharacter();
        } else {
          handleOpenCharacter();
        }
        return;
      }

      if (e.key === "F4") {
        e.preventDefault();
        if (isInventoryOpen) {
          handleCloseInventory();
        } else {
          handleOpenInventory();
        }
        return;
      }

      if (e.key !== "Escape") return;

      if (isCityMapOpen) {
        setIsCityMapOpen(false);
        return;
      }

      if (isCharacterOpen) {
        handleCloseCharacter();
        return;
      }

      if (isInventoryOpen) {
        handleCloseInventory();
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
  }, [
    isCharacterOpen,
    isInventoryOpen,
    isHelpOpen,
    isCityMapOpen,
    isLoginOpen,
    activeCharacter,
    currentUser,
    shopNpc,
    handleOpenCharacter,
    handleCloseCharacter,
    handleOpenInventory,
    handleCloseInventory,
    handleCloseShop
  ]);

  const handleAttack = useCallback(() => {
    bridge.emit(EVENTS.ACTION_ATTACK);
  }, []);

  const handleSkill = useCallback(() => {
    bridge.emit(EVENTS.ACTION_SKILL);
  }, []);

  const handleOpenSkillPicker = useCallback((hand) => {
    dismissHelp();
    setSkillPickerHand(hand);
    bridge.emit(EVENTS.ACTION_SET_PAUSED, true);
  }, [dismissHelp]);

  const handleCloseSkillPicker = useCallback(() => {
    setSkillPickerHand(null);
    bridge.emit(EVENTS.ACTION_SET_PAUSED, false);
  }, []);

  const handleEquipSkill = useCallback(
    (hand, slot) => {
      const isKey = ["u", "i", "o", "p"].includes(hand?.toLowerCase());
      const key = isKey ? hand.toLowerCase() : hand === "left" ? "u" : "i";
      const next = {
        ...skillLoadout,
        [key]: slot,
        left: key === "u" ? slot : skillLoadout.u,
        right: key === "i" ? slot : skillLoadout.i
      };
      setSkillLoadout(next);
      saveSkillLoadout(activeCharacter?.id, next);
      bridge.emit(EVENTS.ACTION_EQUIP_SKILL, { hand, key, slot });
      bridge.emit(EVENTS.SET_SKILL_LOADOUT, next);
      setSkillPickerHand(null);
      bridge.emit(EVENTS.ACTION_SET_PAUSED, false);
    },
    [activeCharacter?.id, skillLoadout]
  );

  const handleUseItem = useCallback((slot) => {
    bridge.emit(EVENTS.ACTION_USE_POTION, slot);
  }, []);

  const handleEquipItem = useCallback((itemId) => {
    bridge.emit(EVENTS.ACTION_EQUIP_ITEM, itemId);
  }, []);

  const handleUnequipSlot = useCallback((slot) => {
    bridge.emit(EVENTS.ACTION_UNEQUIP_SLOT, slot);
  }, []);

  const handleMove = useCallback((direction) => {
    bridge.emit(EVENTS.ACTION_MOVE, direction);
  }, []);

  const handleSave = useCallback(() => {
    bridge.emit(EVENTS.ACTION_SAVE);
  }, []);

  const handleReset = useCallback(() => {
    if (window.confirm(t("app.confirmReset"))) {
      bridge.emit(EVENTS.ACTION_RESET);
    }
  }, [t]);

  const handleToggleAudio = useCallback(() => {
    bridge.emit(EVENTS.ACTION_TOGGLE_AUDIO);
  }, []);

  const handleTogglePk = useCallback(() => {
    bridge.emit(EVENTS.ACTION_TOGGLE_PK);
  }, []);

  const handleOpenHelp = useCallback(() => {
    setIsInventoryOpen(false);
    setIsCharacterOpen(false);
    setIsHelpOpen(true);
    bridge.emit(EVENTS.ACTION_SET_PAUSED, true);
  }, []);

  const handleSendMessage = useCallback((text) => {
    const sender =
      activeCharacter?.name ||
      currentUser?.displayName ||
      currentUser?.username ||
      t("app.defaultPlayerName");
    bridge.emit(EVENTS.LOG_ADDED, {
      id: `${Date.now()}-${Math.random()}`,
      text: `${sender}: ${text}`,
      type: "near"
    });
    bridge.emit(EVENTS.ACTION_CHAT, { text, sender });
  }, [activeCharacter, currentUser, t]);

  const handleLoginSuccess = useCallback((session) => {
    setCurrentUser(session.user);
    setActiveCharacter(null);
    setServerName(session.server || "");
    StorageManager.setUserId(session.user.id);
    StorageManager.setCharacterId(null);
    setEquipment(defaultEquipment());
    setIsLoginOpen(false);
  }, []);

  const handleCharacterStart = useCallback((character) => {
    requestLandscapeFullscreen();

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
    setEquipment(StorageManager.loadEquipment());

    // Set the gender before the name: the name change triggers a re-join, so the
    // join snapshot then already carries the correct gender (peers redraw from it).
    bridge.emit(EVENTS.SET_PLAYER_GENDER, normalizeGender(character.gender));
    bridge.emit(EVENTS.SET_PLAYER_NAME, character.name);
    bridge.emit(EVENTS.ACTION_START);
    bridge.emit(EVENTS.LOG_ADDED, {
      id: `character-${Date.now()}`,
      textKey: "app.joinLog",
      textParams: { name: character.name, server: serverName || t("app.serverFallback") },
      type: "system"
    });
  }, [serverName, t]);

  const handleLogout = useCallback(() => {
    if (window.confirm(t("app.confirmLogout"))) {
      clearSession();
      setCurrentUser(null);
      setActiveCharacter(null);
      setServerName("");
      StorageManager.setUserId(null);
      StorageManager.setCharacterId(null);
      setEquipment(defaultEquipment());
      setIsLoginOpen(true);
      bridge.emit(EVENTS.SET_PLAYER_GENDER, "male");
      bridge.emit(EVENTS.SET_PLAYER_NAME, t("app.defaultPlayerName"));
      bridge.emit(EVENTS.ACTION_SET_PAUSED, true);
    }
  }, [t]);

  return (
    <main id="game-shell">
      {/* Mobile Portrait Orientation Prompt */}
      <div className="mobile-orientation-hint">
        <div className="mobile-orientation-icon">📱</div>
        <div className="mobile-orientation-title">{t("app.rotateDeviceTitle")}</div>
        <div className="mobile-orientation-desc">{t("app.rotateDeviceDesc")}</div>
      </div>

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
          zoomed={isMinimapZoomed}
          collapsed={!isMinimapOpen}
          onClose={() => setIsMinimapOpen(false)}
        />

        <ChatPanel
          logs={logs}
          onSendMessage={handleSendMessage}
          collapsed={!isChatOpen}
          onClose={() => setIsChatOpen(false)}
        />

        <div className="hud-side-toggles" id="hud-side-toggles">
          <button
            type="button"
            className="hud-toggle-btn"
            title={t("minimap.mapTitle")}
            onClick={() => setIsMinimapOpen((open) => !open)}
          >
            🗺
          </button>
          <button
            type="button"
            className="hud-toggle-btn"
            title={t("chat.tabs.all")}
            onClick={() => setIsChatOpen((open) => !open)}
          >
            💬
          </button>
        </div>

        <HotbarDock
          coins={stats.coins}
          audioEnabled={audioEnabled}
          items={inventory.quickItems}
          onUseItem={handleUseItem}
          onInventory={handleOpenInventory}
          onCharacter={handleOpenCharacter}
          onOpenHelp={handleOpenHelp}
          onToggleAudio={handleToggleAudio}
          onLogout={handleLogout}
          onTogglePk={handleTogglePk}
          pkEnabled={pkEnabled}
          skills={skillsForSect(activeCharacter?.sect)}
          selectedSkillSlot={selectedSkillSlot}
          leftSkillSlot={leftSkillSlot}
          skillLoadout={skillLoadout}
          onPickSkill={handleOpenSkillPicker}
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
        onClose={dismissHelp}
        onReset={handleReset}
      />

      {/* Full-city map (M shortcut) */}
      <CityMapModal
        isOpen={isCityMapOpen}
        onClose={() => setIsCityMapOpen(false)}
      />

      {/* Herb-shop counter (talk to the Dược Sư NPC) */}
      <ShopModal
        isOpen={!!shopNpc}
        npcName={shopNpc?.name || ""}
        coins={stats.coins}
        result={shopResult}
        onBuy={handleBuyShopItem}
        onClose={handleCloseShop}
      />

      {/* Character Inventory ("Hành trang") */}
      <InventoryModal
        isOpen={isInventoryOpen}
        onClose={handleCloseInventory}
        onUseItem={handleUseItem}
        onEquipItem={handleEquipItem}
        onUnequipSlot={handleUnequipSlot}
        equipment={equipment}
        coins={stats.coins}
        quickItems={inventory.quickItems}
        inventoryItems={inventory.inventoryItems}
        capacity={inventory.capacity}
      />

      {/* Character Sheet ("Nhân vật") */}
      <CharacterModal
        isOpen={isCharacterOpen}
        onClose={handleCloseCharacter}
        stats={stats}
        playerName={currentUser ? activeCharacter?.name || currentUser.username : ""}
        equipment={equipment}
        gender={normalizeGender(activeCharacter?.gender)}
        onUnequipSlot={handleUnequipSlot}
        onEquipItem={handleEquipItem}
      />

      {/* Choose the skill bound to each mouse button */}
      <SkillPickerModal
        isOpen={skillPickerHand !== null}
        hand={skillPickerHand}
        skills={skillsForSect(activeCharacter?.sect)}
        level={stats.level}
        selectedSlot={
          ["u", "i", "o", "p"].includes(skillPickerHand?.toLowerCase())
            ? skillLoadout[skillPickerHand.toLowerCase()]
            : skillPickerHand === "left"
            ? leftSkillSlot
            : selectedSkillSlot
        }
        onSelect={handleEquipSkill}
        onClose={handleCloseSkillPicker}
      />
    </main>
  );
}
