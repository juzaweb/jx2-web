import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "../../i18n/I18nProvider.jsx";
import { ShopModal } from "./ShopModal.jsx";

/**
 * The ledger holds đồng while the counter quotes bạc, so every render here pins
 * the 1 bạc = 100 đồng ratio from the player's side of the trade.
 */
const renderShop = (coins) =>
  renderToStaticMarkup(
    <I18nProvider>
      <ShopModal isOpen={true} coins={coins} />
    </I18nProvider>
  );

const buyButtons = (markup) => markup.match(/class="shop-buy-btn"/g) || [];
const disabledButtons = (markup) => markup.match(/class="shop-buy-btn" disabled/g) || [];
const enabledCount = (markup) => buyButtons(markup).length - disabledButtons(markup).length;
const balanceBlock = (markup) => markup.match(/<div class="shop-balance">[\s\S]*?<\/div>/)[0];

describe("ShopModal", () => {
  it("quotes the stock in bạc", () => {
    const markup = renderShop(0);

    expect(markup).toContain("8 Bạc");
    expect(markup).toContain("20 Bạc");
  });

  it("enables a purchase only when the ledger holds 100 đồng per quoted bạc", () => {
    // 8 bạc = 800 đồng, 20 bạc = 2.000 đồng.
    expect(enabledCount(renderShop(799))).toBe(0);
    expect(enabledCount(renderShop(800))).toBe(2);
    expect(enabledCount(renderShop(1999))).toBe(2);
    expect(enabledCount(renderShop(2000))).toBe(3);
  });

  it("shows the wallet in vàng, bạc and đồng", () => {
    const balance = balanceBlock(renderShop(12345));

    expect(balance).toContain("<b>1</b>");
    expect(balance).toContain("<b>23</b>");
    expect(balance).toContain("<b>45</b>");
    expect(balance).toContain("Vàng");
    expect(balance).toContain("Bạc");
    expect(balance).toContain("Đồng");
  });
});
