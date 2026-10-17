import React, { useEffect, useRef } from "react";
import { createGame } from "../game/game.js";

export function GameCanvas() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize Phaser game attached to container
    const game = createGame(containerRef.current);

    return () => {
      // Clean up Phaser game on unmount (e.g., during Vite HMR)
      game.destroy(true);
    };
  }, []);

  return (
    <div
      id="game-container"
      ref={containerRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden"
      }}
    />
  );
}
