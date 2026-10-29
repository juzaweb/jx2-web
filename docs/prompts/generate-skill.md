# Hướng Dẫn & Bộ Prompt Chi Tiết Từng Skill Bằng AI

Tài liệu này cung cấp bộ prompt chuẩn và cụ thể cho **toàn bộ 24 kỹ năng** trong game **JX2-Web ("Giang Hồ")**, chia theo **5 môn phái**: Thiếu Lâm (bao tay), Võ Đang (kiếm), Nga My (kiếm), Ngũ Độc (đao) và Cái Bang (bao tay).

Với mỗi kỹ năng trong game, tài nguyên hình ảnh được phân loại như sau:
- **Chiêu thức Chủ động (Active Skills):** Gồm đầy đủ **2 Prompt** — **Prompt 1 (Skill Icon)** và **Prompt 2 (VFX Sprite Sheet)**.
- **Chiêu thức Tâm Pháp (Passive / Internal Arts):** **CHỈ CÓ Prompt 1 (Skill Icon)**, hoàn toàn **KHÔNG CÓ Sprite Sheet** vì tâm pháp vận hành nội công ngầm, không thi triển hoạt họa chiêu thức ra ngoài sàn đấu.

---

## 1. Prompt Dành Cho Coding Agent (Code Logic)

> Dùng mẫu prompt dưới đây khi muốn AI viết code thêm hoặc cập nhật logic chiêu thức vào codebase:

```markdown
You are an expert game developer working on the JX2-Web ("Giang Hồ") codebase.
Your task is to implement or update a skill into the game according to `docs/sect-skills.md`.

### Skill Details:
- **Sect:** [thieu-lam | vo-dang | nga-my | ngu-doc | cai-bang]  (a sect owns a kit and a fixed weapon)
- **Skill ID:** [skill_id]
- **Skill Name (VI / EN / ZH):** [Name VI] / [Name EN] / [Name ZH]
- **Slot Index:** [0..5] | **Unlock Level:** [Level] | **MP:** [Cost] | **Cooldown:** [ms]
- **Target Type:** ["enemy" | "self"] | **Range:** [px] | **Radius:** [AoE px] | **Mult:** [Multiplier]
- **Effects:** [{ kind: "buff"|"heal"|"stun"|"slow"|"regen", ... }]
- **Requires:** [{ id: "<prerequisite_skill_id>", level: 1 }] (optional)
- **Starter:** [true only for slot 0 of a sect kit]
- **VFX Config:** { sprite?: "vfx-<skill_id>", cast?: "shockwave"|"slash"|"aura", preset?: "..." }

### Implementation Steps:
1. Catalog in `src/game/skills/catalog/<sect-file>.js` using `defineSkill({...})`,
   keeping `weapon` equal to the sect's weapon (`src/game/sects.js`).
2. Locales in `src/i18n/locales/{vi,en,zh}.js` under `skills.*`.
3. Optional: register the VFX sprite in `src/game/lazyAssets.js` under `VFX_SPRITES`.
4. Run tests: `npm run validate:skills`, `npm test`, `npm run server:test`.
```

---

## 2. Chi Tiết Từng Skill: Danh Sách Prompt (Icon & Sprite Sheet)

> [!NOTE]
> **Quy tắc phân loại Asset cho chiêu thức:**
> - **Chiêu thức Chủ động (Kiếm pháp, Đao pháp, Quyền pháp, Chưởng pháp, Trận pháp, Tuyệt kỹ):** Đầy đủ **2 Prompt** (1 Icon + 1 VFX Sprite Sheet).
> - **Chiêu thức Tâm Pháp Bị động (*Thiếu Lâm Tâm Pháp*, *Cái Bang Tâm Pháp*):** **CHỈ CÓ 1 Prompt (Icon)**, hoàn toàn **KHÔNG CÓ VFX Sprite Sheet** vì là nội công bị động tự vận hành ngầm trong cơ thể.
> - **Quy chuẩn Icon:** Thiết kế **không viền (borderless, no frame)** tràn viền (full bleed) để khung hiển thị UI trong game (`HotbarDock` / slot chiêu thức) tự quản lý viền và bo góc, tránh bị trùng lặp 2 lớp viền.
> - **Quy chuẩn Sprite Sheet:** Sử dụng **nền trắng thuần (`Solid pure white background`)** cho toàn bộ hiệu ứng chiêu thức để tối ưu tách nền AI và chuyển đổi sang PNG trong suốt (Alpha channel).

