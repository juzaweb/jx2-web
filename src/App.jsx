import React, { Suspense, lazy, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { PlayerVitals } from "./components/HUD/PlayerVitals.jsx";
import { TargetVitals } from "./components/HUD/TargetVitals.jsx";
import { MinimapPanel } from "./components/HUD/MinimapPanel.jsx";
import { ChatPanel } from "./components/HUD/ChatPanel.jsx";
import { HotbarDock } from "./components/HUD/HotbarDock.jsx";
import { MobileControls } from "./components/MobileControls.jsx";
import { MobileSkillPicker } from "./components/MobileSkillPicker.jsx";
import { MobileItemPicker } from "./components/MobileItemPicker.jsx";
import { useMobileSlotPicker } from "./components/hooks/useMobileSlotPicker.js";
import { HelpModal } from "./components/Modals/HelpModal.jsx";
import { InventoryModal } from "./components/Modals/InventoryModal.jsx";
import { CharacterModal } from "./components/Modals/CharacterModal.jsx";
import { CityMapModal } from "./components/Modals/CityMapModal.jsx";
import { LoginModal } from "./components/Modals/LoginModal.jsx";
import { CharacterSelectModal } from "./components/Modals/CharacterSelectModal.jsx";
import { SkillsModal } from "./components/Modals/SkillsModal.jsx";
import { ShopModal } from "./components/Modals/ShopModal.jsx";
import { NpcDialogModal } from "./components/Modals/NpcDialogModal.jsx";
import { QuestLogModal } from "./components/Modals/QuestLogModal.jsx";
import { GmModal } from "./components/Modals/GmModal.jsx";
import { bridge, EVENTS } from "./game/bridge.js";
import { activeQuestView } from "./game/questView.js";
import { normalizeGender } from "./game/gender.js";
import {
  loadMobileSkills,
  assignMobileSkill
} from "./game/mobileSkills.js";
import {
  loadMobileItems,
  assignMobileItem
} from "./game/mobileItems.js";
import {
  loadQuickSlots,
  assignQuickSlot,
  clearQuickSlot,
  moveQuickSlot,
  skillBinding
} from "./game/quickSlots.js";
import { skillsForSect } from "./game/skills.js";
import { DEFAULT_SECT, normalizeSect } from "./game/sects.js";
import {
  applyQuantities,
  bagQuantity,
  CONSUMABLE_ITEMS,
  GUIDE_ITEM_ID,
  NEWBIE_LETTER_ID,
  setQuantities as rememberQuantities
} from "./game/items.js";
import { defaultEquipment, equippedWeaponType } from "./game/equipment.js";
import { StorageManager } from "./game/storage.js";
import { SERVER_NAME } from "./game/serverConfig.js";
import { useI18n } from "./i18n/I18nProvider.jsx";
import { apiClient } from "./game/apiClient.js";
import {
  readSession,
  writeSession,
  persistSessionUser,
  isSessionUser,
  clearSession
} from "./game/session.js";
import { requestLandscapeFullscreen, isMobileDevice, usesTouchControls } from "./game/orientation.js";

// Phaser + the whole game scene graph live behind this boundary so the login and
// lobby UI never wait for the ~1.2 MB engine bundle to download and parse.
const GameCanvas = lazy(() =>
  import("./components/GameCanvas.jsx").then((module) => ({ default: module.GameCanvas }))
);

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
 * return the render-ready inventory for the HUD. The bag is character-scoped
 * locally because it is the source for the one-time legacy import.
 * @param {string|null} characterId
 * @returns {{ quickItems: Array<object>, inventoryItems: Array<object|null> }}
 */
const loadCharacterInventory = (characterId) => {
  StorageManager.setCharacterId(characterId || null);
  return applyQuantities(
    rememberQuantities(StorageManager.loadInventory())
  );
};

/**
 * Stable module references for the two mobile binding stores. Passing an inline
 * object would change identity every render and re-trigger the picker hook's
 * character effect (which reloads from storage).
 */
const MOBILE_SKILL_BINDINGS = {
  load: loadMobileSkills,
  assign: assignMobileSkill
};
const MOBILE_ITEM_BINDINGS = {
  load: loadMobileItems,
  assign: assignMobileItem
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
  const [isStarted, setIsStarted] = useState(true);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isCharacterOpen, setIsCharacterOpen] = useState(false);
  const [isSkillsOpen, setIsSkillsOpen] = useState(false);
  const [isMinimapZoomed, setIsMinimapZoomed] = useState(false);
  const [isCityMapOpen, setIsCityMapOpen] = useState(false);
  const [isGmOpen, setIsGmOpen] = useState(false);
  // Side panels start open on desktop, but minimized on mobile/touch controls
  // to avoid cluttering small touch displays.
  const [isChatOpen, setIsChatOpen] = useState(() => !usesTouchControls());
  const [isMinimapOpen, setIsMinimapOpen] = useState(() => !usesTouchControls());
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [pkEnabled, setPkEnabled] = useState(false);
  const [quickSlots, setQuickSlots] = useState(() =>
    loadQuickSlots(readSession()?.activeCharacter?.id)
  );
  const [shopNpc, setShopNpc] = useState(null);
  const [shopResult, setShopResult] = useState(null);
  // Server-authoritative newbie quest chain, the NPC currently being talked to
  // and the nearest in-range NPC for the mobile talk button.
  const [questState, setQuestState] = useState(null);
  const [isQuestLogOpen, setIsQuestLogOpen] = useState(false);
  const [npcDialog, setNpcDialog] = useState(null);
  const [nearbyNpc, setNearbyNpc] = useState(null);
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
  const [logs, setLogs] = useState(INITIAL_LOGS);
  const [targetVitals, setTargetVitals] = useState(null);
  const targetVitalsRef = useRef(targetVitals);
  targetVitalsRef.current = targetVitals;

  // Inventory stack quantities are persisted per character and mirrored to that
  // character's server bag. Live edits (use / loot) arrive over the bridge, so the
  // HUD is no longer a mount-time snapshot.
  const [inventory, setInventory] = useState(() =>
    loadCharacterInventory(readSession()?.activeCharacter?.id)
  );

  // Consumables the mobile HP/MP buttons can be bound to, with the stack the bag
  // currently holds so the picker can grey out what has run out.
  const mobileItemOptions = useMemo(
    () =>
      CONSUMABLE_ITEMS.map((item) => ({
        ...item,
        qty: bagQuantity(item.id, inventory.inventoryItems)
      })),
    [inventory]
  );

  // Worn equipment (slot -> item id), scoped per character like the bag.
  const [equipment, setEquipment] = useState(() => StorageManager.loadEquipment());
  // Learned skill ids, mirrored from the server (`skills_sync`). Starter skills
  // (Kiếm Khí) are always known and are not listed here.
  const [learnedSkills, setLearnedSkills] = useState([]);
  // skill id -> level (1..MAX_SKILL_LEVEL), mirrored from `skills_sync`.
  const [skillLevels, setSkillLevels] = useState({});
  // Sect published by the server with `skills_sync`; it wins over the cached
  // session copy, which may predate the sect system.
  const [serverSect, setServerSect] = useState(null);

  // Bridge subscriptions live for the whole session, so they read the latest user
  // through this ref instead of a stale render's closure.
  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Switching characters loads that hero's hotbar assignments (items or skills)
  // and clears the sect cached from the previous hero's `skills_sync`.
  useEffect(() => {
    const loadedQuickSlots = loadQuickSlots(activeCharacter?.id);
    setQuickSlots(loadedQuickSlots);
    setServerSect(null);
    bridge.emit(EVENTS.SET_QUICK_SLOTS, loadedQuickSlots);
  }, [activeCharacter?.id]);

  // The worn weapon decides the skill kit. Tell the scene whenever it changes so
  // its VFX and cast gate follow the equipment the server published.
  useEffect(() => {
    const weaponType = equippedWeaponType(equipment);
    if (weaponType) bridge.emit(EVENTS.SET_PLAYER_WEAPON, weaponType);
  }, [equipment]);

  const handleAssignQuickSlot = useCallback(
    (targetSlot, itemId) => {
      const next = assignQuickSlot(activeCharacter?.id, quickSlots, targetSlot, itemId);
      setQuickSlots(next);
      bridge.emit(EVENTS.SET_QUICK_SLOTS, next);
    },
    [activeCharacter?.id, quickSlots]
  );

  const handleClearQuickSlot = useCallback(
    (slot) => {
      const next = clearQuickSlot(activeCharacter?.id, quickSlots, slot);
      setQuickSlots(next);
      bridge.emit(EVENTS.SET_QUICK_SLOTS, next);
    },
    [activeCharacter?.id, quickSlots]
  );

  const handleMoveQuickSlot = useCallback(
    (fromSlot, toSlot) => {
      const next = moveQuickSlot(activeCharacter?.id, quickSlots, fromSlot, toSlot);
      setQuickSlots(next);
      bridge.emit(EVENTS.SET_QUICK_SLOTS, next);
    },
    [activeCharacter?.id, quickSlots]
  );

  // Skills drawn from the F5 tree are dropped onto a numbered slot.
  const handleAssignSkill = useCallback(
    (slot, skillId) => {
      if (!skillId) return;
      handleAssignQuickSlot(slot, skillBinding(skillId));
    },
    [handleAssignQuickSlot]
  );

  // Levelling is server-owned: the panel only names the skill and shows the
  // price, the server validates and debits silver + EXP.
  const handleUpgradeSkill = useCallback((skillId) => {
    if (!skillId) return;
    bridge.emit(EVENTS.ACTION_UPGRADE_SKILL, { skillId });
  }, []);

  // Studying is server-owned too: the panel names the art, the server checks the
  // sect, the level/prerequisites and the silver + EXP price before recording it.
  const handleLearnSkill = useCallback((skillId) => {
    if (!skillId) return;
    bridge.emit(EVENTS.ACTION_LEARN_SKILL, { skillId });
  }, []);

  // Re-sync the cached session against the authoritative profile so an out-of-band
  // rename in the users table reaches the HUD, the game scene and the network join.
  useEffect(() => {
    const sessionUser = currentUserRef.current;
    if (!sessionUser?.id) return;

    let isMounted = true;

    (async () => {
      try {
        const profile = await apiClient.getProfile(sessionUser.id, sessionUser.token || readSession()?.token);
        // The cached session may have been replaced (logout, account switch) while
        // the request was in flight; never overwrite a newer session with an older one.
        if (!isMounted || !profile || !isSessionUser(sessionUser.id)) return;

        const nextUser = { ...sessionUser, ...profile };
        const activeName = readSession()?.activeCharacter?.name;
        const nextName = activeName || nextUser.displayName || nextUser.username;
        const prevName = activeName || sessionUser.displayName || sessionUser.username;
        if (nextName !== prevName) {
          persistSessionUser(nextUser);
          setCurrentUser((prev) => (prev?.id === sessionUser.id ? nextUser : prev));
          bridge.emit(EVENTS.SET_PLAYER_NAME, nextName);
        }

        // Validate that cached activeCharacter still exists on the server
        const charData = await apiClient.listCharacters(sessionUser.id, sessionUser.token || readSession()?.token);
        if (!isMounted || !isSessionUser(sessionUser.id)) return;
        const serverChars = Array.isArray(charData?.characters) ? charData.characters : [];
        const currentActive = readSession()?.activeCharacter;
        if (currentActive?.id && !serverChars.some((c) => c.id === currentActive.id)) {
          console.warn("[App] Active character no longer exists on server, falling back to selection");
          setActiveCharacter(null);
          writeSession({
            ...(readSession() || {}),
            activeCharacter: null
          });
        }
      } catch (error) {
        if ((error?.status === 401 || error?.status === 404) && isMounted && isSessionUser(sessionUser.id)) {
          // The account no longer exists or the session token is expired: drop the stale session and ask to log in again.
          console.warn(`[App] Session invalid (${error.status}), clearing cached session.`);
          clearSession();
          setCurrentUser(null);
          setActiveCharacter(null);
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

    const unsubQuests = bridge.on(EVENTS.QUESTS_UPDATED, (next) => {
      setQuestState(next || null);
    });

    const unsubDialog = bridge.on(EVENTS.NPC_DIALOG_OPENED, (next) => {
      if (!next?.npc) return;
      setNpcDialog(next.npc);
      setIsQuestLogOpen(false);
    });

    const unsubDialogClosed = bridge.on(EVENTS.NPC_DIALOG_CLOSED, () => {
      setNpcDialog(null);
    });

    const unsubNearbyNpc = bridge.on(EVENTS.NEARBY_NPC_CHANGED, (next) => {
      setNearbyNpc(next || null);
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

    const unsubTarget = bridge.on(EVENTS.TARGET_UPDATED, (next) => {
      setTargetVitals(next || null);
    });

    // Server-authoritative learned skills and their levels: replaced wholesale on
    // every sync, on every successful book study and on every upgrade.
    const unsubSkills = bridge.on(EVENTS.SKILLS_UPDATED, (next) => {
      setLearnedSkills(Array.isArray(next?.skills) ? next.skills : []);
      setSkillLevels(next?.levels && typeof next.levels === "object" ? next.levels : {});
      if (typeof next?.sect === "string" && next.sect) setServerSect(next.sect);
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

    const unsubShopOpened = bridge.on(EVENTS.SHOP_OPENED, (npc) => {
      if (!npc?.npcId) return;
      setShopNpc(npc);
      setShopResult(null);
      bridge.emit(EVENTS.ACTION_SET_PAUSED, true);
    });

    const unsubShopResult = bridge.on(EVENTS.SHOP_RESULT, (result) => {
      setShopResult(result || null);
    });

    const unsubNetwork = bridge.on(EVENTS.NETWORK_STATE, (state) => {
      if (!state?.connected) {
        setIsChatOpen(true);
      }
    });

    const unsubConnectionIssue = bridge.on(EVENTS.CONNECTION_ISSUE, () => {
      setIsChatOpen(true);
    });

    const unsubGmModal = bridge.on(EVENTS.GM_MODAL_TOGGLE, () => {
      setIsGmOpen((prev) => !prev);
    });

    return () => {
      unsubStats();
      unsubQuests();
      unsubDialog();
      unsubDialogClosed();
      unsubNearbyNpc();
      unsubLog();
      unsubAudio();
      unsubPk();
      unsubInventory();
      unsubEquipment();
      unsubTarget();
      unsubSkills();
      unsubStarted();
      unsubShopOpened();
      unsubShopResult();
      unsubNetwork();
      unsubConnectionIssue();
      unsubGmModal();
    };
  }, []);

  // Closing the help overlay also lifts the pause it applied. Opening a docked
  // panel (character / inventory) dismisses help the same way.
  const dismissHelp = useCallback(() => {
    setIsHelpOpen(false);
    bridge.emit(EVENTS.ACTION_SET_PAUSED, false);
  }, []);

  // Mobile bindings + the picker that edits them. The skill fan and the
  // consumable column are the same interaction on the same storage shape, so one
  // hook drives both (see `useMobileSlotPicker`).
  const mobileSkillsPicker = useMobileSlotPicker({
    characterId: activeCharacter?.id,
    store: MOBILE_SKILL_BINDINGS,
    onBeforeOpen: dismissHelp
  });
  const mobileItemsPicker = useMobileSlotPicker({
    characterId: activeCharacter?.id,
    store: MOBILE_ITEM_BINDINGS,
    onBeforeOpen: dismissHelp
  });

  const handleOpenCharacter = useCallback(() => {
    dismissHelp();
    setIsCharacterOpen(true);
  }, [dismissHelp]);

  const handleToggleCharacter = useCallback(() => {
    dismissHelp();
    setIsCharacterOpen((prev) => !prev);
  }, [dismissHelp]);

  const handleCloseCharacter = useCallback(() => {
    setIsCharacterOpen(false);
  }, []);

  const handleOpenInventory = useCallback(() => {
    dismissHelp();
    setIsInventoryOpen(true);
  }, [dismissHelp]);

  const handleToggleInventory = useCallback(() => {
    dismissHelp();
    setIsInventoryOpen((prev) => !prev);
  }, [dismissHelp]);

  const handleCloseInventory = useCallback(() => {
    setIsInventoryOpen(false);
  }, []);

  const handleOpenSkills = useCallback(() => {
    dismissHelp();
    setIsSkillsOpen(true);
  }, [dismissHelp]);

  const handleCloseSkills = useCallback(() => {
    setIsSkillsOpen(false);
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

  const handleClearTarget = useCallback(() => {
    bridge.emit(EVENTS.ACTION_CLEAR_TARGET);
    setTargetVitals(null);
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

      // An open NPC dialog owns the keyboard the same way the shop does.
      if (npcDialog) {
        if (e.key === "Escape") {
          e.preventDefault();
          bridge.emit(EVENTS.ACTION_CLOSE_NPC_DIALOG);
        }
        return;
      }

      const key = e.key.toLowerCase();
      const hasOpenModal =
        isHelpOpen ||
        isInventoryOpen ||
        isCharacterOpen ||
        isSkillsOpen ||
        isCityMapOpen ||
        isQuestLogOpen ||
        mobileSkillsPicker.isPickerOpen ||
        mobileItemsPicker.isPickerOpen ||
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

      // M shows the whole city map.
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
          setIsSkillsOpen(false);
          bridge.emit(EVENTS.ACTION_SET_PAUSED, false);
        }
        return;
      }

      if (e.key === "F5") {
        e.preventDefault();
        if (isSkillsOpen) {
          handleCloseSkills();
        } else {
          handleOpenSkills();
        }
        return;
      }

      // J opens the newbie quest journal (nhật ký nhiệm vụ).
      if (key === "j") {
        if (isLoginOpen || (!activeCharacter && currentUser)) return;
        e.preventDefault();
        setIsQuestLogOpen((prev) => {
          const next = !prev;
          bridge.emit(EVENTS.ACTION_SET_PAUSED, next);
          return next;
        });
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

      if (mobileSkillsPicker.isPickerOpen) {
        mobileSkillsPicker.close();
        return;
      }

      if (mobileItemsPicker.isPickerOpen) {
        mobileItemsPicker.close();
        return;
      }

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

      if (isSkillsOpen) {
        handleCloseSkills();
        return;
      }

      if (isQuestLogOpen) {
        setIsQuestLogOpen(false);
        bridge.emit(EVENTS.ACTION_SET_PAUSED, false);
        return;
      }

      if (targetVitalsRef.current) {
        handleClearTarget();
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
    handleClearTarget,
    activeCharacter,
    currentUser,
    shopNpc,
    npcDialog,
    isQuestLogOpen,
    mobileSkillsPicker.isPickerOpen,
    mobileSkillsPicker.close,
    mobileItemsPicker.isPickerOpen,
    mobileItemsPicker.close,
    handleOpenCharacter,
    handleCloseCharacter,
    handleOpenInventory,
    handleCloseInventory,
    handleCloseShop
  ]);

  const handleAttack = useCallback(() => {
    bridge.emit(EVENTS.ACTION_ATTACK);
  }, []);

  const handleCastSkill = useCallback((skillId) => {
    if (!skillId) return;
    bridge.emit(EVENTS.ACTION_CAST_SKILL, { skillId });
  }, []);

  const handleUseItem = useCallback((slot) => {
    // The guide book opens the quest journal instead of being consumed.
    if (slot === GUIDE_ITEM_ID) {
      setIsQuestLogOpen(true);
      bridge.emit(EVENTS.ACTION_SET_PAUSED, true);
      return;
    }
    // The letter is delivered through the quest dialog, never drunk/used.
    if (slot === NEWBIE_LETTER_ID) {
      bridge.emit(EVENTS.LOG_ADDED, {
        id: `${Date.now()}-letter`,
        text: t("quests.letterHint"),
        type: "system"
      });
      return;
    }
    bridge.emit(EVENTS.ACTION_USE_POTION, slot);
  }, [t]);

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

  const handleToggleAudio = useCallback(() => {
    bridge.emit(EVENTS.ACTION_TOGGLE_AUDIO);
  }, []);

  const handleTogglePk = useCallback(() => {
    bridge.emit(EVENTS.ACTION_TOGGLE_PK);
  }, []);

  const handleOpenHelp = useCallback(() => {
    setIsInventoryOpen(false);
    setIsCharacterOpen(false);
    setIsSkillsOpen(false);
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
    setCurrentUser({ ...session.user, token: session.token });
    setActiveCharacter(null);
    setConnectionIssue(null);
    setLearnedSkills([]);
    setSkillLevels({});
    StorageManager.setUserId(session.user.id);
    StorageManager.setCharacterId(null);
    setEquipment(defaultEquipment());
    setIsLoginOpen(false);
  }, []);

  const handleCharacterStart = useCallback(async (character) => {
    requestLandscapeFullscreen();
    // Entering the world opens the map and chat by default on desktop, or minimizes
    // them on mobile/touch devices.
    const isTouch = usesTouchControls();
    setIsMinimapOpen(!isTouch);
    setIsChatOpen(!isTouch);

    writeSession({
      ...(readSession() || {}),
      activeCharacter: character,
      characterChosenAt: Date.now()
    });

    setActiveCharacter(character);
    setLearnedSkills([]);
    setSkillLevels({});
    // Switch the shared bag store to this character's own inventory before the
    // scene enters the world, so the server fallback can never leak another
    // character's items.
    const localInventory = loadCharacterInventory(character.id);
    const localEquipment = StorageManager.loadEquipment();
    setInventory(localInventory);
    setEquipment(localEquipment);

    // One-time migration of a bag/gear saved before the server owned them. The
    // server gates this on `state_imported`, so calling it on every entry is
    // safe; a successful import becomes the canonical state and the local
    // copies are dropped.
    const token = readSession()?.token;
    const legacyBag = StorageManager.loadInventory();
    const hasLegacy =
      Object.keys(legacyBag).length > 0 ||
      Object.values(localEquipment).some((id) => typeof id === "string");
    if (token && hasLegacy) {
      try {
        const state = await apiClient.importState(character.id, legacyBag, localEquipment, token);
        setInventory(applyQuantities(rememberQuantities(state.inventory)));
        setEquipment(state.equipment);
        StorageManager.clearInventory();
        StorageManager.clearEquipment();
      } catch {
        // A refused import is not fatal: the server bag stays authoritative.
      }
    }

    // Set the gender before the name: the name change triggers a re-join, so the
    // join snapshot then already carries the correct gender (peers redraw from it).
    bridge.emit(EVENTS.SET_PLAYER_GENDER, normalizeGender(character.gender));
    bridge.emit(EVENTS.SET_PLAYER_NAME, character.name);
    bridge.emit(EVENTS.ACTION_START);
    bridge.emit(EVENTS.LOG_ADDED, {
      id: `character-${Date.now()}`,
      textKey: "app.joinLog",
      textParams: { name: character.name, server: SERVER_NAME },
      type: "system"
    });
  }, []);

  // Drop the current session and return to the login screen. No confirmation:
  // this is reached from a connection gate the player cannot dismiss otherwise.
  const resetToLogin = useCallback(() => {
    clearSession();
    setCurrentUser(null);
    setActiveCharacter(null);
    setLearnedSkills([]);
    setSkillLevels({});
    StorageManager.setUserId(null);
    StorageManager.setCharacterId(null);
    setEquipment(defaultEquipment());
    setIsLoginOpen(true);
    bridge.emit(EVENTS.SET_PLAYER_GENDER, "male");
    bridge.emit(EVENTS.SET_PLAYER_NAME, t("app.defaultPlayerName"));
    bridge.emit(EVENTS.ACTION_SET_PAUSED, true);
    // Emit last: SET_PLAYER_NAME re-joins, and the leave must win so the socket
    // stops reconnecting while the login screen is up.
    bridge.emit(EVENTS.ACTION_LEAVE_WORLD);
  }, [t]);

  const handleLogout = useCallback(() => {
    if (window.confirm(t("app.confirmLogout"))) {
      resetToLogin();
    }
  }, [resetToLogin, t]);

  // The equipped weapon selects the skill kit shown in the HUD and the F5 tree.
  // The hero's sect owns the skill kit; the worn weapon only decides the rig and
  // whether a cast is allowed (the server enforces the weapon gate).
  const sect = normalizeSect(serverSect || activeCharacter?.sect || DEFAULT_SECT);
  const weaponType = equippedWeaponType(equipment) || "kiem";
  const sectSkills = skillsForSect(sect);

  return (
    <main id="game-shell">
      {/* Mobile Portrait Orientation Prompt (only after entering the game) */}
      {activeCharacter && (
        <div className="mobile-orientation-hint">
          <div className="mobile-orientation-icon">📱</div>
          <div className="mobile-orientation-title">{t("app.rotateDeviceTitle")}</div>
          <div className="mobile-orientation-desc">{t("app.rotateDeviceDesc")}</div>
          <button
            type="button"
            className="mobile-orientation-btn"
            onClick={() => requestLandscapeFullscreen(true)}
          >
            {t("app.rotateDeviceButton")}
          </button>
        </div>
      )}

      {/* Phaser Canvas Engine — engine chunk is loaded on demand */}
      <Suspense
        fallback={
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: "#0f0b08"
            }}
          />
        }
      >
        <GameCanvas />
      </Suspense>

      {/* React MMORPG Wuxia HUD */}
      <div className="hud-overlay" id="hud-overlay">
        <PlayerVitals
          stats={stats}
          onLogout={handleLogout}
        />

        <TargetVitals
          target={targetVitals}
          onClear={handleClearTarget}
        />

        <MinimapPanel
          onOpenHelp={handleOpenHelp}
          onOpenQuestLog={() => {
            setIsQuestLogOpen(true);
            bridge.emit(EVENTS.ACTION_SET_PAUSED, true);
          }}
          quest={questState ? activeQuestView(questState) : null}
          zoomed={isMinimapZoomed}
          collapsed={!isMinimapOpen}
          onClose={() => setIsMinimapOpen(false)}
          onOpen={() => setIsMinimapOpen(true)}
        />

        <ChatPanel
          logs={logs}
          onSendMessage={handleSendMessage}
          collapsed={!isChatOpen}
          onClose={() => setIsChatOpen(false)}
          onOpen={() => setIsChatOpen(true)}
        />

        <HotbarDock
          audioEnabled={audioEnabled}
          items={inventory.quickItems}
          inventoryItems={inventory.inventoryItems}
          quickSlotsMapping={quickSlots}
          onClearQuickSlot={handleClearQuickSlot}
          onMoveQuickSlot={handleMoveQuickSlot}
          onUseItem={handleUseItem}
          onInventory={handleToggleInventory}
          onCharacter={handleToggleCharacter}
          onSkills={handleOpenSkills}
          onOpenHelp={handleOpenHelp}
          onToggleAudio={handleToggleAudio}
          onLogout={handleLogout}
          onTogglePk={handleTogglePk}
          pkEnabled={pkEnabled}
          playerMp={stats.mp}
          skills={sectSkills}
        />

        <MobileControls
          onMove={handleMove}
          onAttack={handleAttack}
          onCastSkill={handleCastSkill}
          onAssignSkill={mobileSkillsPicker.open}
          onUseItem={handleUseItem}
          onAssignItem={mobileItemsPicker.open}
          onInteractNpc={() => bridge.emit(EVENTS.ACTION_INTERACT_NPC)}
          nearbyNpc={nearbyNpc}
          playerMp={stats.mp}
          skills={sectSkills}
          skillSlots={mobileSkillsPicker.bindings}
          items={mobileItemOptions}
          itemSlots={mobileItemsPicker.bindings}
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
          onStart={handleCharacterStart}
          onLogout={handleLogout}
        />
      )}

      {/* Help & Guide Modal */}
      <HelpModal
        isOpen={isHelpOpen}
        onClose={dismissHelp}
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

      {/* NPC dialog + newbie quest journal */}
      <NpcDialogModal
        isOpen={!!npcDialog}
        npc={npcDialog}
        state={questState}
        level={stats.level}
        onAccept={(questId) => bridge.emit(EVENTS.ACTION_QUEST_ACCEPT, { questId })}
        onTalk={(npcId) => bridge.emit(EVENTS.ACTION_QUEST_TALK, { npcId })}
        onTurnIn={(questId) => bridge.emit(EVENTS.ACTION_QUEST_TURN_IN, { questId })}
        onOpenShop={() => bridge.emit(EVENTS.ACTION_OPEN_NPC_SHOP)}
        onClose={() => bridge.emit(EVENTS.ACTION_CLOSE_NPC_DIALOG)}
      />

      <QuestLogModal
        isOpen={isQuestLogOpen}
        state={questState}
        level={stats.level}
        onClose={() => {
          setIsQuestLogOpen(false);
          bridge.emit(EVENTS.ACTION_SET_PAUSED, false);
        }}
      />

      {/* Character Inventory ("Hành trang") */}
      <InventoryModal
        isOpen={isInventoryOpen}
        onClose={handleCloseInventory}
        onUseItem={handleUseItem}
        onEquipItem={handleEquipItem}
        onUnequipSlot={handleUnequipSlot}
        onAssignQuickSlot={handleAssignQuickSlot}
        equipment={equipment}
        coins={stats.coins}
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
      />

      {/* Skills Panel Modal (F5) */}
      <SkillsModal
        isOpen={isSkillsOpen}
        onClose={handleCloseSkills}
        skills={sectSkills}
        weapon={weaponType}
        sect={sect}
        learnedSkills={learnedSkills}
        skillLevels={skillLevels}
        level={stats.level}
        coins={stats.coins}
        exp={stats.exp}
        quickSlotsMapping={quickSlots}
        onAssignSkill={handleAssignSkill}
        onUpgradeSkill={handleUpgradeSkill}
        onLearnSkill={handleLearnSkill}
      />

      {/* Mobile arc skill picker (tap "+" on a mobile skill button) */}
      <MobileSkillPicker
        isOpen={mobileSkillsPicker.isPickerOpen}
        slotIndex={mobileSkillsPicker.pickerIndex ?? 0}
        skills={sectSkills}
        level={stats.level}
        learnedSkills={learnedSkills}
        selectedSkillId={mobileSkillsPicker.selectedId}
        onSelect={mobileSkillsPicker.select}
        onClear={() => mobileSkillsPicker.select(null)}
        onClose={mobileSkillsPicker.close}
      />

      {/* Mobile consumable picker (tap "+" on a mobile HP/MP button) */}
      <MobileItemPicker
        isOpen={mobileItemsPicker.isPickerOpen}
        slotIndex={mobileItemsPicker.pickerIndex ?? 0}
        items={mobileItemOptions}
        selectedItemId={mobileItemsPicker.selectedId}
        onSelect={mobileItemsPicker.select}
        onClear={() => mobileItemsPicker.select(null)}
        onClose={mobileItemsPicker.close}
      />

      {/* GM Command Panel ("Lệnh Bài GM") */}
      <GmModal
        isOpen={isGmOpen}
        onClose={() => setIsGmOpen(false)}
        stats={stats}
      />
    </main>
  );
}
