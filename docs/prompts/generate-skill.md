# Hướng Dẫn & Bộ Prompt Chi Tiết Từng Skill Bằng AI

Tài liệu này cung cấp bộ prompt chuẩn và cụ thể cho **toàn bộ 19 kỹ năng** hiện có trong game **JX2-Web ("Giang Hồ")**.

Mỗi kỹ năng đều được trang bị đầy đủ **2 Prompt Visual Asset riêng biệt**:
1. **Prompt 1 (Skill Icon):** Tạo ảnh icon 1:1 đại diện trên Hotbar và cây kỹ năng `F5`.
2. **Prompt 2 (VFX Sprite Sheet):** Tạo dải frame hoạt họa hiệu ứng (dải 4 frame tỉ lệ 4:1 hoặc lưới 16 frame 1:1, nền đen `solid black background`) chuẩn `256×256 px/frame` cho engine Phaser 3.

---

## 1. Prompt Dành Cho Coding Agent (Code Logic)

> Dùng mẫu prompt dưới đây khi muốn AI viết code thêm hoặc cập nhật logic chiêu thức vào codebase:

```markdown
You are an expert game developer working on the JX2-Web ("Giang Hồ") codebase.
Your task is to implement or update a skill into the game according to `docs/weapon-skills.md`.

### Skill Details:
- **Weapon Type:** [kiem | bao-tay | dao]
- **Skill ID:** [skill_id]
- **Skill Name (VI / EN / ZH):** [Name VI] / [Name EN] / [Name ZH]
- **Slot Index:** [0..8] | **Unlock Level:** [Level] | **MP:** [Cost] | **Cooldown:** [ms]
- **Target Type:** ["enemy" | "self"] | **Range:** [px] | **Radius:** [AoE px] | **Mult:** [Multiplier]
- **Effects:** [{ kind: "buff"|"heal"|"stun"|"slow"|"regen", ... }]
- **VFX Config:** { sprite?: "vfx-<skill_id>", cast?: "shockwave"|"slash"|"aura", preset?: "..." }
- **Book Metadata:** { viName: "Bí Kíp ...", dropTiers: ["..."] }

### Implementation Steps:
1. Catalog in `src/game/skills/catalog/<weapon>.js` using `defineSkill({...})`.
2. Locales in `src/i18n/locales/{vi,en,zh}.js`.
3. Drop tables in `src/game/enemyCatalog.js` (matches valid monster IDs).
4. Register VFX sprite in `src/game/lazyAssets.js` under `VFX_SPRITES`.
5. Run tests: `npm run validate:skills`, `npm test`, `npm run server:test`.
```

---

## 2. Chi Tiết Từng Skill: Bộ Đôi Prompt (Icon & Sprite Sheet)

---

### PHẦN A: BỘ KỸ NĂNG BAO TAY (`bao-tay` - 6 Kỹ Năng)

---

#### 1. Thiếu Lâm Tâm Pháp (`thieu_lam_tam_phap` - Slot 0, Bị động hồi máu)
* **Prompt 1 (Icon):**
```text
A 2D game skill icon of ancient Shaolin internal breathing art (Thiếu Lâm Tâm Pháp), Wuxia style. A serene silhouette of a meditating monk in golden lotus posture, surrounded by gentle golden vital energy waves and warm inner light particles. Dark brown parchment background with an antique brass square frame with Buddhist swastika corner filigree. Centered composition, clean UI vector feel, 8k --ar 1:1 --v 6.0
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of pulsating internal vitality healing aura, top-down isometric view. Single horizontal row of 4 animation frames from left to right: Frame 1: soft golden mist gathering around the hero's core; Frame 2: a circular golden lotus energy ring pulsing outward; Frame 3: glowing vital light particles floating upward like fireflies; Frame 4: gentle golden aura settling into a peaceful ambient glow. Pure solid black background, evenly spaced frames, 256x256 per frame, high contrast, clean transparent VFX ready --ar 4:1 --v 6.0 --style raw
```

---

