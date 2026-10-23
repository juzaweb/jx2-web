import { Bench } from "tinybench";
import { GRID_CELL_SIZE, AOI_RADIUS } from "../src/websocket/gameSocket.js";

class MockWebSocket {
  constructor() {
    this.readyState = 1; // WebSocket.OPEN
    this.bufferedAmount = 0;
    this.sentCount = 0;
  }
  send() {
    this.sentCount++;
  }
}

// SpatialGrid using numeric keys instead of string keys
class FastSpatialGrid {
  constructor(cellSize = GRID_CELL_SIZE) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  _key(cx, cy) {
    return (cx << 16) | (cy & 0xffff);
  }

  _cellCoords(x, y) {
    return [Math.floor(x / this.cellSize), Math.floor(y / this.cellSize)];
  }

  add(entity) {
    const [cx, cy] = this._cellCoords(entity.x, entity.y);
    entity._cx = cx;
    entity._cy = cy;
    const key = this._key(cx, cy);
    let set = this.grid.get(key);
    if (!set) {
      set = new Set();
      this.grid.set(key, set);
    }
    set.add(entity);
  }

  update(entity) {
    const [cx, cy] = this._cellCoords(entity.x, entity.y);
    if (entity._cx === cx && entity._cy === cy) return;
    this.remove(entity);
    this.add(entity);
  }

  remove(entity) {
    if (entity._cx !== undefined && entity._cy !== undefined) {
      const key = this._key(entity._cx, entity._cy);
      const set = this.grid.get(key);
      if (set) {
        set.delete(entity);
        if (set.size === 0) {
          this.grid.delete(key);
        }
      }
      entity._cx = undefined;
      entity._cy = undefined;
    }
  }

  getNear(x, y, radius) {
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);

    const radiusSq = radius * radius;
    const result = [];

    const cellCount = (maxCx - minCx + 1) * (maxCy - minCy + 1);
    if (cellCount < this.grid.size) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        for (let cy = minCy; cy <= maxCy; cy++) {
          const key = this._key(cx, cy);
          const set = this.grid.get(key);
          if (set) {
            set.forEach((entity) => {
              const dx = entity.x - x;
              const dy = entity.y - y;
              if (dx * dx + dy * dy <= radiusSq) {
                result.push(entity);
              }
            });
          }
        }
      }
    } else {
      for (const set of this.grid.values()) {
        set.forEach((entity) => {
          if (entity._cx >= minCx && entity._cx <= maxCx && entity._cy >= minCy && entity._cy <= maxCy) {
            const dx = entity.x - x;
            const dy = entity.y - y;
            if (dx * dx + dy * dy <= radiusSq) {
              result.push(entity);
            }
          }
        });
      }
    }
    return result;
  }
}

// Linear implementation (current production code)
function linearBroadcastEnemiesMoved(moved, clients, playersMap, maxBufferedBytes, aoiRadius) {
  if (!moved.length) return;
  const radiusSquared = aoiRadius * aoiRadius;
  clients.forEach((client) => {
    if (client.readyState !== 1) return;
    if (client.bufferedAmount >= maxBufferedBytes) return;
    const receiver = playersMap.get(client);
    if (!receiver) return;
    const near = moved.some(
      (enemy) => (receiver.x - enemy.x) ** 2 + (receiver.y - enemy.y) ** 2 <= radiusSquared
    );
    if (near) client.send();
  });
}

// PlayerGrid query implementation with FastSpatialGrid
function playerGridBroadcastEnemiesMoved(moved, playerGrid, maxBufferedBytes, aoiRadius) {
  if (!moved.length) return;
  const recipients = new Set();
  for (let i = 0; i < moved.length; i++) {
    const enemy = moved[i];
    const nearPlayers = playerGrid.getNear(enemy.x, enemy.y, aoiRadius);
    for (let j = 0; j < nearPlayers.length; j++) {
      recipients.add(nearPlayers[j]);
    }
  }
  recipients.forEach((player) => {
    const client = player.ws;
    if (!client || client.readyState !== 1) return;
    if (client.bufferedAmount >= maxBufferedBytes) return;
    client.send();
  });
}

