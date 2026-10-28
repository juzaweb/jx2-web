import * as Phaser from "phaser";
import { MapStage } from "./mapStage.js";
import { WORLD_POSITION_SCALE, WORLD_SCALE, WORLD_TILE } from "./worldConfig.js";
import { Player } from "./player.js";
import { HERO_FOOT_Y } from "./heroRigView.js";
import { EnemyManager, findEnemyAt } from "./enemy.js";
import { CombatSystem, toggleAudio, isAudioEnabled, setAudioEnabled, playTone, SAFE_ZONE_LOG } from "./combat.js";
import { UIBridgeAdapter } from "./uiBridgeAdapter.js";
import { StorageManager } from "./storage.js";
import { bridge, EVENTS } from "./bridge.js";
import { getQuantity, replaceQuantities, getItemById, getConsumableEffect, isSkillBook, isCommandToken, QUICK_ITEMS } from "./items.js";
import { skillById } from "./skills.js";
import { translate } from "../i18n/translator.js";
import { loadQuickSlots, skillIdFromBinding } from "./quickSlots.js";
import { planEquip, equippedIn } from "./equipment.js";
import { NetworkClient } from "./networkClient.js";
import { RemotePlayerManager } from "./remotePlayerManager.js";
import { readSession } from "./session.js";
import { shouldReportPosition } from "./positionSync.js";
import { toIso, fromIso, isoDepth } from "./isoProjection.js";
import { findPlayerAt, PVP_CHASE_DISTANCE } from "./pvpTargeting.js";
import { mayDuel, PVP_ATTACK_RANGE } from "./pvp.js";
import { factionHomeMap, isHostileFaction, normalizeFaction } from "./factions.js";
import { usesTouchControls } from "./orientation.js";
import { AUTO_TARGET_RANGE, pickAutoTarget } from "./autoTarget.js";
import { TargetRing } from "./targetRing.js";
import { DEFAULT_CURSOR, applyCursor, cursorForGroundPoint } from "./hoverCursor.js";
import {
  DEFAULT_MAP_ID,
  getMap,
  isInsideMap,
  isKnownMap,
  mapPvpMode,
  mapWorldConfig
} from "./maps/mapRegistry.js";
import { createPortalState, gateAt, portalAt, stepPortalTrigger } from "./maps/portals.js";
import { SHOP_BUILDINGS } from "./marketBuildings.js";
import { VEGETATION_SPRITES } from "./marketProps.js";
import { HERO_BODY, HERO_BODY_TEXTURES } from "./heroBody.js";
import { NPC_DUOC, isInTalkRange, isPointOnNpc, npcApproachPoint } from "./npc.js";
import { ShopFlow } from "./shopFlow.js";

/** Ground tiles the gameplay camera shows across the screen width. */
const CAMERA_TILES = 15;

/** DOM regions painted over the canvas that must swallow game input. */
const HUD_BLOCK_SELECTOR =
  ".metal-card, .top-left-panel, .bottom-dock, .mobile-controls, button, input, .overlay";

/** Why the server refused a PvP hit, in the player's language. */
const HIT_REJECT_MESSAGES = {
  attacker_peaceful: "Bạn đang ở trạng thái Hoà Bình — hãy bật cờ PK rồi đánh lại.",
  target_peaceful: "Đối thủ chưa bật cờ PK — đòn đánh không có hiệu lực.",
  range: "Ngoài tầm tỷ thí — hãy áp sát đối thủ.",
  same_faction: "Đồng minh cùng phe — không thể giao chiến.",
  iframe: "Đối thủ vừa trúng đòn (bất tử 0,7s) — đòn này bị bỏ.",
  dodged: "Đối thủ đã né đòn (đang chạy ra xa)!",
  target_missing: "Đối thủ không còn trên máy chủ.",
  damage_invalid: "Sát thương không hợp lệ nên máy chủ đã bỏ.",
  safe_zone: SAFE_ZONE_LOG
};

import { normalizeGender } from "./gender.js";
import { normalizeKey } from "./keybinds.js";
import { skillsForWeapon } from "./skills.js";
import { MELEE_REACH } from "./combatRules.js";
import { ensureHeroBodyTexture, ensureWeaponVfx } from "./lazyAssets.js";

export class JiangHuScene extends Phaser.Scene {
  constructor() {
    super("JiangHuScene");
    this.started = false;
    this.isPaused = false;
    /** A modal/shop asked for the pause; only that UI clears it again. */
    this.manualPaused = false;
    /**
     * The socket gate. Starts closed: the world may not run until the server has
     * accepted us, so a tab whose socket never opens (server down) stays frozen
     * instead of silently playing a private copy of the world.
     */
    this.connectionBlocked = true;
    this.unsubscribers = [];
    /** Active map; the save file decides the initial value in create(). */
    this.currentMapId = DEFAULT_MAP_ID;
    this.requestedMapId = null;
    this.pendingSpawn = null;
    this.map = getMap(DEFAULT_MAP_ID);
    this.mapConfig = mapWorldConfig(this.map);
    this.portalState = createPortalState();
    /** Gate the hero is standing in without a portal, so the hint logs once. */
    this.lockedGateId = null;
    /** Renderer + NPCs + colliders of the map currently loaded. */
    this.stage = null;
  }

  /**
   * Phaser calls this before create(). A restart can pass `{ mapId, spawn }`;
   * otherwise the save file decides which map to boot into.
   * @param {{mapId?:string, spawn?:{x:number,y:number}}} [data]
   */
  init(data = {}) {
    this.requestedMapId = isKnownMap(data?.mapId) ? data.mapId : null;
    this.pendingSpawn = data?.spawn || null;
    this.currentMapId = this.requestedMapId || DEFAULT_MAP_ID;
  }

  preload() {
    // Only the active character's walk sheet is needed at boot; the other gender
    // is queued the first time the player switches (see ensureHeroBodyTexture),
    // and a weapon that ships its own sheet (the sword) is queued by the rig
    // once the worn gear is known (see HeroRigView.requestWeaponSheet).
    const gender = normalizeGender(readSession()?.activeCharacter?.gender);
    const bodySheet = HERO_BODY_TEXTURES[gender];
    if (!this.textures.exists(bodySheet.key)) {
      this.load.spritesheet(bodySheet.key, bodySheet.url, {
        frameWidth: HERO_BODY.frameWidth,
        frameHeight: HERO_BODY.frameHeight
      });
    }
    this.load.image("ground-bricks", "/gach-tile.webp");
    // Second paving style, used for the walkway that threads the market square.
    this.load.image("ground-walkway", "/gach-seamless.webp");
    for (const { textureKey, url } of SHOP_BUILDINGS) {
      if (!this.textures.exists(textureKey)) {
        this.load.image(textureKey, url);
      }
    }
    if (!this.textures.exists(NPC_DUOC.textureKey)) {
      this.load.spritesheet(NPC_DUOC.textureKey, NPC_DUOC.url, {
        frameWidth: NPC_DUOC.frameWidth,
        frameHeight: NPC_DUOC.frameHeight
      });
    }
    for (const { key, url } of Object.values(VEGETATION_SPRITES)) {
      this.load.image(key, url);
    }
    // Skill VFX sheets are intentionally not loaded here: they are pulled in on
    // demand once the hero's weapon is known (see ensureWeaponVfx).
  }