#### 2. Đại Tu Di Chưởng (`dai_tu_di_chuong` - Slot 1, Chưởng lực tầm xa gây choáng)
* **Prompt 1 (Icon):**
```text
A high-detail 2D game skill icon of the Great Sumeru Palm (Đại Tu Di Chưởng), Chinese Wuxia fantasy style. A heavy metallic bronze-gold palm bursting forward with thunderous momentum, surrounded by intense kinetic wind shockwaves and glowing Sanskrit glyphs. Deep obsidian parchment background, heavy square Tibetan bronze frame with dragon relief. High contrast, sharp icon clarity at 64x64, mobile RPG asset --ar 1:1 --v 6.0 --style raw
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of a flying golden palm energy projectile and impact shockwave, isometric perspective. Single horizontal row of 4 animation frames from left to right: Frame 1: a compressed golden hand palm shape shooting forward leaving an energy tail; Frame 2: the golden palm colliding with air pressure distortion; Frame 3: violent shockwave burst with concentric golden blast rings and flying rock fragments; Frame 4: residual golden dust and dispersing smoke ripples. Solid pure black background, 256x256 cell size, high contrast --ar 4:1 --v 6.0 --style raw
```

---

#### 3. La Hán Quyền (`la_han_quyen` - Slot 2, Liên hoàn quyền đả kích)
* **Prompt 1 (Icon):**
```text
A 2D game skill icon of Arhat Fist barrage (La Hán Quyền), martial arts style. A pair of glowing clenched bronze gauntlet fists striking forward at blinding speed, enveloped in fiery golden impact sparks, motion speed lines, and sacred prayer bead trails. Dark slate background, ornate square hammered copper border with cloud patterns. Crisp game UI asset, dynamic action pose --ar 1:1 --v 6.0
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of rapid phantom fist strikes flurry, top-down arcade combat view. Single horizontal row of 4 animation frames from left to right: Frame 1: three phantom golden fist silhouettes thrusting forward; Frame 2: crisscrossing golden fist barrage with rapid impact flashes; Frame 3: heavy dual-fist cross slam creating a radial spark burst; Frame 4: fading golden motion blurs and dissolving energy ripples. Pure solid black background, centered in each frame, 256x256 per frame, high contrast --ar 4:1 --v 6.0 --style raw
```

---

#### 4. La Hán Trận (`la_han_tran` - Slot 3, Trận pháp buff công / thủ / tốc độ)
* **Prompt 1 (Icon):**
```text
A 2D MMORPG skill icon of the Sacred Arhat Formation Array (La Hán Trận), Wuxia style. A circular golden Buddhist mandala array with eight glowing Sanskrit dharmachakra wheels and golden lotus petals revolving around a brilliant center. Rich dark background, antique gold square frame with Buddhist vajra corners. High contrast, pristine iconography --ar 1:1 --v 6.0
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D sprite sheet animation of a circular glowing Buddhist formation ring on the ground, top-down view. A 4x4 grid of 16 sequential animation frames showing a seamless rotating formation: glowing golden Sanskrit runes and spinning lotus mandala ring rotating steadily, emitting rising divine golden light dust and pulsing outer perimeter. Solid black background, uniform cell spacing, 256x256 per cell, seamless looping effect --ar 1:1 --v 6.0 --style raw
```

---

#### 5. Kim Cang Bất Hoại (`kim_cang_bat_hoai` - Slot 4, Hộ thể kim chung bất hoại)
* **Prompt 1 (Icon):**
```text
A 2D skill icon of the Indestructible Vajra Body (Kim Cang Bất Hoại), classic Wuxia style. A translucent golden bell shield (Golden Bell Cocoon) glowing with sacred diamond-like facets, deflecting incoming ethereal blades, radiating divine protective aura. Dark parchment background, heavy square carved golden border. Clear silhouette, mobile game UI ready --ar 1:1 --v 6.0
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of an indestructible golden bell barrier activating, isometric view. Single horizontal row of 4 animation frames from left to right: Frame 1: radiant golden light pillars descending and curving inwards; Frame 2: a massive glowing translucent golden bell slamming onto the ground around the hero; Frame 3: bell barrier vibrating violently, emitting blinding hexagonal diamond light facets; Frame 4: steady pulsing golden shield dome with floating Sanskrit warding runes. Pure black background, 256x256 frame size, high contrast --ar 4:1 --v 6.0 --style raw
```

