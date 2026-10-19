import * as Phaser from "phaser";
import { addQuantity, rollDrop, DROP_TABLE, rollKillReward } from "./items.js";
import { parseEnemyReward } from "./rewardSync.js";
import { skillMpCost } from "./skills.js";
import { toIso, isoDepth } from "./isoProjection.js";
import { canPvpAttack } from "./pvp.js";
import { computeDamage } from "./damage.js";

let audioEnabled = true;
let audioContext = null;

export function isAudioEnabled() {
  return audioEnabled;
}

export function setAudioEnabled(enabled) {
  audioEnabled = enabled;
  return audioEnabled;
}

export function toggleAudio() {
  audioEnabled = !audioEnabled;
  return audioEnabled;
}

export function playTone(frequency = 220, duration = 0.07, type = "sine", volume = 0.025) {
  if (!audioEnabled) return;
  try {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch (_) {}
}

/**
 * Ceiling on remembered drops. Every client renders every kill's loot, so swept-up
 * entries must not accumulate for the whole session.
 */
const MAX_DROPS = 32;

/** Lifetime (ms) of a drop this client is not allowed to collect. */
const UNOWNED_DROP_TTL_MS = 8000;

/** Coerce a server-sent stat to a finite number, keeping the current value otherwise. */
const toStat = (value, fallback) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

export class CombatSystem {
  /**
   * @param {Phaser.Scene} scene
   * @param {import("./player.js").Player} player
   * @param {import("./enemy.js").EnemyManager} enemyManager
   * @param {import("./ui.js").UIManager} uiManager
   * @param {Function} [onStateChange]
   */
  constructor(scene, player, enemyManager, uiManager, onStateChange = null) {
    this.scene = scene;
    this.player = player;
    this.enemyManager = enemyManager;
    this.ui = uiManager;
    this.onStateChange = onStateChange;

    this.attackReady = true;
    this.skillReady = true;
    this.drops = [];
    /** Player id this client joined with, used to match server kill attribution. */
    this.localPlayerId = null;
  }

  performAttack() {
    if (!this.attackReady) return;
    this.attackReady = false;
    this.scene.time.delayedCall(330, () => {
      this.attackReady = true;
    });

    // Trigger physical sword thrust / lunge animation on character body
    this.player.playAttackMotion?.();

    playTone(260, 0.07, "sawtooth", 0.02);

    const facingRight = this.player.visual.scaleX >= 0;
    const slashOffsetX = facingRight ? 16 : -16;
    const base = toIso(this.player.x, this.player.y);

    // Broadcast attack to other players via network
    this.scene.networkClient?.sendAttack?.({
      skill: "normal",
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
      facingRight
    });

    const slash = this.scene.add
      .arc(
        base.x + slashOffsetX,
        base.y - 7,
        34,
        facingRight ? -70 : 110,
        facingRight ? 70 : 250,
        false,
        0xe9d59c,
        0.9
      )
      .setStrokeStyle(5, 0xf2e3bd, 0.95)
      .setDepth(isoDepth(this.player.x, this.player.y) + 10);

    this.scene.tweens.add({
      targets: slash,
      alpha: 0,
      scale: 1.4,
      duration: 190,
      onComplete: () => slash.destroy()
    });

    const candidates = this.enemyManager
      .getAlive()
      .filter((wolf) => Phaser.Math.Distance.Between(this.player.x, this.player.y, wolf.x, wolf.y) < 85);

    if (!candidates.length) {
      this.ui.addLog("Kiếm chiêu chưa chạm mục tiêu.");
      return;
    }

    candidates.sort(
      (a, b) =>
        Phaser.Math.Distance.Between(this.player.x, this.player.y, a.x, a.y) -
        Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y)
    );

    const targetEnemy = candidates[0];
    const result = computeDamage(this.player, targetEnemy, Math.random);
    this.damageEnemy(targetEnemy, result.damage, result.crit);

    if (result.crit) {
      this.ui.addLog(`Chí mạng! Kiếm chiêu đánh trúng Sói Xám gây ${result.damage} sát thương!`);
    } else {
      this.ui.addLog(`Kiếm chiêu đánh trúng Sói Xám gây ${result.damage} sát thương.`);
    }
  }

  performSkill() {
    if (!this.skillReady) return;
    const cost = skillMpCost("kiem_khi");
    if (this.player.stats.mp < cost) {
      this.ui.addLog("Nội lực không đủ để thi triển Kiếm Khí.");
      return;
    }

    this.skillReady = false;
    this.scene.time.delayedCall(1800, () => {
      this.skillReady = true;
    });

    // Trigger martial focus & release animation
    this.player.playSkillMotion?.();

    // Predict the cost locally; the server spends it authoritatively and streams
    // the resulting MP back (a refused cast resyncs this number).
    this.player.stats.mp -= cost;
    playTone(420, 0.18, "triangle", 0.035);

    // Broadcast skill to other players via network
    this.scene.networkClient?.sendAttack?.({
      skill: "kiem_khi",
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
      facingRight: this.player.visual.scaleX >= 0
    });

    const ringBase = toIso(this.player.x, this.player.y);
    const ring = this.scene.add
      .circle(ringBase.x, ringBase.y, 24, 0x80d7e9, 0.2)
      .setStrokeStyle(4, 0xb8e9f0, 0.9)
      .setDepth(isoDepth(this.player.x, this.player.y) + 5);

    this.scene.tweens.add({
      targets: ring,
      scale: 4,
      alpha: 0,
      duration: 380,
      onComplete: () => ring.destroy()
    });

    let hits = 0;
    let anyCrit = false;
    this.enemyManager.getAlive().forEach((wolf) => {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, wolf.x, wolf.y) < 145) {
        const result = computeDamage(this.player, wolf, Math.random, { skillMult: 1.4 });
        if (result.crit) anyCrit = true;
        this.damageEnemy(wolf, result.damage, result.crit);
        hits++;
      }
    });

    if (hits > 0) {
      const critText = anyCrit ? " (Chí mạng!)" : "";
      this.ui.addLog(`Kiếm Khí quét trúng ${hits} mục tiêu!${critText}`);
    } else {
      this.ui.addLog("Kiếm Khí tung ra, nhưng không trúng kẻ địch.");
    }
    this.ui.updateHud(this.player.stats);
  }

  /**
   * Strike another player. Both fighters must fly the PK flag. The damage is
   * computed here as an optimistic estimate, but the server re-validates it and
   * applies it to the target's authoritative HP — this client only reports intent.
   * @param {import("./remotePlayer.js").RemotePlayer} target
   */
  performPvpAttack(target) {
    if (!this.attackReady) return;
    if (!this.scene.networkClient?.isConnected) {
      this.ui.addLog("Cần kết nối máy chủ để tỷ thí cùng cao thủ.");
      return;
    }

    const attacker = { id: this.localPlayerId, pkFlag: this.player.pkFlag === true };
    const defender = { id: target?.id, pkFlag: target?.pkFlag === true };
    const distance = target
      ? Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y)
      : Number.NaN;

    if (!canPvpAttack(attacker, defender, distance)) {
      this.ui.addLog(
        this.player.pkFlag === true
          ? `${target?.displayName || "Đối thủ"} chưa bật cờ PK.`
          : "Hãy bật cờ PK trước khi tấn công người chơi khác."
      );
      return;
    }

    this.attackReady = false;
    this.scene.time.delayedCall(330, () => {
      this.attackReady = true;
    });

    this.player.playAttackMotion?.();
    playTone(300, 0.07, "sawtooth", 0.022);

    const facingRight = target.x >= this.player.x;
    const slashOffsetX = facingRight ? 16 : -16;
    const base = toIso(this.player.x, this.player.y);

    this.scene.networkClient?.sendAttack?.({
      skill: "normal",
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
      facingRight
    });

    const slash = this.scene.add
      .arc(
        base.x + slashOffsetX,
        base.y - 7,
        34,
        facingRight ? -70 : 110,
        facingRight ? 70 : 250,
        false,
        0xe9d59c,
        0.9
      )
      .setStrokeStyle(5, 0xf2e3bd, 0.95)
      .setDepth(isoDepth(this.player.x, this.player.y) + 10);

    this.scene.tweens.add({
      targets: slash,
      alpha: 0,
      scale: 1.4,
      duration: 190,
      onComplete: () => slash.destroy()
    });

    const result = computeDamage(this.player, target, Math.random);
    this.scene.networkClient?.sendPlayerHit?.({
      targetId: target.id,
      damage: result.damage
    });

    // Optimistic feedback; the authoritative HP arrives back from the server.
    this.showFloatText(
      target.x,
      target.y - 30,
      result.crit ? `-${result.damage} BẠO KÍCH!` : `-${result.damage}`,
      result.crit ? "#ffcc00" : "#ffb49a"
    );
    this.ui.addLog(
      `${result.crit ? "Chí mạng! " : ""}Kiếm chiêu chém tới ${target.displayName || "đối thủ"}!`
    );
  }

  damageEnemy(wolf, damage, isCrit = false) {
    if (wolf.isDead) return;

    wolf.takeHit(damage);
    const floatText = isCrit ? `-${damage} BẠO KÍCH!` : `-${damage}`;
    const floatColor = isCrit ? "#ffcc00" : "#ffb49a";
    this.showFloatText(wolf.x, wolf.y - 30, floatText, floatColor);
    playTone(isCrit ? 180 : 120, 0.06, "square", isCrit ? 0.025 : 0.012);

    // The server owns the wolf's health and position, so a hit reports damage only
    this.scene.networkClient?.sendEnemyHit?.({
      id: wolf.id,
      damage
    });

    if (wolf.hp <= 0) {
      this.handleWolfKill(wolf);
    }
  }

  handleWolfKill(wolf) {
    wolf.die();

    // Online, enemy health and the reward are server-owned: the server rolls the
    // payout and broadcasts `enemy_reward` + an authoritative `player_progress`.
    if (this.usesServerRewards()) {
      this.ui.addLog("Đánh bại Sói Xám!");
      return;
    }

    // Offline (no server connection) progression is frozen: the kill plays out,
    // but the client never mints coins/EXP of its own.
    const reward = rollKillReward(Math.random);
    this.spawnDrop(
      wolf.x + Phaser.Math.Between(-20, 20),
      wolf.y + Phaser.Math.Between(-10, 10),
      reward.drop
    );
    this.ui.addLog("Đánh bại Sói Xám! (ngoại tuyến — không nhận tiến trình)");

    // Schedule enemy revive (the server drives respawn while connected)
    this.scene.time.delayedCall(10000, () => {
      wolf.revive();
    });
  }

  /**
   * Render the authoritative reward the server rolled for a defeated enemy. The
   * payout itself is not applied here — the server credits the killer's ledger and
   * sends a `player_progress` update, which applyServerProgress() mirrors.
   * @param {Object} payload - `enemy_reward` payload
   */
  applyServerReward(payload) {
    const reward = parseEnemyReward(payload);
    if (!reward) return;

    const x = reward.x ?? this.player.x;
    const y = reward.y ?? this.player.y;
    const killedByMe = this.isLocalKiller(reward.attackerId);

    if (reward.drop) {
      // Every client renders the kill's loot, but only the attributed killer may
      // pick it up, so bystanders cannot duplicate the reward
      this.spawnDrop(x, y, reward.drop, { collectable: killedByMe });
    }

    if (!killedByMe) return;

    this.ui.addLog(`Đánh bại Sói Xám! +${reward.exp} EXP`);
    this.showFloatText(x, y - 25, `+${reward.exp} EXP`, "#f3d17f");
  }

  /**
   * Mirror the server-owned progression ledger onto the local stats. The client
   * never adds coins/EXP/level itself — it only renders what the server sends and
   * reacts to a level-up for feedback.
   * @param {{level:number, exp:number, nextExp?:number, coins:number, kills:number, maxHp?:number, maxMp?:number, levelUps?:number}} progress
   */
  applyServerProgress(progress) {
    if (!progress) return;
    const stats = this.player.stats;
    const prevLevel = stats.level;

    stats.level = toStat(progress.level, stats.level);
    stats.exp = toStat(progress.exp, stats.exp);
    stats.coins = toStat(progress.coins, stats.coins);
    stats.kills = toStat(progress.kills, stats.kills);
    if (progress.nextExp !== undefined) stats.nextExp = toStat(progress.nextExp, stats.nextExp);
    if (progress.maxHp !== undefined) stats.maxHp = toStat(progress.maxHp, stats.maxHp);
    if (progress.maxMp !== undefined) stats.maxMp = toStat(progress.maxMp, stats.maxMp);

    stats.hp = Math.min(stats.hp, stats.maxHp);
    stats.mp = Math.min(stats.mp, stats.maxMp);

    // The server remembers whether the one-off quest reward was already paid, so
    // the client can never offer it a second time.
    if (progress.questRewarded !== undefined) {
      this.ui.setQuestRewarded?.(Boolean(progress.questRewarded));
    }

    if (stats.level > prevLevel) {
      // The server also heals/refills and streams the new HP/MP; mirror it for a
      // snappy HUD before those packets land.
      stats.hp = stats.maxHp;
      stats.mp = stats.maxMp;
      this.ui.addLog(`Chúc mừng! Bạn đã lên cấp ${stats.level}. HP/MP được hồi đầy.`);
      playTone(660, 0.2, "triangle", 0.04);
      this.showFloatText(this.player.x, this.player.y - 70, "LÊN CẤP!", "#ffe7a0");
    }

    this.ui.updateHud(stats);
    if (typeof this.onStateChange === "function") {
      this.onStateChange();
    }

    // Quest completion is detected client-side from the kill count, but the
    // payout is claimed from the server.
    this.scene.time.delayedCall(650, () => {
      this.ui.updateQuest(stats, () => this.handleQuestReward());
    });
  }

  /**
   * True while a multiplayer connection owns enemy state; the reward then comes
   * from the server instead of a local roll.
   * @returns {boolean}
   */
  usesServerRewards() {
    return this.scene?.networkClient?.isConnected === true;
  }

  /**
   * @param {string|null} playerId
   */
  setLocalPlayerId(playerId) {
    this.localPlayerId = playerId;
  }

  /**
   * @param {string|null} attackerId
   * @returns {boolean} whether the server attributed the kill to this client
   */
  isLocalKiller(attackerId) {
    return Boolean(this.localPlayerId) && attackerId === this.localPlayerId;
  }

  /**
   * The quest payout is server-owned: ask the server to grant it (idempotent via
   * the persisted `quest_rewarded` flag). Offline, nothing is paid. The resulting
   * `player_progress` arrives through applyServerProgress().
   */
  handleQuestReward() {
    if (this.usesServerRewards()) {
      this.scene.networkClient?.sendQuestClaim?.();
    }
    this.ui.addLog("Nhiệm vụ hoàn thành! Phần thưởng sẽ do máy chủ trao.");
  }

  /**
   * Spawn a collectable drop. Without an explicit entry the loot is rolled
   * locally (offline play); while connected the server supplies the entry so
   * every client renders the same item.
   * @param {number} x
   * @param {number} y
   * @param {?{id:string, qty:number}} [loot]
   * @param {{collectable?:boolean}} [options] - `collectable: false` renders loot
   *   owned by another player, which only shows up in the world
   */
  spawnDrop(x, y, loot = null, { collectable = true } = {}) {
    const rolled = loot || rollDrop();
    const dropEntry = DROP_TABLE.find((entry) => entry.id === rolled.id);

    const drop = {
      x,
      y,
      phase: Math.random() * 6,
      active: true,
      collectable,
      itemId: rolled.id,
      qty: rolled.qty ?? dropEntry?.qty ?? 1,
      name: dropEntry ? dropEntry.name : rolled.id,
      // Someone else's loot can never be picked up, so it fades instead of littering
      expiresAt: collectable ? null : (this.scene.time?.now ?? 0) + UNOWNED_DROP_TTL_MS
    };

    const dropIso = toIso(x, y);
    drop.visual = this.scene.add.container(dropIso.x, dropIso.y).setDepth(isoDepth(x, y) + 5);
    if (!collectable) {
      drop.visual.setAlpha(0.55);
    }
    drop.visual.add(this.scene.add.circle(0, 0, 13, 0xe9bd59, 0.12));
    drop.visual.add(
      this.scene.add
        .polygon(0, 0, [0, -8, 7, 0, 0, 8, -7, 0], 0x8fd7b2)
        .setStrokeStyle(2, 0xe0f4c5)
    );
    drop.visual.add(this.scene.add.circle(0, 0, 2, 0xffffff));

    this.drops.push(drop);
  }

  updateDrops(time) {
    if (this.drops.length > MAX_DROPS) {
      this.drops = this.drops.filter((drop) => drop.active).slice(-MAX_DROPS);
    }

    this.drops.forEach((drop) => {
      if (!drop.active) return;

      if (!drop.collectable && time >= drop.expiresAt) {
        drop.active = false;
        drop.visual.destroy();
        return;
      }

      const dropIso = toIso(drop.x, drop.y + Math.sin(time / 180 + drop.phase) * 4);
      drop.visual.setPosition(dropIso.x, dropIso.y);

      if (
        Phaser.Math.Distance.Between(this.player.x, this.player.y, drop.x, drop.y) < 38
      ) {
        this.collectDrop(drop);
      }
    });
  }

  collectDrop(drop) {
    if (!drop.active || !drop.collectable) return;
    drop.active = false;
    drop.visual.destroy();

    // Coins are server-owned, so a pickup grants no bạc on the client. MP is
    // server-owned too: predict locally and mirror the restore into the pool.
    this.player.stats.mp = Math.min(
      this.player.stats.maxMp,
      this.player.stats.mp + 5
    );
    this.scene.networkClient?.sendRestoreMp?.({ amount: 5 });

    addQuantity(drop.itemId, drop.qty);

    const dropName = drop.name || drop.itemId;
    this.ui.addLog(`Nhặt được ${dropName} x${drop.qty}: +5 nội lực.`);
    this.ui.updateHud(this.player.stats);
    this.ui.updateInventory();
    if (typeof this.onStateChange === "function") {
      this.onStateChange();
    }
  }

  showFloatText(x, y, text, color) {
    const base = toIso(x, y);
    const label = this.scene.add
      .text(base.x, base.y, text, {
        fontFamily: "Arial",
        fontSize: "14px",
        fontStyle: "bold",
        color,
        stroke: "#172019",
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(1500);

    this.scene.tweens.add({
      targets: label,
      y: base.y - 35,
      alpha: 0,
      duration: 800,
      onComplete: () => label.destroy()
    });
  }
}
