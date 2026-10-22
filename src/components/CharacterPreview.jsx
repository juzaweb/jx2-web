import React from "react";
import { buildCharacterPreview } from "../game/characterPreview.js";

/**
 * Paper-doll preview (static full-body art) for the character sheet.
 */
export function CharacterPreview({ gender = "male" }) {
  const preview = buildCharacterPreview({ gender });

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
    </div>
  );
}
