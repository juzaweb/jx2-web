import http from "node:http";
import { performance } from "node:perf_hooks";
import { initGameSocket } from "../src/websocket/gameSocket.js";

const server = http.createServer();
const gameSocket = initGameSocket(server, {});

const MAPS = ["map1", "map2", "map3", "map4", "map5", "map6", "map7", "map8", "map9", "map10"];
const PLAYER_COUNT = 5000;

for (let i = 0; i < PLAYER_COUNT; i++) {
  const ws = { readyState: 1, bufferedAmount: 0, send: () => {} };
  gameSocket.wss.clients.add(ws);
  const mapId = MAPS[i % MAPS.length];
  const player = {
    id: `player_${i}`,
    username: `user_${i}`,
    mapId,
    x: 100,
    y: 100,
    faction: "tong-kim",
    level: 10,
    hp: 100,
    maxHp: 100,
    mp: 100,
    maxMp: 100
  };
  gameSocket.players.set(ws, player);
  gameSocket.playerById.set(player.id, { ws, data: player });
  if (gameSocket.addPlayerToMap) {
    gameSocket.addPlayerToMap(mapId, ws, player);
  }
}

// 1. Measure combatantsOnMap across all maps 1000 times
const start1 = performance.now();
for (let i = 0; i < 1000; i++) {
  for (const mapId of MAPS) {
    gameSocket.combatantsOnMap(mapId);
  }
}
const dur1 = performance.now() - start1;

// 2. Measure broadcastToMap across all maps 1000 times
const start2 = performance.now();
for (let i = 0; i < 1000; i++) {
  for (const mapId of MAPS) {
    gameSocket.broadcastToMap(mapId, { type: "test" });
  }
}
const dur2 = performance.now() - start2;

// 3. Measure map change (teleport peer lookup logic) 10000 times
const testPlayer = gameSocket.players.values().next().value;
const start3 = performance.now();
for (let i = 0; i < 10000; i++) {
  const targetMapId = MAPS[i % MAPS.length];
  let peers;
  if (gameSocket.getPlayersOnMap) {
    peers = gameSocket
      .getPlayersOnMap(targetMapId)
      .filter((peer) => peer !== testPlayer)
      .map((peer) => gameSocket.playerSnapshot(peer));
  } else {
    peers = Array.from(gameSocket.players.values())
      .filter((peer) => peer !== testPlayer && peer.mapId === targetMapId)
      .map((peer) => gameSocket.playerSnapshot(peer));
  }
}
const dur3 = performance.now() - start3;

console.log(`combatantsOnMap (10k map checks): ${dur1.toFixed(2)} ms`);
console.log(`broadcastToMap (10k map broadcasts): ${dur2.toFixed(2)} ms`);
console.log(`peer filter on map change (10k operations): ${dur3.toFixed(2)} ms`);

gameSocket.close();
server.close();