---

### PHẦN A: BỘ KỸ NĂNG THIẾU LÂM (`bao-tay` - 6 Kỹ Năng)

---

#### 1. Thiếu Lâm Tâm Pháp (`thieu_lam_tam_phap` - Slot 0, Tâm pháp khởi đầu, bị động hồi máu)
* **Prompt 1 (Icon):**
```text
A 2D game skill icon of ancient Shaolin internal breathing art (Thiếu Lâm Tâm Pháp), Wuxia style. A serene silhouette of a meditating monk in golden lotus posture, surrounded by gentle golden vital energy waves and warm inner light particles. Dark brown parchment background, borderless, no frame. Centered composition, clean UI vector feel, 8k --ar 1:1 --v 6.0 --no border frame
```
* **Prompt 2 (Sprite Sheet):** *Không có* — Chiêu thức Tâm Pháp (Nội công / Bị động) tự động vận hành trong cơ thể, không có VFX Sprite Sheet thi triển trên sàn đấu.

---

#### 2. Đại Tu Di Chưởng (`dai_tu_di_chuong` - Slot 1, Chưởng lực tầm xa gây choáng)
* **Prompt 1 (Icon):**
```text
A high-detail 2D game skill icon of the Great Sumeru Palm (Đại Tu Di Chưởng), Chinese Wuxia fantasy style. A heavy metallic bronze-gold palm bursting forward with thunderous momentum, surrounded by intense kinetic wind shockwaves and glowing Sanskrit glyphs. Deep obsidian parchment background, borderless, no frame. High contrast, sharp icon clarity at 64x64, mobile RPG asset --ar 1:1 --v 6.0 --style raw --no border frame
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of a flying golden palm energy projectile and impact shockwave, isometric perspective. Single horizontal row of 4 animation frames from left to right: Frame 1: a compressed golden hand palm shape shooting forward leaving an energy tail; Frame 2: the golden palm colliding with air pressure distortion; Frame 3: violent shockwave burst with concentric golden blast rings and flying rock fragments; Frame 4: residual golden dust and dispersing smoke ripples. Solid pure white background, 256x256 cell size, high contrast --ar 4:1 --v 6.0 --style raw
```

---

#### 3. La Hán Quyền (`la_han_quyen` - Slot 2, Liên hoàn quyền đả kích)
* **Prompt 1 (Icon):**
```text
A 2D game skill icon of Arhat Fist barrage (La Hán Quyền), martial arts style. A pair of glowing clenched bronze gauntlet fists striking forward at blinding speed, enveloped in fiery golden impact sparks, motion speed lines, and sacred prayer bead trails. Dark slate background, borderless, no frame. Crisp game UI asset, dynamic action pose --ar 1:1 --v 6.0 --no border frame
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of rapid phantom fist strikes flurry, top-down arcade combat view. Single horizontal row of 4 animation frames from left to right: Frame 1: three phantom golden fist silhouettes thrusting forward; Frame 2: crisscrossing golden fist barrage with rapid impact flashes; Frame 3: heavy dual-fist cross slam creating a radial spark burst; Frame 4: fading golden motion blurs and dissolving energy ripples. Solid pure white background, centered in each frame, 256x256 per frame, high contrast --ar 4:1 --v 6.0 --style raw
```

---

