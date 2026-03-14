import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = resolve(__dirname, '../public/data/connections_final.json');

// Read the data
const connections = JSON.parse(readFileSync(dataPath, 'utf-8'));
const totalBefore = connections.length;
console.log(`Total connections before: ${totalBefore}`);

// Dedup: for each connection, create a canonical key using sorted IDs + type
// Keep only the FIRST occurrence of each canonical key
const seen = new Set();
const deduped = [];
let removedCount = 0;

for (const conn of connections) {
  const minId = conn.source_id < conn.target_id ? conn.source_id : conn.target_id;
  const maxId = conn.source_id < conn.target_id ? conn.target_id : conn.source_id;
  const key = `${minId}|${maxId}|${conn.type}`;

  if (seen.has(key)) {
    removedCount++;
  } else {
    seen.add(key);
    deduped.push(conn);
  }
}

const totalAfter = deduped.length;
console.log(`Total connections after:  ${totalAfter}`);
console.log(`Removed duplicates:       ${removedCount}`);
console.log(`Expected ~15,229 (removed ~1,788) — actual: ${totalAfter}`);

// Write back
writeFileSync(dataPath, JSON.stringify(deduped, null, 2), 'utf-8');
console.log(`\nWrote deduplicated data to ${dataPath}`);
