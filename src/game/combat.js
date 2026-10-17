import * as Phaser from "phaser";

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

    this.damageEnemy(candidates[0], Phaser.Math.Between(17, 25));
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
    this.enemyManager.getAlive().forEach((wolf) => {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, wolf.x, wolf.y) < 145) {
        this.damageEnemy(wolf, Phaser.Math.Between(28, 36));
        hits++;
      }
    });

    this.ui.addLog(
      hits
        ? `Kiếm Khí quét trúng ${hits} mục tiêu!`
        : "Kiếm Khí tung ra, nhưng không trúng kẻ địch."
    );
    this.ui.updateHud(this.player.stats);
  }

  damageEnemy(wolf, damage) {
    if (wolf.isDead) return;

    wolf.takeHit(damage);
    this.showFloatText(wolf.x, wolf.y - 30, `-${damage}`, "#ffb49a");
    playTone(120, 0.06, "square", 0.012);

    if (wolf.hp <= 0) {
      this.handleWolfKill(wolf);
    }
  }

  handleWolfKill(wolf) {
    wolf.die();

    const coinsGained = Phaser.Math.Between(3, 9);
    this.player.stats.kills++;
    this.player.stats.coins += coinsGained;
    this.player.stats.exp += 35;

    this.ui.addLog(`Đánh bại Sói Xám! +35 EXP, nhận được ${coinsGained} bạc.`);
    this.showFloatText(wolf.x, wolf.y - 25, "+35 EXP", "#f3d17f");

    this.spawnDrop(
      wolf.x + Phaser.Math.Between(-20, 20),
      wolf.y + Phaser.Math.Between(-10, 10)
    );

    this.checkLevelUp();
    this.ui.updateHud(this.player.stats);
    if (typeof this.onStateChange === "function") {
      this.onStateChange();
    }

    // Check quest progress after a brief interval
    this.scene.time.delayedCall(650, () => {
      this.ui.updateQuest(this.player.stats, () => this.handleQuestReward());
    });

    // Schedule enemy revive
    this.scene.time.delayedCall(10000, () => {
      wolf.revive();
    });
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

  damagePlayer(amount) {
    if (this.player.invulnerable) return;

    this.player.stats.hp = Math.max(0, this.player.stats.hp - amount);
    this.player.invulnerable = true;
    this.player.visual.setAlpha(0.45);

    this.scene.time.delayedCall(700, () => {
      this.player.invulnerable = false;
      this.player.visual.setAlpha(1);
    });

    this.ui.addLog(`Bị Sói Xám cắn! -${amount} HP.`);

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

  spawnDrop(x, y) {
    const drop = {
      x,
      y,
      phase: Math.random() * 6,
      active: true
    };

    drop.visual = this.scene.add.container(x, y).setDepth(y + 5);
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
    if (!drop.active) return;
    drop.active = false;
    drop.visual.destroy();

    this.player.stats.coins += 5;
    this.player.stats.mp = Math.min(
      this.player.stats.maxMp,
      this.player.stats.mp + 5
    );

    this.ui.addLog("Nhặt được Túi Bạc: +5 bạc, +5 nội lực.");
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