#### 4. La Hán Trận (`la_han_tran` - Slot 3, Trận pháp buff công / thủ / tốc độ)
* **Prompt 1 (Icon):**
```text
A 2D MMORPG skill icon of the Sacred Arhat Formation Array (La Hán Trận), Wuxia style. A circular golden Buddhist mandala array with eight glowing Sanskrit dharmachakra wheels and golden lotus petals revolving around a brilliant center. Rich dark background, borderless, no frame. High contrast, pristine iconography --ar 1:1 --v 6.0 --no border frame
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D sprite sheet animation of a circular glowing Buddhist formation ring on the ground, top-down view. A 4x4 grid of 16 sequential animation frames showing a seamless rotating formation: glowing golden Sanskrit runes and spinning lotus mandala ring rotating steadily, emitting rising divine golden light dust and pulsing outer perimeter. Solid pure white background, uniform cell spacing, 256x256 per cell, seamless looping effect --ar 1:1 --v 6.0 --style raw
```

---

#### 5. Kim Cang Bất Hoại (`kim_cang_bat_hoai` - Slot 4, Hộ thể kim chung bất hoại)
* **Prompt 1 (Icon):**
```text
A 2D skill icon of the Indestructible Vajra Body (Kim Cang Bất Hoại), classic Wuxia style. A translucent golden bell shield (Golden Bell Cocoon) glowing with sacred diamond-like facets, deflecting incoming ethereal blades, radiating divine protective aura. Dark parchment background, borderless, no frame. Clear silhouette, mobile game UI ready --ar 1:1 --v 6.0 --no border frame
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of an indestructible golden bell barrier activating, isometric view. Single horizontal row of 4 animation frames from left to right: Frame 1: radiant golden light pillars descending and curving inwards; Frame 2: a massive glowing translucent golden bell slamming onto the ground around the hero; Frame 3: bell barrier vibrating violently, emitting blinding hexagonal diamond light facets; Frame 4: steady pulsing golden shield dome with floating Sanskrit warding runes. Solid pure white background, 256x256 frame size, high contrast --ar 4:1 --v 6.0 --style raw
```

---

#### 6. Như Lai Thần Chưởng (`nhu_lai_than_chuong` - Slot 5, Tuyệt kỹ chưởng Phật diện rộng)
* **Prompt 1 (Icon):**
```text
A high-detail 2D game skill icon of the Buddha's Palm ultimate art (Như Lai Thần Chưởng). A colossal radiant golden divine hand palm descending from celestial storm clouds, crackling with golden divine lightning and blinding heavenly light beams. Dark textured stone background, borderless, no frame. Epic scale, masterpiece UI asset, 8k --ar 1:1 --v 6.0 --style raw --no border frame
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of a colossal divine golden palm crashing onto the earth, top-down isometric view. Single horizontal row of 4 animation frames from left to right: Frame 1: a giant glowing golden hand palm silhouette dropping vertically from the sky; Frame 2: catastrophic impact crater flash with golden holy rays blasting outward; Frame 3: massive seismic ground fissure ring expanding with erupting golden flames and molten rock fragments; Frame 4: fading residual sacred steam, dissipating gold sparks and burning palm print. Solid pure white background, 256x256 per frame, high contrast --ar 4:1 --v 6.0 --style raw
```

---

### PHẦN B: BỘ KỸ NĂNG KIẾM (Võ Đang + Nga My - 8 Kỹ Năng)

---

#### 7. Thiếu Dương Kiếm Pháp (`thieu_duong_kiem_phap` - Slot 0, Kiếm pháp khởi đầu Võ Đang)
* **Prompt 1 (Icon):**
```text
A 2D game skill icon of the Shao Yang Sword Technique (Thiếu Dương Kiếm Pháp), Taoist Wuxia style. An elegant steel longsword slashing upward with a blazing warm amber and golden solar morning-sun qi aura. Dark parchment background, borderless, no frame. Sharp silhouette, readable at 64x64 --ar 1:1 --v 6.0 --no border frame
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of a swift solar sword slash arc, isometric combat view. Single horizontal row of 4 animation frames from left to right: Frame 1: blade tip igniting with warm amber solar energy; Frame 2: a clean curving golden slash trail sweeping across a 120-degree arc; Frame 3: solar slash trail bursting into warm ember sparkles; Frame 4: thin dissipation of lingering golden light ribbon. Solid pure white background, 256x256 per frame, high contrast --ar 4:1 --v 6.0 --style raw
```