---

#### 6. Như Lai Thần Chưởng (`nhu_lai_than_chuong` - Slot 5, Tuyệt kỹ chưởng Phật diện rộng)
* **Prompt 1 (Icon):**
```text
A high-detail 2D game skill icon of the Buddha's Palm ultimate art (Như Lai Thần Chưởng). A colossal radiant golden divine hand palm descending from celestial storm clouds, crackling with golden divine lightning and blinding heavenly light beams. Dark textured stone background, ornate royal gold imperial frame with dragon carvings. Epic scale, masterpiece UI asset, 8k --ar 1:1 --v 6.0 --style raw
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of a colossal divine golden palm crashing onto the earth, top-down isometric view. Single horizontal row of 4 animation frames from left to right: Frame 1: a giant glowing golden hand palm silhouette dropping vertically from the sky; Frame 2: catastrophic impact crater flash with golden holy rays blasting outward; Frame 3: massive seismic ground fissure ring expanding with erupting golden flames and molten rock fragments; Frame 4: fading residual sacred steam, dissipating gold sparks and burning palm print. Solid black background, 256x256 per frame, high contrast --ar 4:1 --v 6.0 --style raw
```

---

### PHẦN B: BỘ KỸ NĂNG KIẾM (`kiem` - 9 Kỹ Năng)

---

#### 7. Kiếm Khí (`kiem_khi` - Slot 0, Kỹ năng khởi đầu bắn phi kiếm)
* **Prompt 1 (Icon):**
```text
A 2D game skill icon of flying sword qi projectile (Kiếm Khí), Wuxia style. A razor-sharp celestial steel sword tip releasing an azure cyan crescent energy blast forward with shimmering light trails. Dark moody slate background, antique bronze square frame with sword-hilt filigree. Clean centered icon, vibrant cyan glow --ar 1:1 --v 6.0
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of a flying sword-shaped qi shard, horizontal projectile motion. Single horizontal row of 4 animation frames from left to right: Frame 1: a condensed cyan blade shard launching with thrust speed lines; Frame 2: the flying blade surrounded by a spinning vortex of wind and light; Frame 3: blade detonating on impact in a starburst of flying glass-like sword fragments; Frame 4: fading azure energy sparks dissolving into thin air. Solid black background, 256x256 per frame, high contrast --ar 4:1 --v 6.0 --style raw
```

---

#### 8. Thiếu Dương Kiếm Pháp (`thieu_duong_kiem_phap` - Slot 1, Kiếm pháp sơ nhập Võ Đang)
* **Prompt 1 (Icon):**
```text
A 2D game skill icon of the Shao Yang Sword Technique (Thiếu Dương Kiếm Pháp), Taoist Wuxia style. An elegant steel longsword slashing upward with a blazing warm amber and golden solar morning-sun qi aura. Dark parchment background, antique copper square frame with Taoist cloud carvings. Sharp silhouette, readable at 64x64 --ar 1:1 --v 6.0
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of a swift solar sword slash arc, isometric combat view. Single horizontal row of 4 animation frames from left to right: Frame 1: blade tip igniting with warm amber solar energy; Frame 2: a clean curving golden slash trail sweeping across a 120-degree arc; Frame 3: solar slash trail bursting into warm ember sparkles; Frame 4: thin dissipation of lingering golden light ribbon. Pure black background, 256x256 per frame, high contrast --ar 4:1 --v 6.0 --style raw
```

---

#### 9. Thái Cực Quyền (`thai_cuc_quyen` - Slot 2, Nhu hòa chuyển hóa kình lực)
* **Prompt 1 (Icon):**
```text
A 2D game skill icon of Tai Chi Fist (Thái Cực Quyền), Taoist martial arts style. A glowing black and white Yin-Yang Tai Chi sphere spinning between fluid martial palms, radiating soft white mist and ripple energy rings. Dark stone background, carved jade and silver square frame. Serene mystical balance, clean icon design --ar 1:1 --v 6.0
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of an expanding Tai Chi Yin-Yang vortex on the ground, top-down view. Single horizontal row of 4 animation frames from left to right: Frame 1: two fluid streams of black and white qi spiraling inward; Frame 2: full formation of a glowing Yin-Yang diagram rotating smoothly on the floor; Frame 3: radial burst of misty energy rings releasing outward from the center; Frame 4: gentle swirling Taoist mist fading outward. Solid black background, 256x256 per frame, high contrast --ar 4:1 --v 6.0 --style raw
```

