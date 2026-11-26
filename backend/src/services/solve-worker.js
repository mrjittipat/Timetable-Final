import { parentPort, workerData } from 'node:worker_threads';
import { solve } from './solver.js';
import { diagnose, bestSeed } from './diagnose.js';

const { mode, data, config, options = {} } = workerData;
const onProgress = (message) => parentPort.postMessage({ type: 'progress', message });

let result;
if (mode === 'solve') {
  result = solve(data, config, { ...options, onProgress });
} else if (mode === 'diagnose') {
  result = diagnose(data, config, { ...options, onProgress });
} else if (mode === 'best') {
  result = bestSeed(data, config, { ...options, onProgress });
} else {
  throw new Error(`Unknown worker mode: ${mode}`);
}

parentPort.postMessage({ type: 'result', result });