---

#### 8. Thái Cực Kiếm Pháp (`thai_cuc_kiem_phap` - Slot 1, Nhu hòa chuyển hóa kiếm kình)
* **Prompt 1 (Icon):**
```text
A 2D game skill icon of Tai Chi Sword Art (Thái Cực Kiếm Pháp), Taoist martial arts style. An elegant Taoist steel sword surrounded by a swirling black and white Yin-Yang Tai Chi sphere, radiating soft white mist and gentle defensive energy rings. Dark stone background, borderless, no frame. Serene mystical balance, clean icon design --ar 1:1 --v 6.0 --no border frame
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of an expanding Tai Chi Yin-Yang vortex on the ground, top-down view. Single horizontal row of 4 animation frames from left to right: Frame 1: two fluid streams of black and white qi spiraling inward; Frame 2: full formation of a glowing Yin-Yang diagram rotating smoothly on the floor; Frame 3: radial burst of misty energy rings releasing outward from the center; Frame 4: gentle swirling Taoist mist fading outward. Solid pure white background, 256x256 per frame, high contrast --ar 4:1 --v 6.0 --style raw
```

---

#### 9. Tam Thanh Kiếm Pháp (`tam_thanh_kiem_phap` - Slot 2, Tam đạo kiếm khí phân thân)
* **Prompt 1 (Icon):**
```text
A 2D game skill icon of the Three Purities Sword Art (Tam Thanh Kiếm Pháp), Wuxia fantasy. Three ethereal translucent cyan Taoist flying swords hovering in triangular formation, crackling with electric blue qi sparks. Dark navy background, borderless, no frame. Crisp sharp icon clarity --ar 1:1 --v 6.0 --no border frame
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of three flying sword beams converging and piercing, top-down isometric view. Single horizontal row of 4 animation frames from left to right: Frame 1: three distinct glowing cyan sword trails diving from three angles; Frame 2: three blades piercing a central point simultaneously with electric sparks; Frame 3: triple sword explosion creating a three-pointed starburst wave; Frame 4: fading cyan sword phantoms dissolving into light trails. Solid pure white background, 256x256 cell size, high contrast --ar 4:1 --v 6.0 --style raw
```

---

#### 10. Toát Hồng Quân Khuyết (`toat_hong_quan_khuyet` - Slot 3, Buff công kích chân khí)
* **Prompt 1 (Icon):**
```text
A 2D skill icon of the Cosmic Rainbow Aura (Toát Hồng Quân Khuyết), Taoist Wuxia buff. A celestial longsword pointing upward enveloped in a spiraling vortex of deep violet, crimson and golden rainbow astral qi. Dark parchment background, borderless, no frame. Mystical power surging, vivid colors --ar 1:1 --v 6.0 --no border frame
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of an ascending pillar of cosmic purple-crimson aura, isometric view. Single horizontal row of 4 animation frames from left to right: Frame 1: purple and crimson energy ribbons coiling around the hero's feet; Frame 2: massive pillar of violet astral light shooting straight up; Frame 3: swirling ring of glowing Taoist talisman symbols orbiting the character; Frame 4: residual shimmering violet particles settling into an active attack buff aura. Solid pure white background, 256x256 per frame --ar 4:1 --v 6.0 --style raw
```

---

#### 11. Nga My Kiếm Pháp (`nga_my_kiem_phap` - Slot 0, Kiếm pháp khởi đầu Nga My thanh nhã)
* **Prompt 1 (Icon):**
```text
A 2D game skill icon of the Emei Sword Technique (Nga My Kiếm Pháp), elegant Wuxia style. A slender silver rapier surrounded by a gentle swirl of pink peach blossom petals and jade-green sword light. Dark indigo background, borderless, no frame. Graceful feminine martial arts iconography --ar 1:1 --v 6.0 --no border frame
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of a flowing peach blossom sword slash, isometric view. Single horizontal row of 4 animation frames from left to right: Frame 1: tip of the slender blade trailing glowing pink petal wisps; Frame 2: a smooth sweeping crescent slash with fluttering blossom petals; Frame 3: crescent slash dividing into a shower of cutting jade petal blades; Frame 4: gentle scattering of pink petals fading in the wind. Solid pure white background, 256x256 per frame, high contrast --ar 4:1 --v 6.0 --style raw
```