// Bucketed implementation
function bucketedBroadcastEnemiesMoved(moved, clients, playersMap, maxBufferedBytes, aoiRadius, cellSize = GRID_CELL_SIZE) {
  if (!moved.length) return;
  const radiusSquared = aoiRadius * aoiRadius;

  const movedGrid = new Map();
  for (let i = 0; i < moved.length; i++) {
    const enemy = moved[i];
    const cx = Math.floor(enemy.x / cellSize);
    const cy = Math.floor(enemy.y / cellSize);
    const key = (cx << 16) | (cy & 0xffff);
    let list = movedGrid.get(key);
    if (!list) {
      list = [];
      movedGrid.set(key, list);
    }
    list.push(enemy);
  }

  clients.forEach((client) => {
    if (client.readyState !== 1) return;
    if (client.bufferedAmount >= maxBufferedBytes) return;
    const receiver = playersMap.get(client);
    if (!receiver) return;

    const pcx = Math.floor(receiver.x / cellSize);
    const pcy = Math.floor(receiver.y / cellSize);

    let near = false;
    for (let dx = -1; dx <= 1 && !near; dx++) {
      for (let dy = -1; dy <= 1 && !near; dy++) {
        const key = ((pcx + dx) << 16) | ((pcy + dy) & 0xffff);
        const enemiesInCell = movedGrid.get(key);
        if (enemiesInCell) {
          for (let k = 0; k < enemiesInCell.length; k++) {
            const enemy = enemiesInCell[k];
            if ((receiver.x - enemy.x) ** 2 + (receiver.y - enemy.y) ** 2 <= radiusSquared) {
              near = true;
              break;
            }
          }
        }
      }
    }

    if (near) client.send();
  });
}

function setupScenario(numPlayers, numMovedEnemies, worldWidth = 32000, worldHeight = 32000) {
  const clients = [];
  const playersMap = new Map();
  const playerGrid = new FastSpatialGrid(GRID_CELL_SIZE);

  for (let i = 0; i < numPlayers; i++) {
    const ws = new MockWebSocket();
    const player = {
      id: `p_${i}`,
      x: Math.random() * worldWidth,
      y: Math.random() * worldHeight,
      ws
    };
    clients.push(ws);
    playersMap.set(ws, player);
    playerGrid.add(player);
  }

  const movedEnemies = [];
  for (let i = 0; i < numMovedEnemies; i++) {
    movedEnemies.push({
      id: i,
      x: Math.random() * worldWidth,
      y: Math.random() * worldHeight
    });
  }

  return { clients, playersMap, playerGrid, movedEnemies };
}

async function runBenchmark() {
  const bench = new Bench({ time: 1000 });
  const maxBufferedBytes = 1000000;
  const aoiRadius = AOI_RADIUS;

  const s1 = setupScenario(50, 10);
  const s2 = setupScenario(100, 50);
  const s3 = setupScenario(200, 200);

  bench
    .add("Linear (50 players, 10 moved)", () => {
      linearBroadcastEnemiesMoved(s1.movedEnemies, s1.clients, s1.playersMap, maxBufferedBytes, aoiRadius);
    })
    .add("Bucketed (50 players, 10 moved)", () => {
      bucketedBroadcastEnemiesMoved(s1.movedEnemies, s1.clients, s1.playersMap, maxBufferedBytes, aoiRadius);
    })
    .add("PlayerGrid (50 players, 10 moved)", () => {
      playerGridBroadcastEnemiesMoved(s1.movedEnemies, s1.playerGrid, maxBufferedBytes, aoiRadius);
    })
    .add("Linear (100 players, 50 moved)", () => {
      linearBroadcastEnemiesMoved(s2.movedEnemies, s2.clients, s2.playersMap, maxBufferedBytes, aoiRadius);
    })
    .add("Bucketed (100 players, 50 moved)", () => {
      bucketedBroadcastEnemiesMoved(s2.movedEnemies, s2.clients, s2.playersMap, maxBufferedBytes, aoiRadius);
    })
    .add("PlayerGrid (100 players, 50 moved)", () => {
      playerGridBroadcastEnemiesMoved(s2.movedEnemies, s2.playerGrid, maxBufferedBytes, aoiRadius);
    })
    .add("Linear (200 players, 200 moved)", () => {
      linearBroadcastEnemiesMoved(s3.movedEnemies, s3.clients, s3.playersMap, maxBufferedBytes, aoiRadius);
    })
    .add("Bucketed (200 players, 200 moved)", () => {
      bucketedBroadcastEnemiesMoved(s3.movedEnemies, s3.clients, s3.playersMap, maxBufferedBytes, aoiRadius);
    })
    .add("PlayerGrid (200 players, 200 moved)", () => {
      playerGridBroadcastEnemiesMoved(s3.movedEnemies, s3.playerGrid, maxBufferedBytes, aoiRadius);
    });

  await bench.run();

  console.log("=== BENCHMARK BROADCAST ENEMIES MOVED COMPARISON RESULTS ===");
  console.table(bench.table());
}

runBenchmark();
