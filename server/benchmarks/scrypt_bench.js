import { userDb } from "../src/data/userDb.js";

async function runBenchmark() {
  userDb.clear();

  await userDb.register("bench_user", "password123", "Bench User");

  let timerTicks = 0;
  let maxLagMs = 0;
  let lastTime = performance.now();

  const lagInterval = setInterval(() => {
    timerTicks++;
    const now = performance.now();
    const lag = now - lastTime - 10;
    if (lag > maxLagMs) {
      maxLagMs = lag;
    }
    lastTime = now;
  }, 10);

  const start = performance.now();
  const CONCURRENCY = 20;

  const tasks = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    tasks.push(
      new Promise((resolve) => {
        setImmediate(async () => {
          const res = await userDb.login("bench_user", "password123");
          resolve(res);
        });
      })
    );
  }

  await Promise.all(tasks);

  const duration = performance.now() - start;
  clearInterval(lagInterval);

  console.log(`--- BENCHMARK RESULTS ---`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Total duration: ${duration.toFixed(2)} ms`);
  console.log(`Max Event Loop Lag: ${maxLagMs.toFixed(2)} ms`);
  console.log(`Timer Ticks Allowed to Run: ${timerTicks}`);
  console.log(`-------------------------`);

  userDb.close();
}

runBenchmark().catch(console.error);
