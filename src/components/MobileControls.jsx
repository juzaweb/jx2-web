import React from "react";

export function MobileControls({ onMove, onAttack, onSkill }) {
  const handlePointerDown = (dir) => (e) => {
    e.preventDefault();
    onMove(dir);
  };

  const handlePointerUp = (e) => {
    e.preventDefault();
    onMove(null);
  };

  return (
    <div className="mobile-controls" id="mobile-controls">
      <button
        data-move="up"
        onPointerDown={handlePointerDown("up")}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        ▲
      </button>
      <div>
        <button
          data-move="left"
          onPointerDown={handlePointerDown("left")}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          ◀
        </button>
        <button
          data-move="down"
          onPointerDown={handlePointerDown("down")}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          ▼
        </button>
        <button
          data-move="right"
          onPointerDown={handlePointerDown("right")}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          ▶
        </button>
      </div>
      <div className="mobile-combat-btns">
        <button
          id="mobile-skill"
          className="mobile-q"
          onPointerDown={(e) => {
            e.preventDefault();
            onSkill();
          }}
        >
          氣
        </button>
        <button
          id="mobile-attack"
          className="mobile-atk"
          onPointerDown={(e) => {
            e.preventDefault();
            onAttack();
          }}
        >
          ⚔
        </button>
      </div>
    </div>
  );
}