---

#### 12. Mộng Điệp Thôi Tâm (`mong_diep_thoi_tam` - Slot 1, Ảo ảnh bướm mộng đoạn hồn)
* **Prompt 1 (Icon):**
```text
A 2D game skill icon of Dream Butterfly Soul Shatter (Mộng Điệp Thôi Tâm), Emei fantasy art. A luminous spiritual butterfly glowing with iridescent violet and soft magenta light resting on the edge of a curved blade, emitting dreamlike sparkling dust. Dark vignette background, borderless, no frame. Mystical and mesmerizing UI icon --ar 1:1 --v 6.0 --no border frame
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of a swarm of spectral dream butterflies erupting, top-down combat view. Single horizontal row of 4 animation frames from left to right: Frame 1: a cluster of glowing violet spirit butterflies forming at the sword tip; Frame 2: butterflies surging forward in an undulating spiral vortex; Frame 3: butterfly swarm bursting into a shimmering cloud of purple stardust on impact; Frame 4: fading violet sparkles and faint glowing moth wings dissolving. Solid pure white background, 256x256 per frame --ar 4:1 --v 6.0 --style raw
```

---

#### 13. Từ Hàng Phổ Độ (`tu_hang_pho_do` - Slot 2, Nga My thánh thuật hồi phục)
* **Prompt 1 (Icon):**
```text
A 2D game skill icon of Merciful Compassion Healing (Từ Hàng Phổ Độ), Buddhist Emei style. A pure blooming white-pink sacred lotus floating on calm water, radiating restorative emerald beams and sparkling dewdrop particles. Dark velvet background, borderless, no frame. Soothing divine aura, game UI healing asset --ar 1:1 --v 6.0 --no border frame
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of a sacred blooming lotus healing aura, top-down isometric view. Single horizontal row of 4 animation frames from left to right: Frame 1: glowing jade lotus bud opening at the hero's feet; Frame 2: lotus in full bloom radiating upward emerald light beams; Frame 3: shower of divine sparkling water drops and glowing jade petals raining down; Frame 4: soft residual green healing mist fading peacefully. Solid pure white background, 256x256 cell size, clean transparent VFX ready --ar 4:1 --v 6.0 --style raw
```

---

#### 14. Lưu Thủy Khánh Vân (`luu_thuy_khanh_van` - Slot 3, Buff tốc độ phiêu dật như mây nước)
* **Prompt 1 (Icon):**
```text
A 2D skill icon of Flowing Water & Auspicious Clouds (Lưu Thủy Khánh Vân), Wuxia speed buff. A graceful white crane feather gliding over spiraling crystal-blue water ripples and auspicious silver clouds. Dark teal background, borderless, no frame. Airy, swift and elegant design --ar 1:1 --v 6.0 --no border frame
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of spiraling water ribbons and wind cloud wisps, top-down perspective. Single horizontal row of 4 animation frames from left to right: Frame 1: swirling rings of crystal blue water and white wind gathering at the feet; Frame 2: wind and water spirals surging upward around the body; Frame 3: outward burst of gentle water droplets and floating auspicious cloud puffs; Frame 4: trailing faint wind ribbons dissipating into the sprint path. Solid pure white background, 256x256 per frame --ar 4:1 --v 6.0 --style raw
```

---

### PHẦN C: BỘ KỸ NĂNG NGŨ ĐỘC (`dao` - 4 Kỹ Năng)

---