---

#### 10. Tam Thanh Kiếm Pháp (`tam_thanh_kiem_phap` - Slot 3, Tam đạo kiếm khí phân thân)
* **Prompt 1 (Icon):**
```text
A 2D game skill icon of the Three Purities Sword Art (Tam Thanh Kiếm Pháp), Wuxia fantasy. Three ethereal translucent cyan Taoist flying swords hovering in triangular formation, crackling with electric blue qi sparks. Dark navy background, ornate square silver frame with Taoist Bagua corners. Crisp sharp icon clarity --ar 1:1 --v 6.0
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of three flying sword beams converging and piercing, top-down isometric view. Single horizontal row of 4 animation frames from left to right: Frame 1: three distinct glowing cyan sword trails diving from three angles; Frame 2: three blades piercing a central point simultaneously with electric sparks; Frame 3: triple sword explosion creating a three-pointed starburst wave; Frame 4: fading cyan sword phantoms dissolving into light trails. Solid black background, 256x256 cell size, high contrast --ar 4:1 --v 6.0 --style raw
```

---

#### 11. Toát Hồng Quân Khuyết (`toat_hong_quan_khuyet` - Slot 4, Buff công kích chân khí)
* **Prompt 1 (Icon):**
```text
A 2D skill icon of the Cosmic Rainbow Aura (Toát Hồng Quân Khuyết), Taoist Wuxia buff. A celestial longsword pointing upward enveloped in a spiraling vortex of deep violet, crimson and golden rainbow astral qi. Dark parchment background, square antique bronze filigree frame. Mystical power surging, vivid colors --ar 1:1 --v 6.0
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of an ascending pillar of cosmic purple-crimson aura, isometric view. Single horizontal row of 4 animation frames from left to right: Frame 1: purple and crimson energy ribbons coiling around the hero's feet; Frame 2: massive pillar of violet astral light shooting straight up; Frame 3: swirling ring of glowing Taoist talisman symbols orbiting the character; Frame 4: residual shimmering violet particles settling into an active attack buff aura. Pure black background, 256x256 per frame --ar 4:1 --v 6.0 --style raw
```

---

#### 12. Nga My Kiếm Pháp (`nga_my_kiem_phap` - Slot 5, Kiếm pháp Nga My thanh nhã)
* **Prompt 1 (Icon):**
```text
A 2D game skill icon of the Emei Sword Technique (Nga My Kiếm Pháp), elegant Wuxia style. A slender silver rapier surrounded by a gentle swirl of pink peach blossom petals and jade-green sword light. Dark indigo background, delicate white jade square frame with lotus carvings. Graceful feminine martial arts iconography --ar 1:1 --v 6.0
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of a flowing peach blossom sword slash, isometric view. Single horizontal row of 4 animation frames from left to right: Frame 1: tip of the slender blade trailing glowing pink petal wisps; Frame 2: a smooth sweeping crescent slash with fluttering blossom petals; Frame 3: crescent slash dividing into a shower of cutting jade petal blades; Frame 4: gentle scattering of pink petals fading in the wind. Solid black background, 256x256 per frame, high contrast --ar 4:1 --v 6.0 --style raw
```

---

#### 13. Mộng Điệp Thôi Tâm (`mong_diep_thoi_tam` - Slot 6, Ảo ảnh bướm mộng đoạn hồn)
* **Prompt 1 (Icon):**
```text
A 2D game skill icon of Dream Butterfly Soul Shatter (Mộng Điệp Thôi Tâm), Emei fantasy art. A luminous spiritual butterfly glowing with iridescent violet and soft magenta light resting on the edge of a curved blade, emitting dreamlike sparkling dust. Dark vignette background, ornate silver square frame. Mystical and mesmerizing UI icon --ar 1:1 --v 6.0
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of a swarm of spectral dream butterflies erupting, top-down combat view. Single horizontal row of 4 animation frames from left to right: Frame 1: a cluster of glowing violet spirit butterflies forming at the sword tip; Frame 2: butterflies surging forward in an undulating spiral vortex; Frame 3: butterfly swarm bursting into a shimmering cloud of purple stardust on impact; Frame 4: fading violet sparkles and faint glowing moth wings dissolving. Solid pure black background, 256x256 per frame --ar 4:1 --v 6.0 --style raw
```

