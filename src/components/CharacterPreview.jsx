import React from "react";
import { buildCharacterPreview } from "../game/characterPreview.js";

/**
 * Paper-doll preview (static full-body art + dynamic equipment layers) for the character sheet.
 */
export function CharacterPreview({ gender = "male", equipment = {} }) {
  const preview = buildCharacterPreview({ gender, equipment });

  return (
    <div
      className="char-model-preview"
      aria-hidden="true"
      style={{ aspectRatio: preview.aspectRatio }}
    >
      <div
        className="char-model-body"
        style={{
          backgroundImage: `url(${preview.textureUrl})`,
          backgroundSize: preview.backgroundSize,
          backgroundPosition: preview.backgroundPosition
        }}
      />
      {preview.layers?.map((layer) => (
        <div
          key={layer.key}
          className={`char-model-layer char-model-${layer.key}`}
          style={{
            backgroundImage: `url(${layer.url})`,
            backgroundSize: preview.backgroundSize,
            backgroundPosition: preview.backgroundPosition,
            zIndex: layer.zIndex
          }}
        />
      ))}
    </div>
  );
}
