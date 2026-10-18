import * as Phaser from "phaser";
import { addQuantity, rollDrop, DROP_TABLE, rollKillReward } from "./items.js";
import { parseEnemyReward } from "./rewardSync.js";

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
 * Pure combat damage calculation applying attack-minus-defense mitigation,
 * critical strike roll, variance, and a minimum floor of 1 damage.
 *
 * @param {Object} attacker - Attacker entity or stats object
 * @param {Object} defender - Defender entity or stats object
 * @param {Function|number} [rng=Math.random] - RNG function returning [0, 1) or static number
 * @param {Object} [options={}] - Optional modifiers and overrides
 * @param {number} [options.attack] - Override attacker attack power
 * @param {number} [options.baseDamage] - Alias override for attack power
 * @param {number} [options.defense] - Override defender defense
 * @param {number} [options.critRate] - Override attacker crit rate
 * @param {number} [options.critDamage] - Override attacker crit multiplier
 * @param {number} [options.skillMult=1] - Skill multiplier applied to mitigated damage
 * @param {number} [options.variance=0.1] - Variance fraction (e.g. 0.1 for ±10%, 0 to disable)
 * @param {number} [options.critRoll] - Explicit roll for crit check (< critRate)
 * @param {number} [options.varianceRoll] - Explicit roll for variance ([0, 1])
 * @returns {{ damage: number, crit: boolean }}
 */