  create() {
    // Disable browser right click context menu on game canvas
    this.input.mouse.disableContextMenu();

    // Generate reusable dot texture for physics colliders
    if (!this.textures.exists("entity-dot")) {
      const textureGraphics = this.make.graphics({ x: 0, y: 0, add: false });
      textureGraphics.fillStyle(0xffffff, 1);
      textureGraphics.fillRect(0, 0, 4, 4);
      textureGraphics.generateTexture("entity-dot", 4, 4);
      textureGraphics.destroy();
    }

    // Resolve the map before anything is drawn so bounds, world, NPCs and the
    // hero all agree on which map is live.
    this.savedData = StorageManager.load();
    this.currentMapId = this.resolveInitialMapId(this.savedData);
    this.map = getMap(this.currentMapId);
    this.mapConfig = mapWorldConfig(this.map);
    // Announce the boot map so the HUD can label the region before any travel.
    bridge.emit(EVENTS.MAP_CHANGED, { mapId: this.map.id, name: this.mapDisplayName() });

    // Draw the map and clamp the camera/physics to it. The NPCs come with it.
    this.stage = new MapStage(this);
    this.stage.build(this.map);
    this.pendingNpc = null;
    /** Peer locked for a duel: walk into range, then keep striking (see updatePvpTarget). */
    this.pvpTarget = null;
    /** Monster locked for combat: walk into range, then strike (see updateEnemyTarget). */
    this.enemyTarget = null;
    /** Touch layout has no cursor, so a victim is picked and ringed for the player. */
    this.autoTargetEnabled = usesTouchControls();
    /** The ringed victim (see updateAutoTarget). Passive: it never moves the hero. */
    this.autoTarget = null;
    this.autoTargetRing = new TargetRing(this);

    // Seed the name from the cached session; App re-emits SET_PLAYER_NAME once it
    // has refreshed the profile from the backend.
    let initialName = "Lãng Khách";
    const session = readSession();
    initialName =
      session?.activeCharacter?.name ||
      session?.user?.displayName ||
      session?.user?.username ||
      initialName;
    const initialGender = normalizeGender(session?.activeCharacter?.gender);

    const spawnPoint = this.pendingSpawn || this.map.spawn;
    this.player = new Player(
      this,
      spawnPoint.x,
      spawnPoint.y,
      initialName,
      initialGender
    );
    // The camp decides the boot city and, on the battlefield, who is an enemy.
    this.player.faction = normalizeFaction(session?.activeCharacter?.faction);
    // The equipped weapon decides the skill kit. The authoritative gear arrives
    // over `equipment_sync`, which also queues this weapon's VFX.
    this.enemyManager = new EnemyManager(this);

    // The roster exists now, so the monster collisions can be wired too.
    this.stage.bindColliders();

    // UI Bridge Adapter to communicate with React components
    this.uiBridge = new UIBridgeAdapter();

    // Combat system with state change hook for auto-saving
    this.combat = new CombatSystem(
      this,
      this.player,
      this.enemyManager,
      this.uiBridge,
      () => this.saveGame(false)
    );

    // Restore the local position and settings. Gameplay state (stats, bag, gear,
    // quest progress) is server-owned and arrives over the socket instead.
    if (this.savedData) {
      if (this.savedData.position && typeof this.savedData.position.x === "number") {
        const { x, y } = this.savedData.position;
        if (isInsideMap(this.map, x, y)) this.player.setPosition(x, y);
      }
      if (this.savedData.audioEnabled !== undefined) {
        setAudioEnabled(this.savedData.audioEnabled);
        this.uiBridge.updateSoundButton(this.savedData.audioEnabled);
      }
      // PK is a persistent choice: restore it so the HUD, the join packet and the
      // server all agree instead of silently dropping back to peaceful.
      this.player.setPkFlag(this.savedData.pkFlag === true);
    }

    // Camera follows the isometric visual (the sprite stays in ground space)
    this.cameras.main.startFollow(this.player.visual, true, 0.08, 0.08);
    this.updateCameraZoom();

    // Scale resize handler
    this.scale.on("resize", () => this.updateCameraZoom());

    // Real-time Multiplayer: Remote Player Manager & WebSocket Network Client
    this.remotePlayerManager = new RemotePlayerManager(this, this.uiBridge);
    this.remotePlayerManager.setLocalFaction(this.player.faction);
    this.remotePlayerManager.setPvpMode(this.pvpMode());
    this.networkClient = new NetworkClient();
    this.shopFlow = new ShopFlow({
      player: this.player,
      uiBridge: this.uiBridge,
      networkClient: this.networkClient,
      saveGame: (showFeedback) => this.saveGame(showFeedback)
    });

    this.networkClient.on("init_world", (payload) => {
      // A completed join proves the session recovered; drop any stale terminal
      // issue so the gate never stays up over a healthy world.
      bridge.emit(EVENTS.CONNECTION_ISSUE, null);
      this.handleInitWorld(payload);
    });

    // A portal move confirmed by the server: the roster and the peers change.
    this.networkClient.on("map_changed", (payload) => {
      this.handleMapChanged(payload);
    });

    this.networkClient.on("map_change_rejected", (payload) => {
      this.handleMapChangeRejected(payload);
    });

    this.networkClient.on("player_joined", (payload) => {
      this.remotePlayerManager.handlePlayerJoined(payload);
    });

    this.networkClient.on("player_moved", (payload) => {
      // A `player_moved` naming us is the server correcting our position (snap-back
      // after a rejected jump, respawn, Hồi Thành Phù or a GM teleport).
      if (payload?.id && payload.id === this.combat?.localPlayerId) {
        if (Number.isFinite(payload.x) && Number.isFinite(payload.y)) {
          this.player.setPosition(payload.x, payload.y);
        }
        return;
      }
      this.remotePlayerManager.handlePlayerMoved(payload);
    });

    this.networkClient.on("player_attacked", (payload) => {
      this.remotePlayerManager.handlePlayerAttacked(payload);
    });

    this.networkClient.on("player_pk", (payload) => {
      this.remotePlayerManager.handlePlayerPk(payload);
    });

    this.networkClient.on("player_equipment", (payload) => {
      this.remotePlayerManager.handlePlayerEquipment(payload);
    });

    // Server-authoritative health. The server owns every player's HP and streams
    // the result here, so the client only renders it (never decides it).
    this.networkClient.on("player_hp", (payload) => {
      this.handlePlayerHp(payload);
    });

    // Server-authoritative MP, mirroring the HP model.
    this.networkClient.on("player_mp", (payload) => {
      this.handlePlayerMp(payload);
    });

    // Server-derived combat stats (gear + buffs) and the worn gear itself.
    this.networkClient.on("player_stats", (payload) => {
      this.handlePlayerStats(payload);
    });

    this.networkClient.on("equipment_sync", (payload) => {
      this.handleEquipmentSync(payload);
    });

    // Skills studied from books and their levels. The server is authoritative: a
    // learned id is only usable after it lands here.
    this.networkClient.on("skills_sync", (payload) => {
      const learned = Array.isArray(payload?.skills) ? payload.skills : [];
      const levels = payload?.levels && typeof payload.levels === "object" ? payload.levels : {};
      if (this.combat) {
        this.combat.learnedSkills = new Set(learned);
        this.combat.skillLevels = { ...levels };
      }
      bridge.emit(EVENTS.SKILLS_UPDATED, { skills: learned, levels });
    });

    // Result of a server-side use/equip/unequip action.
    this.networkClient.on("item_result", (payload) => {
      this.handleItemResult(payload);
    });

    this.networkClient.on("skill_rejected", (payload) => {
      this.handleSkillRejected(payload);
    });

    // The server refused the join (missing/expired session or a character that
    // does not belong to the account).
    this.networkClient.on("join_rejected", (payload) => {
      this.handleJoinRejected(payload);
    });

    this.networkClient.on("player_defeated", (payload) => {
      this.handlePlayerDefeated(payload);
    });

    // The server refused a PvP hit: say why, instead of leaving the client to draw
    // damage that never happened (reads as "hit landed but no HP loss").
    this.networkClient.on("player_hit_rejected", (payload) => {
      this.logHitRejection(payload);
    });

    this.networkClient.on("player_left", (payload) => {
      this.remotePlayerManager.handlePlayerLeft(payload);
    });

    this.networkClient.on("player_chat", (payload) => {
      if (this.uiBridge && typeof this.uiBridge.addLog === "function") {
        this.uiBridge.addLog(`${payload.sender}: ${payload.text}`, payload.channel || "near");
      }
    });

    // Server-authoritative enemy state: damage, movement and respawn are shared
    this.networkClient.on("enemy_hit", (payload) => {
      this.enemyManager.applyEnemyState(payload);
      if (payload?.damage > 0) {
        const enemy = this.enemyManager.getById?.(payload.id);
        if (enemy) {
          this.combat.showFloatText(enemy.x, enemy.y - 30, `-${payload.damage}`, "#ffb49a");
        }
      }
    });

    this.networkClient.on("enemy_moved", (payload) => {
      this.enemyManager.applyServerSnapshot(payload?.enemies);
    });

    this.networkClient.on("enemy_respawned", (payload) => {
      this.enemyManager.applyEnemyState(payload);
    });

    // Kill rewards (EXP, bạc, drops) are rolled by the server on the killing blow
    this.networkClient.on("enemy_reward", (payload) => {
      this.combat.applyServerReward(payload);
    });

    // The server owns progression (level, EXP, coins, kills); the client mirrors it.
    this.networkClient.on("player_progress", (payload) => {
      this.combat.applyServerProgress(payload);
    });

    // A server-validated shop purchase. The server has already debited silver
    // and written the item to this character's bag; mirror the item locally.
    this.networkClient.on("shop_result", (payload) => {
      this.shopFlow.handleResult(payload);
    });

    // Authoritative bag sync from server (e.g. GM item additions)
    this.networkClient.on("inventory_sync", (payload) => {
      if (payload?.inventory) {
        replaceQuantities(payload.inventory);
        this.onInventoryChanged();
      }
    });

    // Authoritative GM state (e.g. God Mode toggle)
    this.networkClient.on("gm_state", (payload) => {
      if (payload?.isGodMode !== undefined && this.player) {
        this.player.isGodMode = Boolean(payload.isGodMode);
      }
    });

    this.networkClient.on("connected", () => {
      // Open the gate first: the world may move as soon as the server is there.
      this.setConnectionBlocked(false);
      this.sendNetworkJoin();
      if (this.uiBridge && typeof this.uiBridge.addLog === "function") {
        this.uiBridge.addLog("Đã kết nối máy chủ Giang Hồ — Trực tuyến.", "system");
      }
    });

    this.networkClient.on("disconnected", (payload) => {
      this.setConnectionBlocked(true);
      if (this.uiBridge && typeof this.uiBridge.addLog === "function") {
        this.uiBridge.addLog(
          payload?.superseded
            ? "Tài khoản vừa đăng nhập ở một thiết bị khác. Nhân vật tạm rời giang hồ."
            : "Mất kết nối máy chủ. Đang tự động kết nối lại...",
          "system"
        );
      }
    });

    // The same character joined from another device. Reconnecting would drag the
    // character back and forth between the two clients, so surface a terminal
    // issue and let the player log in again instead.
    this.networkClient.on("superseded", () => {
      this.setConnectionBlocked(true);
      bridge.emit(EVENTS.CONNECTION_ISSUE, { reason: "superseded" });
    });

    // Publish the closed gate before the handshake, so React can cover the HUD
    // from the first frame (the scene freezes itself through startGame below).
    this.setConnectionBlocked(true);
    this.networkClient.connect();
    this.bindSceneTeardown();

    this.isPointerMoving = false;

    // Mouse input handlers (Left click: Move/Attack, Right click: Cast Selected Skill)
    this.input.on("pointerdown", (pointer) => {
      if (!this.started || this.isPaused) return;

      // Do not handle when clicking on interactive HUD elements or React overlays
      const target = pointer.event.target;
      if (target?.closest?.(HUD_BLOCK_SELECTOR)) {
        return;
      }

      const ground = fromIso(pointer.worldX, pointer.worldY);
      const worldX = ground.x;
      const worldY = ground.y;

      // Right click has no hotbar action anymore; ignore it so it cannot move the
      // hero or fire a skill bound to nothing.
      if (pointer.rightButtonDown() || pointer.button === 2) return;

      // Any left click re-targets the hero, so pending approaches are cancelled
      // unless this click selects one again below.
      this.pendingNpc = null;
      this.pvpTarget = null;
      this.enemyTarget = null;

      // Check if clicking directly on an NPC (walk towards NPC)
      const clickedNpc = (this.stage?.npcs || []).find((npc) => isPointOnNpc(npc, worldX, worldY));
      if (clickedNpc) {
        const approach = npcApproachPoint(clickedNpc);
        this.pendingNpc = clickedNpc;
        this.player.moveTo(approach.x, approach.y);
        this.showClickIndicator(clickedNpc.gx, clickedNpc.gy, 0x9be58b);
        return;
      }

      // Check if clicking directly on a living monster (target and attack). A
      // city square is a safe zone: there the click only walks the hero, and the
      // player is told why the monster is left alone.
      const mayFight = this.canFight();
      const clickedEnemy = findEnemyAt(this.enemyManager?.getAlive() || [], worldX, worldY);
      if (clickedEnemy) {
        if (!mayFight) {
          this.uiBridge.addLog(SAFE_ZONE_LOG, "system");
          this.isPointerMoving = true;
          this.player.moveTo(clickedEnemy.x, clickedEnemy.y);
          this.showClickIndicator(clickedEnemy.x, clickedEnemy.y, 0xffdd59);
          return;
        }
        this.enemyTarget = clickedEnemy;
        this.isPointerMoving = false;
        this.showClickIndicator(clickedEnemy.x, clickedEnemy.y, 0xff5252);
        this.updateEnemyTarget();
        return;
      }

      // Clicking a peer that is a legal duel target locks onto it: the hero walks
      // into range and keeps striking until one of them leaves or the policy
      // stops allowing it. On a faction battlefield that is any other camp; on a
      // normal map it is a PK-flagged player.
      const clickedPlayer = findPlayerAt(this.remotePlayerManager?.getAll?.() || [], worldX, worldY);
      if (clickedPlayer && this.isDuelCandidate(clickedPlayer)) {
        if (!mayFight) {
          this.uiBridge.addLog(SAFE_ZONE_LOG, "system");
          this.isPointerMoving = true;
          this.player.moveTo(clickedPlayer.x, clickedPlayer.y);
          this.showClickIndicator(clickedPlayer.x, clickedPlayer.y, 0xffdd59);
          return;
        }
        if (mayDuel(this.player, this.pvpMode())) {
          this.pvpTarget = clickedPlayer;
        } else {
          this.uiBridge.addLog("Mục tiêu đã bật cờ PK — hãy bật cờ PK của bạn để tỷ thí.", "system");
        }
        this.isPointerMoving = false;
        this.player.moveTo(clickedPlayer.x, clickedPlayer.y);
        this.showClickIndicator(clickedPlayer.x, clickedPlayer.y, 0xff5555);
        return;
      }

      // Left click on terrain: move to destination
      this.isPointerMoving = true;
      this.combat.cancelPendingCast();
      this.player.moveTo(worldX, worldY);
      this.showClickIndicator(worldX, worldY, 0xffdd59);
    });

    // Cursor feedback + hold-to-move tracking. The cursor is refreshed on every
    // move (even when idle) so hovering a monster advertises the attack.
    this.input.on("pointermove", (pointer) => {
      this.updateHoverCursor(pointer);

      if (
        !this.started ||
        this.isPaused ||
        !this.isPointerMoving ||
        !pointer.isDown ||
        pointer.rightButtonDown() ||
        pointer.button === 2
      ) {
        return;
      }

      const target = pointer.event.target;
      if (target?.closest?.(HUD_BLOCK_SELECTOR)) {
        return;
      }

      const ground = fromIso(pointer.worldX, pointer.worldY);
      this.combat.cancelPendingCast();
      this.pendingNpc = null;
      this.pvpTarget = null;
      this.enemyTarget = null;
      this.player.moveTo(ground.x, ground.y);
    });

    this.input.on("pointerup", (pointer) => {
      this.isPointerMoving = false;
      // The release ends the drag, so the saber comes back under the pointer
      // without waiting for the next mouse move.
      this.updateHoverCursor(pointer);
    });

    // Leaving the viewport drops the saber: the pointer is no longer aiming at
    // anything inside the world.
    this.input.on("gameout", () => applyCursor(this.game?.canvas, DEFAULT_CURSOR));

    // Allow standard typing in HTML form inputs (e.g. login form, chat)
    this.input.keyboard.preventDefault = false;
    const isTyping = () => {
      if (typeof document === "undefined") return false;
      const active = document.activeElement;
      if (!active) return false;
      const tag = active.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        !!active.isContentEditable ||
        active.getAttribute?.("contenteditable") === "true"
      );
    };
    this.isTyping = isTyping;

