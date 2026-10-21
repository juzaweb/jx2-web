import React from "react";
import { buildCharacterPreview } from "../game/characterPreview.js";

const color = (value) =>
  typeof value === "number" ? `#${(value >>> 0).toString(16).padStart(6, "0")}` : "none";

const fillProps = (part) => ({
  fill: color(part.fill),
  stroke: color(part.stroke),
  strokeWidth: part.lineWidth ?? 1,
  opacity: part.alpha ?? 1
});

function renderPart(part, index) {
  const common = fillProps(part);

  switch (part.kind) {
    case "poly":
      return (
        <polygon
          key={index}
          points={part.points.map(([x, y]) => `${x},${y}`).join(" ")}
          {...common}
        />
      );
    case "rect":
      return (
        <rect
          key={index}
          x={part.x - part.w / 2}
          y={part.y - part.h / 2}
          width={part.w}
          height={part.h}
          {...common}
        />
      );
    case "circle":
      return <circle key={index} cx={part.x} cy={part.y} r={part.r} {...common} />;
    case "ellipse":
      return (
        <ellipse key={index} cx={part.x} cy={part.y} rx={part.w / 2} ry={part.h / 2} {...common} />
      );
    case "line":
      return (
        <line
          key={index}
          x1={part.x1}
          y1={part.y1}
          x2={part.x2}
          y2={part.y2}
          stroke={color(part.stroke)}
          strokeWidth={part.lineWidth ?? 1}
          opacity={part.alpha ?? 1}
        />
      );
    default:
      return null;
  }
}

/**
 * Paper-doll preview matching the in-game body sheet and equipped gear.
 * The wrapper holds the selected sheet frame as a background image and an SVG
 * overlay in rig coordinates, so both layers share one coordinate space.
 */
export function CharacterPreview({ gender = "male", equipment = {}, direction = 0 }) {
  const preview = buildCharacterPreview({ gender, equipment, direction });

  return (
    <div className="char-model-preview" aria-hidden="true">
      <div
        className="char-model-body"
        style={{
          backgroundImage: `url(${preview.textureUrl})`,
          backgroundSize: preview.backgroundSize,
          backgroundPosition: preview.backgroundPosition
        }}
      />
      <svg
        className="char-model-gear"
        viewBox={preview.viewBox}
        preserveAspectRatio="xMidYMid meet"
      >
        {preview.parts.map(renderPart)}
      </svg>
    </div>
  );
}
