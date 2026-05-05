/**
 * Drop all recruitment-related tables from all 4 Turso nodes.
 * Tables: UNGVIEN_UNGTUYEN, UNGVIEN, TUYENDUNG
 * Run: node drop-recruitment.mjs
 */
import { createClient } from '@libsql/client';
import 'dotenv/config';

const nodes = [
  { name: 'master',  url: process.env.TURSO_MASTER_URL,  token: process.env.TURSO_MASTER_TOKEN  },
  { name: 'hanoi',   url: process.env.TURSO_HANOI_URL,   token: process.env.TURSO_HANOI_TOKEN   },
  { name: 'danang',  url: process.env.TURSO_DANANG_URL,  token: process.env.TURSO_DANANG_TOKEN  },
  { name: 'hcm',     url: process.env.TURSO_HCM_URL,     token: process.env.TURSO_HCM_TOKEN     },
];

// Drop in dependency order: child FK tables first
const SQL_STMTS = [
  'DROP TABLE IF EXISTS UNGVIEN_UNGTUYEN',
  'DROP TABLE IF EXISTS UNGVIEN',
  'DROP TABLE IF EXISTS TUYENDUNG',
];

async function dropOnNode(node) {
  if (!node.url || !node.token) {
    console.warn(`⚠️  [${node.name}] Missing URL/TOKEN — skipping`);
    return;
  }
  const client = createClient({ url: node.url, authToken: node.token });
  for (const sql of SQL_STMTS) {
    try {
      await client.execute(sql);
      console.log(`✅ [${node.name}] ${sql}`);
    } catch (err) {
      console.error(`❌ [${node.name}] ${sql}\n   → ${err.message}`);
    }
  }
  client.close();
}

console.log('🗑️  Dropping recruitment tables from all Turso nodes...\n');
await Promise.all(nodes.map(dropOnNode));
console.log('\n✅ Done. Verify with: SELECT name FROM sqlite_master WHERE type="table"');