export function computeDamage(attacker, defender, rng = Math.random, options = {}) {
  const nextRng = () => {
    if (typeof rng === "function") return rng();
    if (typeof rng === "number") return rng;
    return Math.random();
  };

  const attackerAttack =
    options.attack ??
    options.baseDamage ??
    attacker?.attack ??
    attacker?.stats?.attack ??
    10;
  const defenderDefense =
    options.defense ??
    defender?.defense ??
    defender?.stats?.defense ??
    0;
  const skillMult = typeof options.skillMult === "number" ? options.skillMult : 1;

  const critRate =
    options.critRate ??
    attacker?.critRate ??
    attacker?.stats?.critRate ??
    0.05;
  const critDamage =
    options.critDamage ??
    attacker?.critDamage ??
    attacker?.stats?.critDamage ??
    1.5;

  // 1. Critical strike roll (< critRate)
  const critRoll = options.critRoll !== undefined ? options.critRoll : nextRng();
  const isCrit = critRoll < critRate;

  // 2. Base mitigated damage with floor of 1
  const rawMitigated = Math.max(1, (attackerAttack - defenderDefense) * skillMult);

  // 3. Variance roll (e.g. ±10%)
  const variance = options.variance !== undefined ? options.variance : 0.1;
  let varianceFactor = 1;
  if (variance > 0) {
    const varRoll = options.varianceRoll !== undefined ? options.varianceRoll : nextRng();
    varianceFactor = 1 + (varRoll * 2 - 1) * variance;
  }

  let finalDamage = Math.max(1, rawMitigated * varianceFactor);

  // 4. Critical damage multiplier applied on crit
  if (isCrit) {
    finalDamage = Math.max(1, finalDamage * critDamage);
  }

  return {
    damage: Math.max(1, Math.round(finalDamage)),
    crit: Boolean(isCrit)
  };
}

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

    // Broadcast attack to other players via network
    this.scene.networkClient?.sendAttack?.({
      skill: "normal",
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
      facingRight
    });

    const slash = this.scene.add
      .arc(
        this.player.x + slashOffsetX,
        this.player.y - 7,
        34,
        facingRight ? -70 : 110,
        facingRight ? 70 : 250,
        false,
        0xe9d59c,
        0.9
      )
      .setStrokeStyle(5, 0xf2e3bd, 0.95)
      .setDepth(this.player.y + 10);

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
    if (this.player.stats.mp < 15) {
      this.ui.addLog("Nội lực không đủ để thi triển Kiếm Khí.");
      return;
    }

    this.skillReady = false;
    this.scene.time.delayedCall(1800, () => {
      this.skillReady = true;
    });

    // Trigger martial focus & release animation
    this.player.playSkillMotion?.();

    this.player.stats.mp -= 15;
    playTone(420, 0.18, "triangle", 0.035);

    // Broadcast skill to other players via network
    this.scene.networkClient?.sendAttack?.({
      skill: "kiem_khi",
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
      facingRight: this.player.visual.scaleX >= 0
    });

    const ring = this.scene.add
      .circle(this.player.x, this.player.y, 24, 0x80d7e9, 0.2)
      .setStrokeStyle(4, 0xb8e9f0, 0.9)
      .setDepth(this.player.y + 5);

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

  damageEnemy(wolf, damage, isCrit = false) {
    if (wolf.isDead) return;

    wolf.takeHit(damage);
    const floatText = isCrit ? `-${damage} BẠO KÍCH!` : `-${damage}`;
    const floatColor = isCrit ? "#ffcc00" : "#ffb49a";
    this.showFloatText(wolf.x, wolf.y - 30, floatText, floatColor);
    playTone(isCrit ? 180 : 120, 0.06, "square", isCrit ? 0.025 : 0.012);

    // Let the server own the health pool so nearby players see the same damage
    this.scene.networkClient?.sendEnemyHit?.({
      id: wolf.id,
      damage,
      x: Math.round(wolf.x),
      y: Math.round(wolf.y)
    });

    if (wolf.hp <= 0) {
      this.handleWolfKill(wolf);
    }
  }

  handleWolfKill(wolf) {
    wolf.die();

    // Enemy health is server-owned, so the server also rolls the reward and
    // broadcasts `enemy_reward`; applyServerReward() pays out from that message.
    if (this.usesServerRewards()) {
      this.ui.addLog("Đánh bại Sói Xám!");
      return;
    }

    this.grantKillReward(
      rollKillReward(Math.random),
      { x: wolf.x, y: wolf.y - 25 },
      {
        x: wolf.x + Phaser.Math.Between(-20, 20),
        y: wolf.y + Phaser.Math.Between(-10, 10)
      }
    );

    // Schedule enemy revive (the server drives respawn while connected)
    this.scene.time.delayedCall(10000, () => {
      wolf.revive();
    });
  }

  /**
   * Apply the authoritative reward the server rolled for a defeated enemy.
   * Every client renders the shared drop; only the attributed killer is paid.
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

    this.grantKillReward(
      { exp: reward.exp, coins: reward.coins },
      { x, y: y - 25 },
      null
    );
  }

  /**
   * Pay a kill reward to the local player: EXP, bạc, kill count, loot and the
   * quest/save side effects.
   * @param {{exp:number, coins:number}} reward
   * @param {{x:number, y:number}} feedbackPosition - where the +EXP float text appears
   * @param {?{x:number, y:number}} [dropPosition] - where a local loot drop lands, if any
   */
  grantKillReward(reward, feedbackPosition, dropPosition = null) {
    this.player.stats.kills++;
    this.player.stats.coins += reward.coins;
    this.player.stats.exp += reward.exp;

    this.ui.addLog(
      `Đánh bại Sói Xám! +${reward.exp} EXP, nhận được ${reward.coins} bạc.`
    );
    this.showFloatText(feedbackPosition.x, feedbackPosition.y, `+${reward.exp} EXP`, "#f3d17f");

    if (dropPosition) {
      this.spawnDrop(dropPosition.x, dropPosition.y);
    }

    this.checkLevelUp();
    this.ui.updateHud(this.player.stats);
    if (typeof this.onStateChange === "function") {
      this.onStateChange();
    }

    // Check quest progress after a brief interval
    this.scene.time.delayedCall(650, () => {
      this.ui.updateQuest(this.player.stats, () => this.handleQuestReward());
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

  handleQuestReward() {
    this.player.stats.exp += 50;
    this.player.stats.coins += 20;
    this.checkLevelUp();
    this.ui.addLog("Nhiệm vụ hoàn thành! Thưởng thêm 50 EXP và 20 bạc.");
    this.ui.updateHud(this.player.stats);
    if (typeof this.onStateChange === "function") {
      this.onStateChange();
    }
  }

  onBite(wolf) {
    const result = computeDamage(wolf, this.player, Math.random);
    this.damagePlayer(result.damage, result.crit);
  }

  damagePlayer(amountOrEnemy = 7, isCrit = false) {
    if (this.player.invulnerable) return;

    let amount = 7;
    let crit = Boolean(isCrit);

    if (typeof amountOrEnemy === "number") {
      amount = amountOrEnemy;
      if (amount === 7 && !isCrit) {
        const bitingWolf = this.enemyManager
          ?.getAlive?.()
          ?.find((w) => Phaser.Math.Distance.Between(this.player.x, this.player.y, w.x, w.y) < 55);
        if (bitingWolf) {
          const res = computeDamage(bitingWolf, this.player, Math.random);
          amount = res.damage;
          crit = res.crit;
        }
      }
    } else if (amountOrEnemy && typeof amountOrEnemy === "object") {
      const res = computeDamage(amountOrEnemy, this.player, Math.random);
      amount = res.damage;
      crit = res.crit;
    }

    this.player.stats.hp = Math.max(0, this.player.stats.hp - amount);
    this.player.invulnerable = true;
    this.player.visual.setAlpha(0.45);

    this.scene.time.delayedCall(700, () => {
      this.player.invulnerable = false;
      this.player.visual.setAlpha(1);
    });

    const critPrefix = crit ? "Chí mạng! " : "";
    this.ui.addLog(`${critPrefix}Bị Sói Xám cắn! -${amount} HP.`);
    this.showFloatText(
      this.player.x,
      this.player.y - 45,
      `-${amount}${crit ? " CHÍ MẠNG!" : ""}`,
      crit ? "#ff3333" : "#ff7777"
    );

    if (this.player.stats.hp <= 0) {
      this.player.stats.hp = this.player.stats.maxHp;
      this.player.stats.mp = Math.max(20, this.player.stats.mp);
      this.player.respawn();
      this.ui.addLog("Bạn được đưa về điểm hồi sinh tại Trường An.");
    }

    this.ui.updateHud(this.player.stats);
  }

  checkLevelUp() {
    let leveledUp = false;
    while (this.player.stats.exp >= this.player.stats.nextExp) {
      this.player.stats.exp -= this.player.stats.nextExp;
      this.player.stats.level++;
      this.player.stats.nextExp = Math.floor(this.player.stats.nextExp * 1.45);
      this.player.stats.maxHp += 20;
      this.player.stats.maxMp += 10;
      this.player.stats.hp = this.player.stats.maxHp;
      this.player.stats.mp = this.player.stats.maxMp;
      leveledUp = true;

      this.ui.addLog(
        `Chúc mừng! Bạn đã lên cấp ${this.player.stats.level}. HP/MP được hồi đầy.`
      );
      playTone(660, 0.2, "triangle", 0.04);
      this.showFloatText(this.player.x, this.player.y - 70, "LÊN CẤP!", "#ffe7a0");
    }

    if (leveledUp) {
      this.ui.updateHud(this.player.stats);
      if (typeof this.onStateChange === "function") {
        this.onStateChange();
      }
    }
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
      name: dropEntry ? dropEntry.name : rolled.id
    };

    drop.visual = this.scene.add.container(x, y).setDepth(y + 5);
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
    this.drops.forEach((drop) => {
      if (!drop.active) return;

      drop.visual.setPosition(
        drop.x,
        drop.y + Math.sin(time / 180 + drop.phase) * 4
      );

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

    this.player.stats.coins += 5;
    this.player.stats.mp = Math.min(
      this.player.stats.maxMp,
      this.player.stats.mp + 5
    );

    addQuantity(drop.itemId, drop.qty);

    const dropName = drop.name || drop.itemId;
    this.ui.addLog(`Nhặt được ${dropName} x${drop.qty}: +5 bạc, +5 nội lực.`);
    this.ui.updateHud(this.player.stats);
    if (typeof this.onStateChange === "function") {
      this.onStateChange();
    }
  }

  showFloatText(x, y, text, color) {
    const label = this.scene.add
      .text(x, y, text, {
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
      y: y - 35,
      alpha: 0,
      duration: 800,
      onComplete: () => label.destroy()
    });
  }
}