#### 15. Ngũ Độc Đao Pháp (`ngu_doc_tam_phap` - Slot 0, Đao pháp khởi đầu, độc tố căn bản)
* **Prompt 1 (Icon):**
```text
A 2D game skill icon of the Five Poisons Saber Art (Ngũ Độc Đao Pháp), dark Wuxia style. A heavy curved blackened steel saber dripping with glowing toxic emerald venom, entwined by a venomous green pit viper. Dark moody parchment background, borderless, no frame. Sinister martial aura, sharp icon clarity --ar 1:1 --v 6.0 --no border frame
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of a toxic green curved saber slash, isometric combat view. Single horizontal row of 4 animation frames from left to right: Frame 1: saber blade igniting with bubbling green acid miasma; Frame 2: wide sweeping crescent slash leaving a vibrant emerald green venom trail; Frame 3: slash trail splashing into acid droplets and small poison bubbles; Frame 4: dispersing green vapor wisps fading away. Solid pure white background, 256x256 frame size, high contrast --ar 4:1 --v 6.0 --style raw
```

---

#### 16. Truy Tâm Độc (`truy_tam_doc` - Slot 1, Phi đao / ám khí độc xuyên tâm)
* **Prompt 1 (Icon):**
```text
A 2D game skill icon of Heart-Piercing Venom (Truy Tâm Độc), Five Poisons assassin art. A wicked jagged poisoned throwing needle flying forward aimed at a dark glowing cursed human heart silhouette, dripping purple scorpion poison. Deep obsidian background, borderless, no frame. Dark and lethal iconography --ar 1:1 --v 6.0 --no border frame
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of a flying poison needle piercing and bursting, isometric view. Single horizontal row of 4 animation frames from left to right: Frame 1: a sharp purple poison needle streaking forward with a toxic smoke tail; Frame 2: needle striking the target point with an acidic purple flash; Frame 3: explosive burst of toxic purple needles and acid blood droplets flying outward; Frame 4: fading dark purple poison smoke dissolving. Solid pure white background, 256x256 cell size --ar 4:1 --v 6.0 --style raw
```

---

#### 17. Vạn Độc Triệu Cổ (`van_doc_chieu_hong` - Slot 2, Triệu hồi cổ trùng bộc phát)
* **Prompt 1 (Icon):**
```text
A 2D game skill icon of Ten Thousand Poisons Gu Summoning (Vạn Độc Triệu Cổ), Wuxia necromancy style. An ancient weathered dark clay Gu pot overflowing with swarming glowing purple centipedes, horned beetles, and toxic green smoke fumes. Pitch black background, borderless, no frame. Eerie and terrifying asset --ar 1:1 --v 6.0 --no border frame
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of a swarming poisonous insect explosion on the ground, top-down isometric view. Single horizontal row of 4 animation frames from left to right: Frame 1: bubbling pool of green acid forming with glowing insect eyes; Frame 2: violent eruption of toxic purple miasma and swarming spectral centipedes bursting upward; Frame 3: expanding shockwave cloud of stinging venomous insects and green acid splashes; Frame 4: cloud dissipating into lingering toxic ground sludge and fading fumes. Solid pure white background, 256x256 per frame --ar 4:1 --v 6.0 --style raw
```

---

#### 18. U Hồn Phiệt Ảnh (`u_hong_phiet_anh` - Slot 3, Buff bạo kích bóng ma quỷ ảnh)
* **Prompt 1 (Icon):**
```text
A 2D skill icon of the Nether Ghost Phantom Strike (U Hồn Phiệt Ảnh), dark assassin buff. A terrifying ghostly specter with glowing purple hollow eyes looming behind a pair of crossed curved daggers, surrounded by ethereal phantom smoke. Dark abyss background, borderless, no frame. Menacing dark fantasy design --ar 1:1 --v 6.0 --no border frame
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of a rising ghostly specter and soul fire burst, top-down isometric perspective. Single horizontal row of 4 animation frames from left to right: Frame 1: dark purple shadowy smoke rising from the hero's silhouette; Frame 2: a demonic specter phantom shrieking upward with glowing purple eyes; Frame 3: specter bursting into radial phantom soul flames and skull-shaped smoke wisps; Frame 4: soul flames settling into a sinister dark purple critical-strike aura around the body. Solid pure white background, 256x256 per frame --ar 4:1 --v 6.0 --style raw
```

---

### PHẦN D: BỘ KỸ NĂNG CÁI BANG CHƯỞNG (`bao-tay` - 6 Kỹ Năng)