    // Hotbar quick slots hold either a consumable item or a weapon skill, so a
    // number key both casts bound skills and drinks bound potions.
    this.quickSlots = loadQuickSlots(readSession()?.activeCharacter?.id);
    this.bindSkillKeys();

    // Prevent default context menu on right click
    this.contextMenuHandler = (event) => {
      if (this.started) event.preventDefault();
    };
    window.addEventListener("contextmenu", this.contextMenuHandler);
    this.events.once("shutdown", () => {
      window.removeEventListener("contextmenu", this.contextMenuHandler);
    });

    // Number hotkeys 1-9 use the quick slot: cast its skill or drink its item.
    const numberKeyNames = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE"];
    numberKeyNames.forEach((keyName, idx) => {
      const slotNum = idx + 1;
      this.input.keyboard.on(`keydown-${keyName}`, () => {
        if (!isTyping() && this.started && !this.isPaused) this.useItem(slotNum);
      });
    });

    // Listen to React UI Actions via Game Bridge
    this.unsubscribers.push(
      bridge.on(EVENTS.ACTION_START, () => this.startGame()),
      bridge.on(EVENTS.ACTION_ATTACK, () => {
        if (!this.started || this.isPaused) return;
        // Touch: the ringed auto-target is the player's intent, so the tap walks
        // the hero onto it and keeps striking instead of swinging at empty air.
        if (this.autoTargetEnabled && this.focusAutoTarget()) return;
        // A locked duellist takes priority: press attack to close the gap, not
        // to swing at air when the peer is still across the square.
        if (this.pvpTarget) {
          this.updatePvpTarget();
          return;
        }
        this.combat.performAttack();
      }),
      bridge.on(EVENTS.ACTION_CAST_SKILL, ({ skillId } = {}) => {
        if (!this.started || this.isPaused || !skillId) return;
        // Same aim the number keys use: the projectile follows the pointer
        // (desktop) or the ringed auto-target (touch), never the last footstep.
        this.combat.castSkillById(skillId, this.castAimPoint(skillId));
      }),
      bridge.on(EVENTS.ACTION_UPGRADE_SKILL, ({ skillId } = {}) => {
        if (!skillId || !this.networkClient?.isConnected) return;
        this.networkClient.sendSkillUpgrade({ skillId });
      }),
      bridge.on(EVENTS.SET_QUICK_SLOTS, (quickSlots = {}) => {
        if (this.started && quickSlots) {
          this.quickSlots = { ...this.quickSlots, ...quickSlots };
        }
      }),
      bridge.on(EVENTS.SET_PLAYER_WEAPON, (weaponType) => {
        this.player?.setWeaponType(weaponType);
        if (weaponType) ensureWeaponVfx(this, skillsForWeapon(weaponType));
      }),
      bridge.on(EVENTS.ACTION_USE_POTION, (slot) => {
        if (this.started && !this.isPaused) this.useItem(slot);
      }),
      bridge.on(EVENTS.ACTION_BUY_ITEM, ({ itemId, qty } = {}) => {
        if (this.started) this.shopFlow.buy(itemId, qty);
      }),
      bridge.on(EVENTS.ACTION_EQUIP_ITEM, (itemId) => this.equipItem(itemId)),
      bridge.on(EVENTS.ACTION_UNEQUIP_SLOT, (slot) => this.unequipSlot(slot)),
      bridge.on(EVENTS.ACTION_MOVE, (direction) => {
        if (!this.isPaused) {
          this.combat.cancelPendingCast();
          this.pendingNpc = null;
          this.pvpTarget = null;
          this.enemyTarget = null;
          this.player.setTouchDirection(direction);
        }
      }),
      bridge.on(EVENTS.ACTION_SAVE, () => this.saveGame(true)),
      bridge.on(EVENTS.ACTION_RESET, () => this.resetGame()),
      bridge.on(EVENTS.ACTION_RETRY_CONNECTION, () => {
        this.networkClient?.retryNow?.();
      }),
      bridge.on(EVENTS.ACTION_LEAVE_WORLD, () => {
        this.networkClient?.suspend?.();
        this.setConnectionBlocked(true);
      }),
      bridge.on(EVENTS.ACTION_TOGGLE_AUDIO, () => {
        const isEnabled = toggleAudio();
        this.uiBridge.updateSoundButton(isEnabled);
        this.saveGame(false);
      }),
      bridge.on(EVENTS.ACTION_SET_PAUSED, (paused) => this.setPaused(paused)),
      bridge.on(EVENTS.ACTION_TOGGLE_PK, () => this.togglePk()),
      bridge.on(EVENTS.SET_PLAYER_NAME, (name) => {
        if (this.player) {
          this.player.setName(name);
          this.sendNetworkJoin();
        }
      }),
      bridge.on(EVENTS.SET_PLAYER_GENDER, (gender) => {
        const next = normalizeGender(gender);
        if (ensureHeroBodyTexture(this, next)) {
          this.player?.setGender(next);
          return;
        }
        // Sheet still downloading: keep the current look, then swap it in.
        this.load.once("complete", () => this.player?.setGender(next));
      }),
      bridge.on(EVENTS.ACTION_CHAT, (payload) => {
        if (this.networkClient?.isConnected) {
          this.networkClient.sendChat(payload);
        }
      }),
      bridge.on(EVENTS.ACTION_GM, (payload) => {
        this.handleGmAction(payload);
      })
    );

    // Periodic auto-save timer (every 15s while active)
    this.autoSaveTimer = this.time.addEvent({
      delay: 15000,
      loop: true,
      callback: () => {
        if (this.started && !this.isPaused) {
          this.saveGame(false);
        }
      }
    });

    // Save on window close / page leave
    this.unloadHandler = () => {
      if (this.started) {
        this.saveGame(false);
      }
    };
    window.addEventListener("beforeunload", this.unloadHandler);

    // Initial Stats emit to React
    this.uiBridge.updateHud(this.player.stats);
    this.drawMapPanels();

