/**
 * Translate a catalog item's display fields without mutating the shared catalog.
 * Item ids are stable, so the UI can keep showing the same object ids while the
 * name/description follow the active language.
 * @param {object|null} item
 * @param {(key: string, params?: object, fallback?: string) => string} t
 * @returns {object|null}
 */
export function localizeItem(item, t) {
  if (!item) return item;
  return {
    ...item,
    name: t(`item.${item.id}.name`, undefined, item.name),
    desc: t(`item.${item.id}.desc`, undefined, item.desc)
  };
}

/**
 * Localize bonus rows returned by `bonusRows()` / `deriveEquipmentBonuses()`.
 * @param {Array<{ stat: string, label: string, amount: number }>} rows
 * @param {(key: string, params?: object, fallback?: string) => string} t
 * @returns {Array<{ stat: string, label: string, amount: number }>}
 */
export function localizeBonusRows(rows, t) {
  return rows.map((row) => ({
    ...row,
    label: t(`bonus.${row.stat}`, undefined, row.label)
  }));
}