---

#### 19. Cái Bang Tâm Pháp (`cai_bang_tam_phap` - Slot 0, Tâm pháp khởi đầu, bị động né tránh & hồi phục)
* **Prompt 1 (Icon):**
```text
A 2D game skill icon of the Beggars' Sect Internal Mental Art (Cái Bang Tâm Pháp), classic Wuxia style. A weathered bamboo wine gourd flask hanging beside a flowing beggar belt sash, surrounded by warm amber inner qi mist, floating spirit wine vapor ripples and subtle fiery dragon breath wisps. Dark rustic slate background, borderless, no frame. Clean UI vector clarity, balanced composition, readable at 64x64 --ar 1:1 --v 6.0 --no border frame
```
* **Prompt 2 (Sprite Sheet):** *Không có* — Chiêu thức Tâm Pháp (Nội công / Bị động) tự động vận hành trong cơ thể, không có VFX Sprite Sheet thi triển trên sàn đấu.

---

#### 20. Bổ Phong Tróc Ảnh (`bo_phong_troc_anh` - Slot 1, Thân pháp chưởng phong áp sát chớp nhoáng)
* **Prompt 1 (Icon):**
```text
A 2D game skill icon of Wind-Catching Shadow Palm (Bổ Phong Tróc Ảnh), dynamic martial arts style. A rugged weathered palm thrusting forward at blinding speed, ripping through atmospheric wind barriers with swirling gale-force wind spirals and fiery orange motion blurs. Dark charcoal background, borderless, no frame. High contrast, dynamic speed impact, mobile RPG UI ready --ar 1:1 --v 6.0 --no border frame
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of a rapid dashing wind-burst and fiery palm thrust, top-down isometric combat view. Single horizontal row of 4 animation frames from left to right: Frame 1: a compressed cone of swirling wind pressure and orange dash trails launching forward; Frame 2: a fiery beggar palm silhouette piercing through an expanding sonic wind vortex; Frame 3: explosive cross-cutting wind wave impact flash with blazing orange sparks; Frame 4: fading residual gale currents and dissipating heat ripples. Solid pure white background, 256x256 cell size, high contrast --ar 4:1 --v 6.0 --style raw
```

---

#### 21. Hàng Long Chưởng (`hang_long_chuong` - Slot 2, Hỏa long chưởng kình tầm xa)
* **Prompt 1 (Icon):**
```text
A high-detail 2D game skill icon of the Dragon Subduing Palm (Hàng Long Chưởng), Chinese Wuxia fantasy style. A roaring golden-crimson celestial dragon head emerging from a powerful open strike palm, engulfed in blazing solar fire sparks and swirling incandescent heat waves. Deep obsidian stone background, borderless, no frame. Intense fiery contrast, sharp icon clarity at 64x64 --ar 1:1 --v 6.0 --style raw --no border frame
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of a flying fiery dragon projectile and impact explosion, isometric perspective. Single horizontal row of 4 animation frames from left to right: Frame 1: a coiled blazing red-gold Chinese dragon head shooting forward leaving a swirling flame tail; Frame 2: the dragon projectile lunging with open jaws and intense fire aura; Frame 3: violent detonation on collision, fiery dragon body shattering into an expanding supernova blast of fire waves and embers; Frame 4: residual fiery smoke rings and dispersing crimson sparks. Solid pure white background, 256x256 per frame, high contrast --ar 4:1 --v 6.0 --style raw
```

---

