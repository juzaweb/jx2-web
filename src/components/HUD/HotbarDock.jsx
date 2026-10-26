import React, { useEffect, useState, useMemo } from "react";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { localizeItem } from "../../i18n/localize.js";
import { getItemById, getQuantity } from "../../game/items.js";
import { bridge, EVENTS } from "../../game/bridge.js";
import { SkillIcon } from "../SkillIcon.jsx";
import { beginItemDrag, didItemDragJustEnd } from "../Modals/pointerItemDrag.js";
import {
  DEFAULT_QUICK_SLOTS,
  skillIdFromBinding
} from "../../game/quickSlots.js";

export function HotbarDock({
  audioEnabled,
  onUseItem,
  onInventory,
  onCharacter,
  onSkills,
  onOpenHelp,
  onToggleAudio,
  onLogout,
  onTogglePk,
  pkEnabled = false,
  skills = [],
  items = [],
  inventoryItems = [],
  quickSlotsMapping = DEFAULT_QUICK_SLOTS,
  onClearQuickSlot,
  onMoveQuickSlot
}) {
  const { t } = useI18n();
  const [cooldownEnds, setCooldownEnds] = useState({});
  const [clock, setClock] = useState(0);

  useEffect(() => {
    const off = bridge.on(EVENTS.SKILL_CAST, ({ skillId, cooldown }) => {
      if (!skillId) return;
      const now = Date.now();
      setClock(now);
      setCooldownEnds((prev) => ({ ...prev, [skillId]: now + (cooldown || 0) }));
    });
    return off;
  }, []);

  useEffect(() => {
    const active = Object.values(cooldownEnds).some((end) => end > Date.now());
    if (!active) return undefined;
    const id = setInterval(() => {
      const now = Date.now();
      setClock(now);
      setCooldownEnds((prev) => {
        const next = {};
        let changed = false;
        for (const [slot, end] of Object.entries(prev)) {
          if (end > now) next[slot] = end;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 200);
    return () => clearInterval(id);
  }, [cooldownEnds]);

  const cooldownLeft = (skillId) =>
    skillId ? Math.max(0, (cooldownEnds[skillId] || 0) - clock) : 0;

  /**
   * Items are dragged with pointer events rather than HTML5 drag-and-drop, so
   * the gesture keeps working when the page is zoomed/scaled (the browser
   * hit-tests HTML5 drops in unscaled coordinates and silently drops the item).
   * Dropping on the bar — on a slot or in the gap between slots — moves the item
   * to that quick slot; releasing anywhere else takes it off the bar.
   */
  const handleSlotPointerDown = (event, fromSlot, item) => {
    beginItemDrag({
      event,
      payload: { kind: "hotbar", itemId: item.id, fromSlot },
      ghostIcon: item.icon,
      onDrop: (zone) => {
        if (zone?.type === "hotbar") {
          if (zone.slot !== fromSlot) onMoveQuickSlot?.(fromSlot, zone.slot);
          return;
        }
        // Dropped away from every drop zone: unbind the quick slot. The item
        // stays in the bag, so this is safe to undo by dragging it back down.
        if (!zone) onClearQuickSlot?.(fromSlot);
      }
    });
  };

  const handleSlotClick = (event, useSlot) => {
    // A drag already handled the gesture; ignore the click that ends it.
    if (didItemDragJustEnd(event.currentTarget)) return;
    onUseItem?.(useSlot);
  };

  const handleContextMenu = (e, slot) => {
    e.preventDefault();
    onClearQuickSlot?.(slot);
  };

  const availableItems = inventoryItems.length > 0 ? inventoryItems : items;

  // Memoize quick slots computation to avoid expensive item lookups, filtering,
  // quantity summations, and i18n localization on every 200ms cooldown clock timer tick.
  const quickSlots = useMemo(() => {
    return Array.from({ length: 9 }, (_, index) => {
      const useSlot = index + 1;
      const binding = quickSlotsMapping?.[useSlot] || null;

      // A slot holds either a sect skill or a consumable item, so the binding
      // decides which icon and which number-key action it renders.
      const skillId = skillIdFromBinding(binding);
      if (skillId) {
        const skill = skills.find((entry) => entry?.id === skillId) || null;
        return { useSlot, item: null, skill };
      }

      const itemId = binding;
      const raw = itemId ? getItemById(itemId) : null;

      let qty = 0;
      if (itemId) {
        const matched = (availableItems || []).filter((entry) => entry && entry.id === itemId);
        if (matched.length > 0) {
          qty = matched.reduce((sum, entry) => sum + (typeof entry.qty === "number" ? entry.qty : 1), 0);
        } else {
          qty = getQuantity(itemId);
        }
      }

      const item = raw ? localizeItem({ ...raw, qty }, t) : null;
      return { useSlot, item, skill: null };
    });
  }, [quickSlotsMapping, availableItems, skills, t]);

  return (
    <section className="bottom-dock" id="bottom-dock">
      <div className="dock-container">
        {/* Left Belt: 9 Numbered Quick Slots. The `data-hotbar-strip` /
            `data-hotbar-slot` contract is read back by pointerItemDrag.js
            (see HOTBAR_STRIP_ATTR / HOTBAR_SLOT_ATTR). */}
        <div className="hotbar-slots" data-hotbar-strip="">
          {quickSlots.map(({ useSlot, item, skill }) => {
            if (skill) {
              const cd = cooldownLeft(skill.id);
              const name = t(skill.nameKey, undefined, skill.id);
              return (
                <div
                  className="slot-item skill-binding"
                  id={`slot-${useSlot}`}
                  key={`slot-${useSlot}`}
                  title={t("hotbar.skillBindingTitle", { key: useSlot, name })}
                  onContextMenu={(e) => handleContextMenu(e, useSlot)}
                  onClick={(event) => handleSlotClick(event, useSlot)}
                  data-hotbar-slot={useSlot}
                  data-skill-id={skill.id}
                >
                  <span className="slot-key">{useSlot}</span>
                  <SkillIcon skill={skill} className="slot-skill-icon" />
                  {cd > 0 && <span className="slot-cd">{Math.ceil(cd / 1000)}</span>}
                </div>
              );
            }
            if (!item) {
              return (
                <div
                  className="slot-item empty"
                  id={`slot-${useSlot}`}
                  key={`slot-${useSlot}`}
                  data-hotbar-slot={useSlot}
                >
                  <span className="slot-key">{useSlot}</span>
                </div>
              );
            }
            return (
              <div
                className="slot-item"
                id={`slot-${useSlot}`}
                key={`slot-${useSlot}`}
                title={t("hotbar.slotTitle", { key: useSlot, name: item.name })}
                onPointerDown={(event) => handleSlotPointerDown(event, useSlot, item)}
                onContextMenu={(e) => handleContextMenu(e, useSlot)}
                onClick={(event) => handleSlotClick(event, useSlot)}
                data-hotbar-slot={useSlot}
              >
                <span className="slot-key">{useSlot}</span>
                <div className={`item-icon ${item.icon}`} />
                <span className="slot-qty" id={`qty-${item.id}`}>
                  {item.qty}
                </span>
              </div>
            );
          })}
        </div>

        {/* Right Utility: System Icons Tray */}
        <div className="system-icons-tray">
          <button
            className="sys-btn"
            id="char-btn"
            title={`${t("hotbar.character")} (F3)`}
            onClick={onCharacter}
          >
            <span className="sys-ico">🧍</span>
            <span className="sys-lbl">{t("hotbar.character")}</span>
          </button>
          <button
            className="sys-btn"
            id="inv-btn"
            title={`${t("hotbar.inventory")} (F4)`}
            onClick={onInventory}
          >
            <span className="sys-ico">🎒</span>
            <span className="sys-lbl">{t("hotbar.inventory")}</span>
          </button>
          <button
            className="sys-btn"
            id="skills-btn"
            title={`${t("skills.modalTitle")} (F5)`}
            onClick={onSkills}
          >
            <span className="sys-ico">🥋</span>
            <span className="sys-lbl">{t("skills.modalTitle")}</span>
          </button>
          <button
            className="sys-btn"
            id="help-btn"
            title={t("hotbar.help")}
            onClick={onOpenHelp}
          >
            <span className="sys-ico">📜</span>
            <span className="sys-lbl">{t("hotbar.help")}</span>
          </button>
          <button
            className={`sys-btn pk-mode${pkEnabled ? " pk-active" : ""}`}
            id="pk-btn"
            title={t("hotbar.pkTitle")}
            onClick={onTogglePk}
          >
            <span className="sys-ico">⚔️</span>
            <span className="sys-lbl">{pkEnabled ? t("hotbar.pkOn") : t("hotbar.pkOff")}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