---

#### 14. Từ Hàng Phổ Độ (`tu_hang_pho_do` - Slot 7, Nga My thánh thuật hồi phục)
* **Prompt 1 (Icon):**
```text
A 2D game skill icon of Merciful Compassion Healing (Từ Hàng Phổ Độ), Buddhist Emei style. A pure blooming white-pink sacred lotus floating on calm water, radiating restorative emerald beams and sparkling dewdrop particles. Dark velvet background, carved pearl and white jade square frame. Soothing divine aura, game UI healing asset --ar 1:1 --v 6.0
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of a sacred blooming lotus healing aura, top-down isometric view. Single horizontal row of 4 animation frames from left to right: Frame 1: glowing jade lotus bud opening at the hero's feet; Frame 2: lotus in full bloom radiating upward emerald light beams; Frame 3: shower of divine sparkling water drops and glowing jade petals raining down; Frame 4: soft residual green healing mist fading peacefully. Pure solid black background, 256x256 cell size, clean transparent VFX ready --ar 4:1 --v 6.0 --style raw
```

---

#### 15. Lưu Thủy Khánh Vân (`luu_thuy_khanh_van` - Slot 8, Buff tốc độ phiêu dật như mây nước)
* **Prompt 1 (Icon):**
```text
A 2D skill icon of Flowing Water & Auspicious Clouds (Lưu Thủy Khánh Vân), Wuxia speed buff. A graceful white crane feather gliding over spiraling crystal-blue water ripples and auspicious silver clouds. Dark teal background, square carved silver border with flowing wave motifs. Airy, swift and elegant design --ar 1:1 --v 6.0
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of spiraling water ribbons and wind cloud wisps, top-down perspective. Single horizontal row of 4 animation frames from left to right: Frame 1: swirling rings of crystal blue water and white wind gathering at the feet; Frame 2: wind and water spirals surging upward around the body; Frame 3: outward burst of gentle water droplets and floating auspicious cloud puffs; Frame 4: trailing faint wind ribbons dissipating into the sprint path. Pure black background, 256x256 per frame --ar 4:1 --v 6.0 --style raw
```

---

### PHẦN C: BỘ KỸ NĂNG ĐAO (`dao` - 4 Kỹ Năng)

---

#### 16. Ngũ Độc Tâm Pháp (`ngu_doc_tam_phap` - Slot 0, Đao pháp độc tố căn bản)
* **Prompt 1 (Icon):**
```text
A 2D game skill icon of the Five Poisons Heart Art (Ngũ Độc Tâm Pháp), dark Wuxia style. A heavy curved blackened steel saber dripping with glowing toxic emerald venom, entwined by a venomous green pit viper. Dark moody parchment background, square blackened iron frame with snake scale carvings. Sinister martial aura, sharp icon clarity --ar 1:1 --v 6.0
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of a toxic green curved saber slash, isometric combat view. Single horizontal row of 4 animation frames from left to right: Frame 1: saber blade igniting with bubbling green acid miasma; Frame 2: wide sweeping crescent slash leaving a vibrant emerald green venom trail; Frame 3: slash trail splashing into acid droplets and small poison bubbles; Frame 4: dispersing green vapor wisps fading away. Solid pure black background, 256x256 frame size, high contrast --ar 4:1 --v 6.0 --style raw
```

---