#### 22. Túy Điệp Cuồng Vũ (`tuy_diep_cuong_vu` - Slot 3, Thần pháp túy quyền buff né tránh & bạo kích)
* **Prompt 1 (Icon):**
```text
A 2D skill icon of the Drunken Butterfly Frenzy Footwork (Túy Điệp Cuồng Vũ), Wuxia drunken master style. An ancient jade wine pot pouring glistening golden liquor into a floating wooden cup, enveloped in spiraling golden liquor droplets, elusive ethereal butterfly silhouettes and fiery drunken mist. Dark aged wood background, borderless, no frame. Fluid artistic motion, vibrant warm palette --ar 1:1 --v 6.0 --no border frame
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of a drunken swirling wine aura and spectral phantom clones, top-down isometric view. Single horizontal row of 4 animation frames from left to right: Frame 1: golden liquor mist and swirling amber ribbons spiraling up from the feet; Frame 2: two illusory drunken afterimage silhouettes dodging in opposite arcs; Frame 3: golden wine splash vortex bursting into floating ember butterflies and liquor droplets; Frame 4: warm pulsing amber drunken combat aura settling around the character. Solid pure white background, 256x256 cell size, high contrast --ar 4:1 --v 6.0 --style raw
```

---

#### 23. Kháng Long Hữu Hối (`khang_long_huu_hoi` - Slot 4, Kình long bộc phát cực mạnh gây choáng)
* **Prompt 1 (Icon):**
```text
A high-detail 2D game skill icon of Proud Dragon Repents (Kháng Long Hữu Hối), epic Wuxia martial art. Two massive glowing fiery bronze dragons intertwining tightly around a forward-thrusting clenched iron fist, crackling with blinding golden solar lightning and explosive shockwave arcs. Pitch black background, borderless, no frame. Monumental physical impact, hyper-focused lighting, 8k --ar 1:1 --v 6.0 --style raw --no border frame
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of a massive dual-dragon piercing thrust and seismic stun shockwave, isometric perspective. Single horizontal row of 4 animation frames from left to right: Frame 1: two swirling red-gold fire dragons coiling tightly around an intense energy vortex; Frame 2: twin dragon energy beams piercing straight through the impact point with blinding solar flash; Frame 3: catastrophic shockwave eruption blasting concentric golden flame rings and jagged ground fissures; Frame 4: lingering dragon smoke phantoms and crackling golden lightning sparks. Solid pure white background, 256x256 per frame, high contrast --ar 4:1 --v 6.0 --style raw
```

---

#### 24. Phi Long Tại Thiên (`phi_long_tai_thien` - Slot 5, Tuyệt kỹ nộ long giáng trần oanh tạc diện rộng)
* **Prompt 1 (Icon):**
```text
A high-detail 2D game skill icon of Flying Dragon in the Heavens (Phi Long Tại Thiên), legendary ultimate Wuxia art. A colossal fiery crimson-gold celestial dragon diving straight down from stormy heavenly clouds engulfed in raging inferno flames, jaws open roaring toward the earth. Dark scorched stone background, borderless, no frame. Epic apocalyptic scale, masterpiece UI asset, 8k --ar 1:1 --v 6.0 --style raw --no border frame
```
* **Prompt 2 (Sprite Sheet):**
```text
A 2D game VFX sprite sheet of a colossal descending fire dragon crashing and inferno shockwave, top-down isometric view. Single horizontal row of 4 animation frames from left to right: Frame 1: a giant fiery dragon descending vertically from the sky wrapped in a vortex of roaring flames; Frame 2: cataclysmic impact flash as the dragon strikes the earth with outward holy flame erupting; Frame 3: massive circular inferno crater expanding with churning fire waves, flying molten rocks, and roaring flame columns; Frame 4: lingering burning scorched earth, dissipating smoke plumes and fading crimson dragon embers. Solid pure white background, 256x256 per frame, high contrast --ar 4:1 --v 6.0 --style raw
```

---

## 3. Quy Cách Kỹ Thuật & Tích Hợp

### Thông Số Kỹ Thuật
- **Icon:** Tỉ lệ `1:1`, kích thước lưu `64×64 px` (PNG 32-bit), thiết kế tràn viền không viền khung (`borderless, no frame`), đặt tại `public/skills/<skill_id>.png`.
- **Sprite Sheet:** Kích thước frame `256×256 px`. Dải 4 frame có kích thước `1024×256 px` (PNG 32-bit trong suốt), ảnh gốc AI tạo với nền trắng thuần (`Solid pure white background`) phục vụ tách nền sạch sẽ, đặt tại `public/skills/vfx/<skill_id>/sheet.png`.

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
