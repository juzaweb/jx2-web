/**
 * Procedural marble paving texture.
 *
 * Paints one seamless `BLOCK x BLOCK` block of isometric marble slabs onto a 2D
 * canvas using screen-unit coordinates (the canvas transform handles the texel
 * scaling). The result repeats exactly every `BLOCK` ground tiles, so it lines
 * up with the 2:1 isometric ground grid when tiled.
 *
 * Kept free of Phaser/React imports so it can be unit-tested and rendered in
 * Node with a plain canvas implementation.
 */

/** Number of ground tiles per texture block (both axes). */
export const MARBLE_BLOCK = 6;

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} tile Ground tile size in screen units (the diamond width).
 * @param {number} block Tiles per block edge.
 * @param {number} periodW Screen width of the whole block.
 */
export function paintMarbleSheet(ctx, tile, block, periodW) {
  const TILE = tile;
  const BLOCK = block;
  const OFF_X = periodW / 2;

  const palette = ["#eae5dc", "#e7e2d8", "#e5dfd4", "#e8e3d9", "#e3ddd2", "#ece7de"];

  const toCanvas = (gx, gy) => ({
    x: (gx - gy) / 2 + OFF_X,
    y: (gx + gy) / 4
  });

  const posMod = (n, m) => ((n % m) + m) % m;
  const makeRng = (seed) => {
    let s = (seed >>> 0) || 0x9e3779b9;
    return () => {
      s ^= s << 13;
      s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5;
      s >>>= 0;
      return s / 4294967296;
    };
  };

  const pathForSlab = (i, j) => {
    const a = toCanvas(i * TILE, j * TILE);
    const b = toCanvas((i + 1) * TILE, j * TILE);
    const c = toCanvas((i + 1) * TILE, (j + 1) * TILE);
    const e = toCanvas(i * TILE, (j + 1) * TILE);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(e.x, e.y);
    ctx.closePath();
    return [a, b, c, e];
  };

  // The canvas is the axis-aligned bounding box of the projected block, so its
  // corners reach roughly half a block beyond the block in ground space. Draw a
  // wide margin of slabs (indices wrapped modulo BLOCK for a seamless result) so
  // the whole rectangle is covered, not just the central diamond.
  for (let j = -BLOCK; j <= 2 * BLOCK; j++) {
    for (let i = -BLOCK; i <= 2 * BLOCK; i++) {
      const bi = posMod(i, BLOCK);
      const bj = posMod(j, BLOCK);
      const rand = makeRng((bi * 73856093) ^ (bj * 19349663) ^ ((bi + bj) * 7));
      const corners = pathForSlab(i, j);
      const center = {
        x: (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4,
        y: (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4
      };

      // Base tone with a soft diagonal light/shadow gradient.
      ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
      ctx.fill();
      const grad = ctx.createLinearGradient(corners[0].x, corners[0].y, corners[2].x, corners[2].y);
      grad.addColorStop(0, `rgba(255,252,246,${0.03 + rand() * 0.04})`);
      grad.addColorStop(0.55, "rgba(255,252,246,0)");
      grad.addColorStop(1, `rgba(120,112,98,${0.03 + rand() * 0.04})`);
      ctx.fillStyle = grad;
      ctx.fill();

      // Everything from here is clipped to the slab diamond.
      ctx.save();
      ctx.clip();

      for (let k = 0, clouds = 1 + Math.floor(rand() * 2); k < clouds; k++) {
        const cx = corners[0].x + rand() * (corners[2].x - corners[0].x);
        const cy = corners[0].y + rand() * (corners[2].y - corners[0].y);
        const radius = TILE * (0.22 + rand() * 0.26);
        const cloud = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        cloud.addColorStop(0, rand() > 0.45 ? "rgba(150,142,128,0.06)" : "rgba(255,253,247,0.10)");
        cloud.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = cloud;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      }

      const veins = rand() > 0.35 ? 2 : 1;
      for (let k = 0; k < veins; k++) {
        const vertical = rand() > 0.5;
        const steps = 48;
        const start = -0.2 + rand() * 0.2;
        const end = 1.0 + rand() * 0.2;
        const baseLine = 0.1 + rand() * 0.8;
        const amp = 0.05 + rand() * 0.12;
        const freq = 0.9 + rand() * 1.4;
        const phase = rand() * Math.PI * 2;
        const dark = rand() > 0.45;

        const points = [];
        for (let s = 0; s <= steps; s++) {
          const u = start + ((end - start) * s) / steps;
          const wobble =
            Math.sin(u * freq * Math.PI + phase) * amp +
            Math.sin(u * freq * 2.3 * Math.PI + phase * 1.7) * amp * 0.35;
          const v = baseLine + wobble;
          points.push(toCanvas((i + (vertical ? u : v)) * TILE, (j + (vertical ? v : u)) * TILE));
        }

        const strokePath = (width, style) => {
          ctx.beginPath();
          points.forEach((p, index) => (index === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.lineWidth = width;
          ctx.strokeStyle = style;
          ctx.stroke();
        };

        // Wide soft bloom under the vein, then a thin darker core.
        strokePath(5 + rand() * 5, dark ? "rgba(150,141,126,0.05)" : "rgba(255,253,247,0.07)");
        strokePath(
          0.6 + rand() * 1.0,
          dark
            ? `rgba(150,141,126,${0.12 + rand() * 0.12})`
            : `rgba(255,252,245,${0.18 + rand() * 0.18})`
        );
      }
      ctx.restore();

      // Soft joint between slabs.
      pathForSlab(i, j);
      ctx.lineJoin = "round";
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = "rgba(150,142,128,0.4)";
      ctx.stroke();
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = "rgba(112,104,90,0.18)";
      ctx.stroke();

      // Thin inner bevel highlight.
      ctx.beginPath();
      corners.forEach((p, index) => {
        const x = p.x + (center.x - p.x) * 0.035;
        const y = p.y + (center.y - p.y) * 0.035;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = "rgba(255,253,247,0.2)";
      ctx.stroke();
    }
  }
}