    // Auto-start game immediately without start modal
    this.startGame();
  }

  /**
   * The map to boot into: an explicit `init({ mapId })` wins, then the saved map,
   * then the default city.
   * @param {object|null} saved
   * @returns {string}
   */
  resolveInitialMapId(saved) {
    if (this.requestedMapId) return this.requestedMapId;
    if (isKnownMap(saved?.mapId)) return saved.mapId;
    // A first boot lands in the hero's own capital.
    const home = factionHomeMap(readSession()?.activeCharacter?.faction);
    return isKnownMap(home) ? home : DEFAULT_MAP_ID;
  }

  /**
   * Localized display name of a map, falling back to its authored Vietnamese name.
   * @param {string} [mapId]
   * @param {string} [fallback]
   * @returns {string}
   */
  mapDisplayName(mapId = this.currentMapId, fallback = this.map?.name) {
    return translate(`maps.${mapId}`, undefined, fallback);
  }

  /**
   * PvP policy of the map under the hero's feet.
   * @returns {"none"|"flag"|"faction"}
   */
  pvpMode() {
    return mapPvpMode(this.map);
  }

  /**
   * Whether a peer may be dueled under the current map's policy: a different camp
   * on a faction battlefield, a flagged player everywhere else.
   * @param {{pkFlag?:boolean, faction?:string}|null} peer
   * @returns {boolean}
   */
  isDuelCandidate(peer) {
    if (!peer) return false;
    if (this.pvpMode() === "none") return false;
    if (this.pvpMode() === "faction") {
      return isHostileFaction(this.player?.faction, peer.faction);
    }
    return peer.pkFlag === true;
  }

  /** Push the active faction and map PvP policy into the peer renderer. */
  syncFactionContext() {
    this.remotePlayerManager?.setLocalFaction?.(this.player?.faction);
    this.remotePlayerManager?.setPvpMode?.(this.pvpMode());
  }

  /** Redraw the radar and the full city map for the active map. */
  drawMapPanels() {
    if (!this.player) return;
    const enemies = this.enemyManager?.getAll() || [];
    const remote = this.remotePlayerManager?.getAll() || [];
    this.uiBridge.drawMinimap(this.player, enemies, this.mapConfig, remote);
    this.uiBridge.drawCityMap(this.player, enemies, this.mapConfig, remote);
  }

  /** One frame of portal detection. */
  updatePortals(time) {
    if (!this.player) return;

    const portal = this.map?.portals?.length
      ? portalAt(this.map, this.player.x, this.player.y)
      : null;

    // A gate arch with no portal behind it is a shut gate: say so once per
    // entry instead of leaving the hero walking into a wall of nothing.
    if (!portal) {
      const gate = gateAt(this.map, this.player.x, this.player.y);
      if (gate && gate.id !== this.lockedGateId) {
        this.lockedGateId = gate.id;
        this.uiBridge.addLog("Cổng này chưa mở.", "guide");
      } else if (!gate) {
        this.lockedGateId = null;
      }
    } else {
      this.lockedGateId = null;
    }

    const step = stepPortalTrigger(this.portalState, portal, time);
    this.portalState = step.state;
    if (!step.portal) return;

    this.loadMap(step.portal.targetMapId, step.portal.targetSpawn, {
      notifyServer: true,
      portalId: step.portal.id
    });
  }

  /**
   * Move the hero to another map: tear the world down, rebuild it, and (online)
   * tell the server so its roster and AOI follow along.
   * @param {string} mapId
   * @param {{x:number,y:number}} [spawn]
   * @param {{notifyServer?:boolean, portalId?:string|null}} [options]
   */
  loadMap(mapId, spawn, { notifyServer = false, portalId = null } = {}) {
    if (!this.player) return;

    const targetId = isKnownMap(mapId) ? mapId : DEFAULT_MAP_ID;
    const target = getMap(targetId);
    const arrival = spawn || target.spawn;

    // Already standing there (e.g. the server refused a portal and we are back on
    // the map we had locally): only correct the position, never rebuild.
    if (targetId === this.currentMapId) {
      this.player.setSpawn(arrival);
      this.player.setPosition(arrival.x, arrival.y);
      return;
    }

    this.combat?.cancelPendingCast?.();
    this.player.stopMovement();
    this.pendingNpc = null;
    this.pvpTarget = null;
    this.enemyTarget = null;
    this.isPointerMoving = false;

    this.stage?.destroy();
    this.enemyManager?.clear();
    this.remotePlayerManager?.destroy?.();

    this.currentMapId = targetId;
    this.map = target;
    this.mapConfig = mapWorldConfig(target);
    this.syncFactionContext();

    this.stage = new MapStage(this);
    this.stage.build(target);

    this.player.setSpawn(arrival);
    this.player.setPosition(arrival.x, arrival.y);
    // Re-centre at once so the new map does not scroll in from the old corner.
    this.cameras.main.centerOn(arrival.x, arrival.y);

    if (!this.networkClient?.isConnected) {
      this.enemyManager.create([]);
    }
    // Wire the monsters to the new map's obstacles (the group may be new).
    this.stage.bindColliders();

    this.portalState = createPortalState();
    this.lockedGateId = null;
    this.drawMapPanels();
    bridge.emit(EVENTS.MAP_CHANGED, { mapId: targetId, name: this.mapDisplayName(targetId, target.name) });
    this.uiBridge.addLog(`Đã đến ${this.mapDisplayName(targetId, target.name)}.`, "system");

    if (notifyServer && this.networkClient?.isConnected) {
      this.networkClient.sendMapChange({ portalId });
    }

    // One save, after the move: it records the new map and position. (Saving
    // before the teardown would be overwritten by this one.)
    this.saveGame(false);
  }

  /**
   * Adopt the server's view of the current map: its peer list and its roster.
   * Shared by the reconnect (`init_world`) and travel (`map_changed`) paths.
   * @param {object} payload
   */
  applyServerWorld(payload = {}) {
    this.enemyManager.clear();
    this.remotePlayerManager.destroy();
    this.syncFactionContext();

    if (payload.yourId) {
      this.remotePlayerManager.handleInitWorld(payload);
    } else {
      (payload.players || []).forEach((player) => this.remotePlayerManager.addPlayer(player));
    }

    this.enemyManager.applyServerSnapshot(payload.enemies);
    this.stage?.bindColliders();
    this.drawMapPanels();
  }

  /**
   * Server world initialisation (and reconnect): the server is authoritative
   * about the map, the roster and the peers standing on it.
   * @param {object} payload
   */
  handleInitWorld(payload = {}) {
    const serverMapId = isKnownMap(payload.mapId) ? payload.mapId : this.currentMapId;

    if (serverMapId !== this.currentMapId) {
      this.loadMap(serverMapId, payload.spawn, { notifyServer: false });
    } else if (payload.spawn) {
      this.player.setSpawn(payload.spawn);
      // The server's point is authoritative: a relog resumes the stored spot,
      // which can differ from the locally saved one. Without this the client
      // would keep reporting the stale point, and the server would refuse it as
      // a jump and snap the hero back on the next tick.
      this.player.setPosition(payload.spawn.x, payload.spawn.y);
    }

    this.applyServerWorld(payload);

    // The server names us by character id, so adopt it as the local identity.
    // Kill attribution and PvP rejection messages carry this id, not the
    // per-tab id invented before the join.
    if (payload.yourId) {
      this.remotePlayerManager.setLocalPlayerId(payload.yourId);
      this.combat.setLocalPlayerId(payload.yourId);
    }

    // The server rebuilt our player from the join packet — a snapshot taken when
    // the socket opened. Re-assert the flag the HUD shows, otherwise a reconnect
    // silently drops us back to peaceful server-side and every PvP hit is refused
    // while the client still logs it.
    this.networkClient?.sendPk?.({ pkFlag: this.player?.pkFlag === true });

    // Re-announce the flag to the HUD too: the scene is created before React
    // subscribes, so the boot-time emit alone can be missed.
    bridge.emit(EVENTS.PK_CHANGED, this.player?.pkFlag === true);
  }

  /**
   * The server confirmed a portal move: swap map (if it raced ahead of us) and
   * adopt the authoritative roster and peer list.
   * @param {object} payload
   */
  handleMapChanged(payload = {}) {
    const targetId = isKnownMap(payload.mapId) ? payload.mapId : this.currentMapId;
    const spawn = payload.spawn || getMap(targetId).spawn;

    if (targetId !== this.currentMapId) {
      this.loadMap(targetId, spawn, { notifyServer: false });
    } else {
      this.player.setSpawn(spawn);
      this.player.setPosition(spawn.x, spawn.y);
    }

    this.applyServerWorld(payload);
  }

  /**
   * The server refused the portal move (unknown portal, wrong map). Snap back to
   * the authoritative position.
   * @param {object} payload
   */
  handleMapChangeRejected(payload = {}) {
    const mapId = isKnownMap(payload.mapId) ? payload.mapId : DEFAULT_MAP_ID;
    const spawn = payload.spawn || getMap(mapId).spawn;
    this.uiBridge.addLog("Không thể di chuyển qua cổng này.", "guide");
    bridge.emit(EVENTS.MAP_CHANGE_REJECTED, payload);
    this.loadMap(mapId, spawn, { notifyServer: false });
  }

  /**
   * Use a hotbar quick slot or a concrete item id.
   * The numbered bar passes a slot number; the bag passes the item it shows, so
   * using an item never depends on where (or whether) it is bound to a slot.
   * A slot bound to a weapon skill casts it instead.
   * @param {number|string} slotOrItemId
   */
  useItem(slotOrItemId) {
    if (!this.player || !this.started) return;

    const quickSlots = this.quickSlots || loadQuickSlots(readSession()?.activeCharacter?.id);
    const binding =
      typeof slotOrItemId === "number" ? quickSlots?.[slotOrItemId] : slotOrItemId;
    if (!binding) return;

    const boundSkillId = skillIdFromBinding(binding);
    if (boundSkillId) {
      // Same aim as the mobile arc: pointer on desktop, auto-target on touch.
      this.combat.castSkillById(boundSkillId, this.castAimPoint(boundSkillId));
      return;
    }

    const itemId = binding;
    const item = getItemById(itemId);
    if (!item) return;

    if (getQuantity(itemId) <= 0) {
      this.uiBridge.addLog(`Hành trang đã hết ${item.name || itemId}.`, "guide");
      return;
    }

    if (item.slot) {
      this.equipItem(itemId);
      return;
    }

    // A skill book is studied on the server: it validates the level and
    // prerequisites, consumes one copy and records the skill.
    if (isSkillBook(itemId)) {
      if (!this.networkClient?.isConnected) {
        this.uiBridge.addLog("Cần kết nối máy chủ để học chiêu thức.", "guide");
        return;
      }
      this.networkClient.useItem(itemId);
      return;
    }

    if (isCommandToken(itemId)) {
      bridge.emit(EVENTS.GM_MODAL_TOGGLE);
      this.uiBridge.addLog(`Đã mở Giao diện ${item.name}.`, "system");
      playTone(660, 0.15, "triangle", 0.04);
      return;
    }

    if (!this.applyConsumableEffect(itemId)) return;

    // The server consumes the item and persists the bag; the resulting
    // inventory_sync / player_hp / player_mp packets update this client.
    this.uiBridge.updateHud(this.player.stats);
  }

  /**
   * Run the effect for a hotbar consumable slot or item id.
   * @param {number|string} slotOrItemId
   * @returns {boolean} whether the item was actually consumed by the player
   */
  applyItemEffect(slotOrItemId) {
    let itemId = slotOrItemId;
    if (typeof slotOrItemId === "number") {
      const quickSlots = this.quickSlots || loadQuickSlots(readSession()?.activeCharacter?.id);
      itemId = quickSlots?.[slotOrItemId];
    }
    return this.applyConsumableEffect(itemId);
  }

  applyConsumableEffect(itemId) {
    if (!itemId) return false;

    const effect = getConsumableEffect(itemId);
    if (!effect) return false;

    // Effects and bag decrements are server-owned. A client that is not connected
    // cannot use an item because there is nothing authoritative to apply it to.
    if (!this.networkClient?.isConnected) {
      this.uiBridge.addLog("Cần kết nối máy chủ để sử dụng vật phẩm.", "guide");
      return false;
    }

    this.networkClient.useItem(itemId);
    return true;
  }

  /**
   * Handle GM action invoked from the UI or client
   * @param {Object} payload
   */
  handleGmAction(payload = {}) {
    if (!payload?.action) return;

    // Relay action to the authoritative server
    if (this.networkClient?.isConnected) {
      this.networkClient.sendGmAction(payload);
    }

    // Local immediate feedback / actions
    switch (payload.action) {
      case "heal_full":
        // The server restores HP/MP and broadcasts the new pools.
        this.uiBridge.addLog("Máy chủ đang hồi phục toàn bộ Sinh lực và Nội lực...", "system");
        break;

      case "add_items":
        if (payload.items) {
          const itemNames = Object.keys(payload.items)
            .map((id) => getItemById(id)?.name)
            .filter(Boolean);
          const logText =
            payload.log ||
            (itemNames.length > 0
              ? `Đã nhận ${itemNames.join(", ")} vào túi đồ.`
              : "Đã nhận vật phẩm vào túi đồ.");
          this.uiBridge.addLog(logText, "system");
        }
        break;

      case "equip_set":
        this.uiBridge.addLog(payload.log || "Máy chủ đang trang bị y phục...", "system");
        break;

      case "toggle_god_mode":
        // The server owns god mode and confirms it with gm_state.
        this.uiBridge.addLog("Đã gửi yêu cầu đổi chế độ Bất Tử.", "system");
        break;

      case "toggle_speed":
        if (this.player) {
          this.player.gmSpeedBoost = payload.enabled ?? !this.player.gmSpeedBoost;
          const text = this.player.gmSpeedBoost ? "Tăng tốc di chuyển (x2)" : "Tốc độ thường";
          this.uiBridge.addLog(text, "system");
          this.combat.showFloatText(this.player.x, this.player.y - 68, text, "#74c0fc");
          playTone(660, 0.15, "triangle", 0.03);
        }
        break;

      case "teleport":
        // The server relocates the hero and replies with map_changed.
        this.uiBridge.addLog("Máy chủ đang dịch chuyển nhân vật...", "system");
        break;

      default:
        break;
    }
  }

  /**
   * React to a server bag change: refresh the HUD mirror. Persistence and the
   * bag itself are server-owned, so nothing is written locally.
   */
  onInventoryChanged() {
    this.uiBridge.updateInventory();
  }

  /**
   * Push the worn items to the React HUD. The item ids mirror the server's
   * `equipment_sync`; combat stats arrive separately as `player_stats`.
   */
  emitEquipment() {
    bridge.emit(EVENTS.EQUIPMENT_UPDATED, {
      equipment: { ...this.player.equipment }
    });
  }

  /**
   * Ask the server to wear an inventory item in its slot. The bag decrement,
   * the previous item's return and the new stat block all come back from the
   * server (`inventory_sync`, `equipment_sync`, `player_stats`).
   * @param {string} itemId
   */
  equipItem(itemId) {
    if (!this.player || !this.started) return;

    const { ok, error } = planEquip(this.player.equipment, itemId);
    if (!ok) {
      this.uiBridge.addLog(error || "Không thể trang bị vật phẩm này.", "guide");
      return;
    }
    if (getQuantity(itemId) <= 0) {
      this.uiBridge.addLog("Hành trang không còn vật phẩm này.", "guide");
      return;
    }
    if (!this.networkClient?.isConnected) {
      this.uiBridge.addLog("Cần kết nối máy chủ để trang bị vật phẩm.", "guide");
      return;
    }

    this.networkClient.equipItem(itemId);
    this.uiBridge.addLog(`Đang trang bị ${getItemById(itemId)?.name || itemId}...`, "system");
  }

  /**
   * Ask the server to take off whatever is worn in `slot` and return it to the bag.
   * @param {string} slot
   */
  unequipSlot(slot) {
    if (!this.player || !this.started) return;

    const itemId = equippedIn(this.player.equipment, slot);
    if (!itemId) return;
    if (!this.networkClient?.isConnected) {
      this.uiBridge.addLog("Cần kết nối máy chủ để tháo trang bị.", "guide");
      return;
    }

    this.networkClient.unequipSlot(slot);
    this.uiBridge.addLog(`Đang tháo ${getItemById(itemId)?.name || itemId}...`, "system");
  }

  /**
   * Pause or resume on behalf of a UI panel (help, shop, city map). This is only
   * one of the two reasons the world can be frozen, so it never resumes the
   * world on its own — see applyPauseState().
   * @param {boolean} paused
   */
  setPaused(paused) {
    this.manualPaused = !!paused;
    this.applyPauseState();
  }

  /**
   * Open or close the connection gate. Closing freezes the world, so a dropped
   * socket can no longer be played on client-side state the server will
   * overwrite as soon as the reconnect lands.
   * @param {boolean} blocked
   */
  setConnectionBlocked(blocked) {
    this.connectionBlocked = !!blocked;
    bridge.emit(EVENTS.NETWORK_STATE, { connected: !this.connectionBlocked });
    this.applyPauseState();
  }

  /**
   * The world runs only when neither a modal nor the socket gate asks for a
   * pause. The two flags are independent: closing a modal must not resume a
   * disconnected client, and reconnecting must not resume a paused one.
   */
  applyPauseState() {
    const next = this.manualPaused || this.connectionBlocked;
    const changed = this.isPaused !== next;
    this.isPaused = next;
    if (next) {
      this.physics.pause();
      if (this.player?.sprite?.body) {
        this.player.sprite.setVelocity(0, 0);
      }
      // A frozen world cannot be attacked, so a saber left under the pointer
      // would promise an action the click no longer performs.
      applyCursor(this.game?.canvas, DEFAULT_CURSOR);
    } else if (this.started) {
      this.physics.resume();
    }
    if (changed) {
      bridge.emit(EVENTS.GAME_PAUSED, next);
    }
  }

  saveGame(showFeedback = true) {
    if (!this.player) return;

    const success = StorageManager.save({
      // The map id travels with the position, so a reload restores the hero on
      // the map they were standing on instead of the default city. Every other
      // gameplay value (stats, bag, gear, quests) is server-owned now.
      mapId: this.currentMapId,
      position: {
        x: Math.round(this.player.x),
        y: Math.round(this.player.y)
      },
      audioEnabled: isAudioEnabled(),
      pkFlag: this.player.pkFlag === true
    });

    if (success && showFeedback) {
      this.uiBridge.addLog("Đã lưu tiến trình giang hồ thành công.", "system");
      this.combat.showFloatText(
        this.player.x,
        this.player.y - 65,
        "ĐÃ LƯU TIẾN TRÌNH!",
        "#a5e2b8"
      );
    }
  }

  resetGame() {
    StorageManager.clear();
    StorageManager.clearInventory();
    StorageManager.clearEquipment();
    window.location.reload();
  }

  updateCameraZoom() {
    // The gameplay camera is defined in ground tiles: it always shows
    // CAMERA_TILES tiles across the screen width, whatever the resolution.
    const w = this.scale.width || 800;
    const targetZoom = w / (CAMERA_TILES * WORLD_TILE);
    const zoom = Phaser.Math.Clamp(targetZoom, 0.1, 3.0);
    this.cameras.main.setZoom(zoom);
  }

  showClickIndicator(x, y, color = 0xffdd59) {
    const base = toIso(x, y);
    const ring = this.add.circle(base.x, base.y, 5, color, 0.25);
    ring.setStrokeStyle(2, color, 0.95);
    ring.setDepth(isoDepth(x, y));

    this.tweens.add({
      targets: ring,
      radius: 17,
      alpha: 0,
      duration: 300,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy()
    });
  }

  /**
   * Toggle the local player's PK flag: update the visual, tell the HUD and inform
   * the server so peers can gate their attacks against us.
   * @returns {boolean} the new flag state
   */
  togglePk() {
    if (!this.player) return false;

    const next = !this.player.pkFlag;
    this.player.setPkFlag(next);
    bridge.emit(EVENTS.PK_CHANGED, next);
    // Keep the join snapshot in step: the socket replays it on every reconnect,
    // and a stale `false` would undo the flag server-side.
    if (this.networkClient?.savedPlayerData) {
      this.networkClient.savedPlayerData.pkFlag = next;
    }
    this.networkClient?.sendPk?.({ pkFlag: next });
    // Persist the choice so a reload cannot revert it behind the player's back.
    this.saveGame(false);

    const safeZone = !this.canFight();
    if (!next) {
      this.uiBridge.addLog("Đã tắt cờ PK — trở về trạng thái hòa bình.", "system");
    } else if (safeZone) {
      this.uiBridge.addLog(
        "Đã bật cờ PK — nhưng đây là khu vực thành, chưa thể giao chiến. Hãy ra khỏi thành.",
        "system"
      );
    } else {
      this.uiBridge.addLog("Đã bật cờ PK — từ nay có thể tỷ thí cùng cao thủ khác.", "system");
    }
    return next;
  }

  /**
   * Whether fighting is allowed on the map the hero stands on. The combat system
   * owns the rule (a city is a safe zone); a scene without one — early boot or a
   * partial test double — keeps fighting.
   * @returns {boolean}
   */
  canFight() {
    return this.combat?.canFight?.() ?? true;
  }

  /**
   * Apply the server's authoritative HP for a player. For the local player this
   * drives the HUD (and the hit feedback); for anyone else it drives their bar.
   * @param {{id?:string, hp?:number, maxHp?:number, damage?:number, sourceName?:string}} payload
   */
  handlePlayerHp(payload = {}) {
    if (!payload.id || !Number.isFinite(payload.hp)) return;

    const isLocal =
      payload.id === this.combat?.localPlayerId ||
      payload.id === this.remotePlayerManager?.localPlayerId;

    if (!isLocal) {
      this.remotePlayerManager.handlePlayerHp(payload);
      // PvP damage is drawn from the server's answer, never optimistically: a dodged
      // or refused strike must not leave a "-31" floating over an untouched body.
      if (payload.source === "pvp" && payload.damage > 0) {
        const peer = this.remotePlayerManager?.getAll?.().find((entry) => entry.id === payload.id);
        if (peer) this.combat.showFloatText(peer.x, peer.y - 30, `-${payload.damage}`, "#ffb49a");
      }
      return;
    }

    const prevHp = this.player.stats.hp;
    if (Number.isFinite(payload.maxHp) && payload.maxHp > 0) {
      this.player.stats.maxHp = payload.maxHp;
    }
    this.player.stats.hp = payload.hp;

    const damage = Number(payload.damage);
    if (Number.isFinite(damage) && damage > 0 && payload.hp < prevHp) {
      this.player.flashHit?.();
      this.combat.showFloatText(this.player.x, this.player.y - 45, `-${damage}`, "#ff7777");
      this.uiBridge.addLog(
        `Bị ${payload.sourceName || "đối thủ"} đánh trúng! -${damage} HP.`,
        "combat"
      );
    }

    this.uiBridge.updateHud(this.player.stats);
  }

  /**
   * Apply the server's authoritative MP for the local player. Peers carry no MP
   * bar, so a remote id is ignored.
   * @param {{id?:string, mp?:number, maxMp?:number}} payload
   */
  handlePlayerMp(payload = {}) {
    const isLocal =
      payload.id === this.combat?.localPlayerId ||
      payload.id === this.remotePlayerManager?.localPlayerId;
    if (!isLocal) return;

    if (Number.isFinite(payload.maxMp) && payload.maxMp > 0) {
      this.player.stats.maxMp = payload.maxMp;
    }
    if (Number.isFinite(payload.mp)) {
      this.player.stats.mp = Math.min(payload.mp, this.player.stats.maxMp);
    }

    this.uiBridge.updateHud(this.player.stats);
  }

  /**
   * Apply the server-derived combat stats (base + gear + buffs). The client never
   * computes these; it only mirrors them for the HUD and the sheet.
   * @param {{id?:string, level?:number, attack?:number, defense?:number,
   *   critRate?:number, critDamage?:number, attackSpeed?:number,
   *   maxHp?:number, maxMp?:number, nextExp?:number}} payload
   */
  handlePlayerStats(payload = {}) {
    const isLocal =
      payload.id === this.combat?.localPlayerId ||
      payload.id === this.remotePlayerManager?.localPlayerId;
    if (!isLocal) return;

    const stats = this.player.stats;
    const numeric = ["level", "attack", "defense", "critRate", "critDamage", "attackSpeed", "maxHp", "maxMp", "nextExp"];
    numeric.forEach((key) => {
      if (Number.isFinite(payload[key])) stats[key] = payload[key];
    });

    stats.hp = Math.min(stats.hp, stats.maxHp);
    stats.mp = Math.min(stats.mp, stats.maxMp);
    this.uiBridge.updateHud(stats);
  }

  /**
   * Mirror the worn gear the server persisted. Combat bonuses arrive separately
   * in `player_stats`, so this only redraws the rig and updates the HUD.
   * @param {{equipment?:Record<string,string|null>}} payload
   */
  handleEquipmentSync(payload = {}) {
    if (!payload.equipment || !this.player) return;
    this.player.applyEquipment(payload.equipment);
    // A different weapon means a different skill kit: pull its art now and tell
    // the HUD so the skill panel shows the matching tree.
    if (this.player.weaponType) {
      ensureWeaponVfx(this, skillsForWeapon(this.player.weaponType));
    }
    this.emitEquipment();
    this.uiBridge.updateHud(this.player.stats);
  }

  /**
   * Surface the result of a server-side use/equip/unequip action.
   * @param {{ok?:boolean, action?:string, itemId?:string, slot?:string,
   *   reason?:string, heal?:number, restoreMp?:number}} payload
   */
  handleItemResult(payload = {}) {
    const reasons = {
      not_usable: "Vật phẩm này không dùng được.",
      missing_item: "Hành trang không còn vật phẩm này.",
      not_equippable: "Vật phẩm không thể trang bị.",
      unknown_slot: "Ô trang bị không hợp lệ.",
      empty_slot: "Ô trang bị đang trống.",
      unknown_item: "Vật phẩm không tồn tại.",
      already_learned: "Bạn đã học chiêu thức này rồi.",
      level: "Cấp độ nhân vật chưa đủ cho chiêu thức này.",
      prereq: "Cần học chiêu thức trước đó trước khi học sách này.",
      not_learned: "Bạn chưa học chiêu thức này.",
      max_level: "Chiêu thức đã đạt cấp tối đa.",
      coins: "Không đủ bạc cho chiêu thức này.",
      exp: "Không đủ kinh nghiệm cho chiêu thức này."
    };

    if (payload.ok === false) {
      this.uiBridge.addLog(reasons[payload.reason] || "Thao tác không thực hiện được.", "guide");
      return;
    }

    if (payload.action === "use") {
      if (payload.heal > 0) {
        this.combat.showFloatText(this.player.x, this.player.y - 68, `+${payload.heal} HP`, "#69db7c");
      }
      if (payload.restoreMp > 0) {
        this.combat.showFloatText(this.player.x, this.player.y - 68, `+${payload.restoreMp} MP`, "#74c0fc");
      }
      return;
    }

    if (payload.action === "learn") {
      const skill = payload.skillId ? skillById(payload.skillId) : null;
      const name = skill ? translate(skill.nameKey, undefined, skill.id) : "chiêu thức mới";
      this.uiBridge.addLog(`Đã học ${name}!`, "system");
      playTone(880, 0.2, "triangle", 0.05);
      return;
    }

    if (payload.action === "skill_upgrade") {
      const skill = payload.skillId ? skillById(payload.skillId) : null;
      const name = skill ? translate(skill.nameKey, undefined, skill.id) : "chiêu thức";
      this.uiBridge.addLog(`${name} đã lên cấp ${payload.level}!`, "system");
      playTone(980, 0.2, "triangle", 0.05);
      return;
    }

    const itemName = getItemById(payload.itemId)?.name || payload.itemId || payload.slot;
    if (payload.action === "equip") {
      this.uiBridge.addLog(`Đã trang bị ${itemName}.`, "system");
    } else if (payload.action === "unequip") {
      this.uiBridge.addLog(`Đã tháo ${itemName}.`, "system");
    }
  }

  /**
   * Explain a refused cast (foreign weapon, unlearned technique, passive).
   * @param {{skillId?:string, reason?:string}} payload
   */
  handleSkillRejected(payload = {}) {
    const reasons = {
      weapon: "Vũ khí đang trang bị không dùng được chiêu thức này.",
      locked: "Bạn chưa học chiêu thức này hoặc cấp độ chưa đủ.",
      passive: "Tâm pháp bị động luôn vận hành, không cần thi triển."
    };
    const skill = payload.skillId ? skillById(payload.skillId) : null;
    const name = skill ? translate(skill.nameKey, undefined, skill.id) : "Chiêu thức";
    this.uiBridge.addLog(`${name}: ${reasons[payload.reason] || "Không thể thi triển."}`, "guide");
  }

  /**
   * The server refused the join: there is no authoritative world to play in, so
   * the gate stays closed and the reason is logged.
   * @param {{reason?:string}} payload
   */
  handleJoinRejected(payload = {}) {
    const reasons = {
      auth: "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.",
      character: "Nhân vật không thuộc tài khoản này."
    };
    const reason = payload.reason === "character" ? "character" : "auth";
    this.uiBridge.addLog(reasons[payload.reason] || "Máy chủ từ chối kết nối.", "system");
    this.setConnectionBlocked(true);
    // The socket is still open, so no `disconnected` event will fire and the
    // auto-reconnect never runs. Without telling React, this gate is a dead end.
    bridge.emit(EVENTS.CONNECTION_ISSUE, { reason });
  }

  /**
   * The server declared a player defeated. The victim is teleported to the respawn
   * point; the killer gets credit and everyone else sees the outcome.
   * @param {{victimId?:string, victimName?:string, attackerId?:string, attackerName?:string, respawn?:{x:number,y:number}}} payload
   */
  handlePlayerDefeated(payload = {}) {
    if (!payload.victimId) return;

    const isLocal =
      payload.victimId === this.combat?.localPlayerId ||
      payload.victimId === this.remotePlayerManager?.localPlayerId;

    // The duel is over for that peer: never chase a corpse across the map. Our
    // own defeat also drops the lock — the server teleports us to the spawn.
    if (isLocal || (this.pvpTarget && this.pvpTarget.id === payload.victimId)) {
      this.pvpTarget = null;
    }
    if (isLocal) {
      this.enemyTarget = null;
    }

    if (isLocal) {
      this.player.stats.hp = this.player.stats.maxHp;
      this.player.invulnerable = false;
      this.player.visual.setAlpha(1);
      if (payload.respawn) {
        if (payload.respawn.mapId && payload.respawn.mapId !== this.currentMapId) {
          this.loadMap(payload.respawn.mapId, payload.respawn, { notifyServer: false });
        } else {
          this.player.setPosition(payload.respawn.x, payload.respawn.y);
        }
      } else {
        this.player.respawn();
      }
      this.combat?.clearBuffs?.();
      this.uiBridge.updateHud(this.player.stats);
      this.uiBridge.addLog(
        `Bạn đã bị đánh bại và hồi sinh tại ${this.mapDisplayName()}.`,
        "combat"
      );
      // Persist the full-HP respawn state.
      this.saveGame(false);
    }

    if (payload.attackerId && payload.attackerId === this.combat?.localPlayerId) {
      this.uiBridge.addLog(
        `Bạn đã đánh bại ${payload.victimName || "đối thủ"}!`,
        "combat"
      );
    } else if (!isLocal) {
      this.uiBridge.addLog(
        `${payload.victimName || "Một hiệp khách"} đã bị ${payload.attackerName || "đối thủ"} đánh bại.`,
        "near"
      );
    }
  }

  /**
   * Surface a refused PvP hit. Throttled per reason: a held attack button reports
   * several times a second and the reason rarely changes between attempts.
   * @param {{reason?:string}} payload
   */
  logHitRejection(payload = {}) {
    const reason = typeof payload.reason === "string" ? payload.reason : "unknown";

    // A range refusal means our copy of the peer is closer than the server's. Rather
    // than leave the player guessing, lock onto them: the duel chase closes to
    // striking distance and the next strike lands.
    if (reason === "range" && typeof payload.targetId === "string") {
      const peer = this.remotePlayerManager?.getAll?.().find((entry) => entry.id === payload.targetId);
      if (peer) this.pvpTarget = peer;
    }

    // A dodge deserves its own on-screen tell; the client no longer draws damage
    // before the server confirms it, so nothing misleading stays behind.
    if (reason === "dodged" && typeof payload.targetId === "string") {
      const peer = this.remotePlayerManager?.getAll?.().find((entry) => entry.id === payload.targetId);
      if (peer) this.combat.showFloatText(peer.x, peer.y - 30, "NÉ!", "#9fd8ff");
    }

    const now = Date.now();
    this.hitRejectAt = this.hitRejectAt || {};
    if (this.hitRejectAt[reason] && now - this.hitRejectAt[reason] < 2500) return;
    this.hitRejectAt[reason] = now;

    // A range refusal carries the distance the server measured, which is the only
    // way to tell a genuinely far target from a position mismatch. Reported in
    // ground tiles: the raw world units mean nothing next to the zoomed-out camera.
    const detail =
      reason === "range" && typeof payload.distance === "number"
        ? ` (cách ${(payload.distance / WORLD_TILE).toFixed(1)} ô, tối đa ${(PVP_ATTACK_RANGE / WORLD_TILE).toFixed(1)} ô)`
        : "";
    this.uiBridge.addLog(
      `${HIT_REJECT_MESSAGES[reason] || "Đòn tỷ thí bị máy chủ từ chối."}${detail}`,
      "combat"
    );
  }

  sendNetworkJoin() {
    if (!this.player || !this.networkClient) return;

    // The server identifies a player by their verified character id, so adopt
    // that identity locally too: kill attribution and hit rejections carry it,
    // and guest sessions are no longer a thing.
    const session = readSession();
    const characterId = session?.activeCharacter?.id || null;
    // No character means we are at the login/selection screen. Joining anyway
    // would send a null token and get the socket rejected.
    if (!characterId) return;

    this.remotePlayerManager.setLocalPlayerId(characterId);
    this.combat.setLocalPlayerId(characterId);

    // Re-login after a terminal gate (superseded / rejected session) starts from
    // a stopped client. Without waking it, the new join would be written to a
    // closed socket and the player would sit on the gate again forever.
    if (!this.networkClient.isConnected) {
      this.networkClient.connect();
    }

    this.networkClient.join({
      token: session?.token || null,
      characterId,
      // The server restores the hero on the map the client is standing on.
      mapId: this.currentMapId,
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
      vx: 0,
      vy: 0,
      direction: this.player.facing,
      pkFlag: this.player.pkFlag === true
    });
  }

  /**
   * Interact with the closest NPC in range using key F.
   */
  interactWithNearbyNpc() {
    if (!this.started || this.isPaused) return;
    const candidates = (this.stage?.npcs || [])
      .map((npc) => ({
        npc,
        dist: Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.gx, npc.gy)
      }))
      .filter((item) => isInTalkRange(item.npc, this.player.x, this.player.y))
      .sort((a, b) => a.dist - b.dist);

    if (candidates.length > 0) {
      this.player.stopMovement();
      this.pendingNpc = null;
      this.shopFlow.open(candidates[0].npc);
    } else {
      this.uiBridge.addLog("Không có NPC ở gần để nói chuyện (nhấn [F] khi lại gần NPC).");
    }
  }

  /**
   * Bind the NPC interaction key (F). Casting lives on the 1-9 hotbar keys.
   */
  bindSkillKeys() {
    if (this.skillKeyHandler) return;
    this.skillKeyHandler = (event) => {
      if (!this.started || this.isPaused) return;
      if (this.isTyping?.()) return;
      if (event.repeat) return;
      const key = normalizeKey(event);
      if (!key) return;

      if (key === "f") {
        event.preventDefault();
        this.interactWithNearbyNpc();
      }
    };
    this.input.keyboard.on("keydown", this.skillKeyHandler);
  }

  startGame() {
    this.started = true;
    this.quickSlots = loadQuickSlots(readSession()?.activeCharacter?.id);
    this.setPaused(false);
    if (this.player?.sprite?.body) {
      this.player.sprite.body.enable = true;
    }

    this.sendNetworkJoin();

    // Only the position/map are restored locally; stats, bag, gear and quests
    // arrive from the server in the join snapshot.
    this.savedData = StorageManager.load();
    if (this.savedData) {
      if (this.savedData.position && typeof this.savedData.position.x === "number") {
        const { x, y } = this.savedData.position;
        if (isInsideMap(this.map, x, y)) this.player.setPosition(x, y);
      }
      this.uiBridge.updateHud(this.player.stats);
    }

    bridge.emit(EVENTS.GAME_STARTED);

    if (this.savedData) {
      this.uiBridge.addLog("Chào mừng trở lại giang hồ!", "system");
    } else {
      this.uiBridge.addLog(
        `Bạn đã đặt chân đến ${this.mapDisplayName()}. Chúc hiệp khách hành tẩu bình an.`,
        "system"
      );
      this.player.setPosition(this.map.spawn.x, this.map.spawn.y);
    }

    this.saveGame(false);
  }

  /**
   * Keep a locked duellist honest: walk into range, then strike on every attack
   * cooldown. The lock drops once the peer disappears, lowers its PK flag, or the
   * local hero lowers theirs.
   */
  updatePvpTarget() {
    const target = this.pvpTarget;
    if (!target) return;

    // A duel cannot start inside the city: release the lock instead of chasing a
    // target the server would refuse every strike against.
    if (!this.canFight()) {
      this.pvpTarget = null;
      this.uiBridge.addLog(SAFE_ZONE_LOG, "system");
      return;
    }

    // A skill already cast at the target is driving the approach; two movement
    // owners would make the hero stutter between the two ranges.
    if (this.combat?.pendingCast) return;

    // Walking away by hand cancels the auto-attack: the player is in control.
    if (this.player.hasManualMoveInput?.()) {
      this.pvpTarget = null;
      return;
    }

    if (!target.container || target.container.active === false || !this.isDuelCandidate(target)) {
      this.pvpTarget = null;
      return;
    }

    if (!mayDuel(this.player, this.pvpMode())) {
      this.pvpTarget = null;
      this.uiBridge.addLog("Đã tắt cờ PK — hủy mục tiêu tỷ thí.", "system");
      return;
    }

    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y);
    if (distance > PVP_CHASE_DISTANCE) {
      this.player.moveTo(target.x, target.y);
      return;
    }

    // In range: stop walking (a stale click-to-move leg would keep the legs
    // jogging) and let the combat system report the hit to the server.
    this.player.stopMovement();
    this.combat.performPvpAttack(target);
  }

  /**
   * Mirror the left-click targeting rules in the mouse cursor: a living monster
   * or a PK-flagged peer under the pointer shows the saber, so the player knows
   * the next click attacks instead of walking.
   * @param {Phaser.Input.Pointer} pointer
   */
  updateHoverCursor(pointer) {
    const canvas = this.game?.canvas;
    if (!canvas) return;

    // A held button is steering the hero along the ground, so the release will
    // not attack — the cursor must not advertise one while dragging.
    const steering = this.isPointerMoving && pointer.isDown;
    const overHud = pointer.event?.target?.closest?.(HUD_BLOCK_SELECTOR);
    let cursor = DEFAULT_CURSOR;
    if (this.started && !this.isPaused && !overHud && !steering) {
      const ground = fromIso(pointer.worldX, pointer.worldY);
      // A safe zone has no attackable body: keep the plain cursor so the player is
      // never promised a strike the city will refuse.
      const mayFight = this.canFight();
      cursor = cursorForGroundPoint(
        mayFight ? this.enemyManager?.getAlive() || [] : [],
        mayFight ? this.remotePlayerManager?.getAll?.() || [] : [],
        ground.x,
        ground.y,
        { pvpMode: this.pvpMode(), localFaction: this.player?.faction || null }
      );
    }
    applyCursor(canvas, cursor);
  }

  /**
   * Chase and attack a locked monster target: close the gap into reach, then strike
   * using the left-hand skill or normal physical attack on every attack cooldown.
   * Drops when the monster dies, is despawned, or the player moves manually.
   */
  updateEnemyTarget() {
    const target = this.enemyTarget;
    if (!target) return;

    // The city never lets the hero strike, so drop the lock instead of walking
    // the hero into a target it cannot hit.
    if (!this.canFight()) {
      this.enemyTarget = null;
      return;
    }

    // A skill already cast at the target is driving the approach
    if (this.combat?.pendingCast) return;

    // Walking away manually cancels the target lock
    if (this.player?.hasManualMoveInput?.()) {
      this.enemyTarget = null;
      return;
    }

    if (target.isDead || target.active === false) {
      this.enemyTarget = null;
      return;
    }

    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y);

    // Plain sword reach: clicking a monster walks the hero into a swing.
    if (distance <= MELEE_REACH) {
      this.player.stopMovement?.();
      if (this.combat?.attackReady) {
        this.combat.performAttack();
      }
    } else {
      this.player.moveTo(target.x, target.y);
    }
  }

  /**
   * Pick the victim the touch controls aim at and paint the ring under its feet.
   *
   * Passive by design: it never walks or strikes on its own, so a player can
   * cross a monster-infested road without the hero randomly charging. The ring
   * is the promise that the next attack/skill goes there.
   */
  updateAutoTarget() {
    if (!this.autoTargetEnabled) return;

    // No ring in a safe zone: there is nothing the next attack press could hit.
    if (!this.canFight()) {
      this.clearAutoTarget();
      return;
    }

    // A chase already under way owns the ring: re-picking every frame would make
    // the halo hop to whichever monster happens to be closer mid-fight.
    const locked = this.lockedAutoTarget();
    const next = locked || this.pickTouchTarget(this.touchTargetRange());

    this.autoTarget = next;

    if (!next) {
      this.autoTargetRing?.hide();
      return;
    }

    // A hero rig draws its feet one rig-height below the anchor, so the halo has
    // to be pushed down to sit on the ground; monster art is anchored at the feet.
    const footOffset = next.kind === "player" ? HERO_FOOT_Y * WORLD_SCALE : 0;
    this.autoTargetRing?.show(next.target.x, next.target.y, next.kind, footOffset);
  }

  /**
   * How far the auto-target looks. It follows the camera instead of a fixed
   * radius, so a body the player can see — and cast at — is never silently out of
   * ring range. `screenCastRange` is the same cap skills use, which keeps the ring
   * and the cast in agreement. Falls back to {@link AUTO_TARGET_RANGE} before the
   * camera exists (tests, the first frames).
   * @returns {number}
   */
  touchTargetRange() {
    const reach = Number(this.combat?.screenCastRange?.());
    return Number.isFinite(reach) && reach > 0 ? Math.max(AUTO_TARGET_RANGE, reach) : AUTO_TARGET_RANGE;
  }

  /**
   * The nearest body the touch controls would aim at, inside `range`. Monsters
   * and (while the PK flag is up) flagged peers share one candidate list.
   * @param {number} [range]
   * @returns {{target:Object, kind:"player"|"monster"}|null}
   */
  pickTouchTarget(range = AUTO_TARGET_RANGE) {
    return pickAutoTarget({
      player: this.player,
      selfId: this.combat?.localPlayerId || null,
      // `getAll()` + the picker's own liveness check avoids allocating a filtered
      // array on every frame, which `getAlive()` would.
      enemies: this.enemyManager?.getAll?.() || [],
      peers: this.remotePlayerManager?.getAll?.() || [],
      allowPeers: mayDuel(this.player, this.pvpMode()),
      pvpMode: this.pvpMode(),
      selfFaction: this.player?.faction || null,
      range
    });
  }

  /**
   * The target an attack press committed to, if it is still worth chasing.
   * @returns {{target:Object, kind:"player"|"monster"}|null}
   */
  lockedAutoTarget() {
    const peer = this.pvpTarget;
    if (peer && this.isDuelCandidate(peer) && peer.container?.active !== false) {
      return { target: peer, kind: "player" };
    }

    const enemy = this.enemyTarget;
    if (enemy && !enemy.isDead && enemy.active !== false) {
      return { target: enemy, kind: "monster" };
    }

    return null;
  }

  /** Drop the auto-target and its ring (pause, teardown, no victim). */
  clearAutoTarget() {
    this.autoTarget = null;
    this.autoTargetRing?.hide();
  }

  /**
   * Commit the attack button to the ringed target: a monster becomes the locked
   * enemy target and a duellist the PvP target, so the existing chase walks the
   * hero into reach and keeps striking until the target is gone.
   * @returns {boolean} whether the auto-target consumed the attack
   */
  focusAutoTarget() {
    const target = this.autoTarget?.target;
    if (!target) return false;

    if (!this.canFight()) {
      this.clearAutoTarget();
      this.uiBridge.addLog(SAFE_ZONE_LOG, "system");
      return true;
    }

    if (this.autoTarget.kind === "player") {
      // The server refuses every hit from a hero the map does not let fight, so
      // fall through to the normal swing instead of starting a chase that can
      // never land.
      if (!mayDuel(this.player, this.pvpMode())) return false;
      this.pvpTarget = target;
      this.enemyTarget = null;
      this.updatePvpTarget();
      return true;
    }

    this.enemyTarget = target;
    this.pvpTarget = null;
    this.updateEnemyTarget();
    return true;
  }

  /**
   * Where a skill cast should fly. The touch layout has no cursor, so the
   * auto-target is the aim; with nothing to hit the skill follows the hero's
   * facing (a null aim) instead of a stale finger position on the HUD.
   *
   * A long-range art (Đại Tu Di Chưởng and Như Lai Thần Chưởng reach 6000) may
   * hit a body the ringed auto-target radius never reaches, so `skillId` widens
   * the search to that skill's own reach before giving up on aiming.
   * @param {string|null} [skillId]
   * @returns {{x:number,y:number}|null}
   */
  castAimPoint(skillId = null) {
    if (!this.autoTargetEnabled) {
      const pointer = this.input.activePointer;
      return pointer ? fromIso(pointer.worldX, pointer.worldY) : null;
    }

    const ringed = this.autoTarget?.target;
    if (ringed) return { x: ringed.x, y: ringed.y };

    const skill = skillId ? skillById(skillId) : null;
    const reach = Math.max(
      this.touchTargetRange(),
      Number(skill?.range) || 0,
      Number(skill?.radius) || 0
    );
    const target = this.pickTouchTarget(reach)?.target;
    return target ? { x: target.x, y: target.y } : null;
  }

  update(time, delta) {
    if (!this.started || this.isPaused || !this.player) {
      // A paused scene draws nothing new, so the halo must not linger on screen.
      this.clearAutoTarget();
      return;
    }

    // Update player movement and animation
    this.player.update(time, delta);
    // Drive pending melee approaches (walk into range, then release the skill).
    this.combat.update?.(time);
    // Close on a locked duellist and strike once in range.
    this.updatePvpTarget();
    // Close on a targeted enemy and strike once in range.
    this.updateEnemyTarget();
    // Keep the touch auto-target ring on the best nearby victim.
    this.updateAutoTarget();
    // Walk into a portal and travel to the linked map.
    this.updatePortals(time);

    // Update interaction prompts for nearby NPCs
    for (const npc of this.stage?.npcs || []) {
      const inRange = isInTalkRange(npc, this.player.x, this.player.y);
      if (npc.promptText) {
        npc.promptText.setVisible(inRange);
      }
    }

    // Open a shop once the hero has walked within talking distance.
    if (this.pendingNpc) {
      if (isInTalkRange(this.pendingNpc, this.player.x, this.player.y)) {
        this.pendingNpc = null;
        this.player.stopMovement();
        this.uiBridge.addLog("Đã đến gần NPC. Nhấn phím [F] để nói chuyện.");
      }
    }

    // Update remote players (interpolation and animations)
    if (this.remotePlayerManager) {
      this.remotePlayerManager.update(time, delta);
    }

    // Broadcast local player coordinates to network (throttled every 50ms)
    if (this.networkClient?.isConnected) {
      if (!this.lastNetworkMoveTime || time - this.lastNetworkMoveTime > 50) {
        this.lastNetworkMoveTime = time;
        const px = Math.round(this.player.x);
        const py = Math.round(this.player.y);
        const vx = Math.round(this.player.sprite?.body?.velocity?.x || 0);
        const vy = Math.round(this.player.sprite?.body?.velocity?.y || 0);
        const isMoving = Math.abs(vx) > 5 || Math.abs(vy) > 5;

        // Movement, the stop transition, and respawn/teleport jumps are all
        // reported; a plain "isMoving" gate would leave peers rendering the
        // player at its pre-respawn position (see positionSync.shouldReportPosition).
        const reportPosition = shouldReportPosition({
          isMoving,
          wasMoving: this.wasMovingLastSync,
          x: px,
          y: py,
          lastReported: this.lastReportedPos
        });

        if (reportPosition) {
          this.wasMovingLastSync = isMoving;
          this.lastReportedPos = { x: px, y: py };
          this.networkClient.sendMove({
            x: px,
            y: py,
            vx,
            vy,
            direction: this.player.facing
          });
        }
      }
    }

    // Render enemies. Player health is server-authoritative now, so the client no
    // longer applies bite damage locally — the server tick bites and streams the
    // resulting `player_hp` back (see server gameSocket.tickBites).
    this.enemyManager.update(time, delta, this.player);

    // Update UI HUD & Minimap Radar
    this.uiBridge.updateHud(this.player.stats);
    this.drawMapPanels();
  }

  /**
   * Close the multiplayer client when this scene goes away.
   *
   * React unmounts and remounts the canvas whenever the game is re-entered or a
   * module reloads (Vite HMR), and Phaser then destroys the scene. Without this
   * the abandoned `NetworkClient` stays connected and keeps auto-reconnecting
   * with the same per-tab player id, so the server closes the other socket on
   * every join and the two clients fight forever — the live client just keeps
   * logging "Mất kết nối máy chủ. Đang tự động kết nối lại...".
   */
  bindSceneTeardown() {
    this.events.once("shutdown", this.shutdown, this);
    this.events.once("destroy", this.shutdown, this);
  }

  shutdown() {
    if (this.unloadHandler) {
      window.removeEventListener("beforeunload", this.unloadHandler);
    }
    if (this.unsubscribers) {
      this.unsubscribers.forEach((unsub) => unsub());
      this.unsubscribers = [];
    }
    // The scene is going away, so nothing is left to gate: clear any overlay
    // before the socket's own `close` can fire against a dead scene.
    bridge.emit(EVENTS.NETWORK_STATE, { connected: true });
    if (this.networkClient) {
      this.networkClient.disconnect();
      this.networkClient = null;
    }
    if (this.remotePlayerManager) {
      this.remotePlayerManager.destroy();
      this.remotePlayerManager = null;
    }
    if (this.shopFlow) {
      this.shopFlow.destroy();
      this.shopFlow = null;
    }
    if (this.autoTargetRing) {
      this.autoTargetRing.destroy();
      this.autoTargetRing = null;
    }
    this.autoTarget = null;
    if (this.stage) {
      this.stage.destroy();
      this.stage = null;
    }
    if (this.player) {
      this.player.destroy?.();
      this.player = null;
    }
    if (this.uiBridge) {
      this.uiBridge.destroy();
    }
    if (this.skillKeyHandler && this.input?.keyboard) {
      this.input.keyboard.off("keydown", this.skillKeyHandler);
      this.skillKeyHandler = null;
    }
    // The canvas outlives the scene on a restart, so hand the cursor back.
    applyCursor(this.game?.canvas, DEFAULT_CURSOR);
  }
}

/**
 * Factory function to initialize Phaser game in React lifecycle
 * @param {string|HTMLElement} parent
 * @returns {Phaser.Game}
 */
export function createGame(parent) {
  const config = {
    type: Phaser.AUTO,
    parent: parent,
    width: 1280,
    height: 720,
    backgroundColor: "#24392b",
    physics: {
      default: "arcade",
      arcade: { debug: false }
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    // Keep simulating when the window loses focus. Phaser pauses the whole game on
    // blur by default, which froze the auto-chase/attack the moment the player
    // clicked the other duel window to control their second character.
    pauseOnBlur: false,
    scene: [JiangHuScene]
  };

  return new Phaser.Game(config);
}