#### 17. Truy Tâm Độc (`truy_tam_doc` - Slot 1, Phi đao / ám khí độc xuyên tâm)
* **Prompt 1 (Icon):**
```text
A 2D game skill icon of Heart-Piercing Venom (Truy Tâm Độc), Five Poisons assassin art. A wicked jagged poisoned throwing needle flying forward aimed at a dark glowing cursed human heart silhouette, dripping purple scorpion poison. Deep obsidian background, square dark bone and bronze frame. Dark and lethal iconography --ar 1:1 --v 6.0
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of a flying poison needle piercing and bursting, isometric view. Single horizontal row of 4 animation frames from left to right: Frame 1: a sharp purple poison needle streaking forward with a toxic smoke tail; Frame 2: needle striking the target point with an acidic purple flash; Frame 3: explosive burst of toxic purple needles and acid blood droplets flying outward; Frame 4: fading dark purple poison smoke dissolving. Pure black background, 256x256 cell size --ar 4:1 --v 6.0 --style raw
```

---

#### 18. Vạn Độc Triệu Cổ (`van_doc_chieu_hong` - Slot 2, Triệu hồi cổ trùng bộc phát)
* **Prompt 1 (Icon):**
```text
A 2D game skill icon of Ten Thousand Poisons Gu Summoning (Vạn Độc Triệu Cổ), Wuxia necromancy style. An ancient weathered dark clay Gu pot overflowing with swarming glowing purple centipedes, horned beetles, and toxic green smoke fumes. Pitch black background, square withered wood and iron frame with insect reliefs. Eerie and terrifying asset --ar 1:1 --v 6.0
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of a swarming poisonous insect explosion on the ground, top-down isometric view. Single horizontal row of 4 animation frames from left to right: Frame 1: bubbling pool of green acid forming with glowing insect eyes; Frame 2: violent eruption of toxic purple miasma and swarming spectral centipedes bursting upward; Frame 3: expanding shockwave cloud of stinging venomous insects and green acid splashes; Frame 4: cloud dissipating into lingering toxic ground sludge and fading fumes. Solid black background, 256x256 per frame --ar 4:1 --v 6.0 --style raw
```

---

#### 19. U Hồn Phiệt Ảnh (`u_hong_phiet_anh` - Slot 3, Buff bạo kích bóng ma quỷ ảnh)
* **Prompt 1 (Icon):**
```text
A 2D skill icon of the Nether Ghost Phantom Strike (U Hồn Phiệt Ảnh), dark assassin buff. A terrifying ghostly specter with glowing purple hollow eyes looming behind a pair of crossed curved daggers, surrounded by ethereal phantom smoke. Dark abyss background, square wrought-iron frame with thorn filigree. Menacing dark fantasy design --ar 1:1 --v 6.0
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of a rising ghostly specter and soul fire burst, top-down isometric perspective. Single horizontal row of 4 animation frames from left to right: Frame 1: dark purple shadowy smoke rising from the hero's silhouette; Frame 2: a demonic specter phantom shrieking upward with glowing purple eyes; Frame 3: specter bursting into radial phantom soul flames and skull-shaped smoke wisps; Frame 4: soul flames settling into a sinister dark purple critical-strike aura around the body. Pure solid black background, 256x256 per frame --ar 4:1 --v 6.0 --style raw
```

---

## 3. Quy Cách Kỹ Thuật & Tích Hợp

### Thông Số Kỹ Thuật
- **Icon:** Tỉ lệ `1:1`, kích thước lưu `64×64 px` (PNG 32-bit), đặt tại `public/skills/<skill_id>.png`.
- **Sprite Sheet:** Kích thước frame `256×256 px`. Dải 4 frame có kích thước `1024×256 px` (PNG 32-bit trong suốt), đặt tại `public/skills/vfx/<skill_id>/sheet.png`.

### Cấu Hình `sheet.json` Đi Kèm Cho Mỗi Skill
Tại `public/skills/vfx/<skill_id>/sheet.json`:
```json
{
  "frameWidth": 256,
  "frameHeight": 256,
  "frameCount": 4,
  "fps": 12,
  "source": "AI generated spritesheet"
}
```

### Đăng Ký Vào Game (`src/game/lazyAssets.js`)
```javascript
export const VFX_SPRITES = {
  // Thêm dòng tương ứng cho skill:
  "vfx-<skill_id>": {
    url: "/skills/vfx/<skill_id>/sheet.png",
    frameWidth: 256,
    frameHeight: 256
  }
};
```
