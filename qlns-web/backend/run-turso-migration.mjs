import { createClient } from '@libsql/client';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const nodes = [
  { name: 'master', url: process.env.TURSO_MASTER_URL, token: process.env.TURSO_MASTER_TOKEN },
  { name: 'cn1', url: process.env.TURSO_HANOI_URL, token: process.env.TURSO_HANOI_TOKEN },
  { name: 'cn2', url: process.env.TURSO_DANANG_URL, token: process.env.TURSO_DANANG_TOKEN },
  { name: 'cn3', url: process.env.TURSO_HCM_URL, token: process.env.TURSO_HCM_TOKEN },
];

async function migrate() {
  const sqlContent = fs.readFileSync(path.resolve(process.cwd(), '../../turso_schema.sql'), 'utf-8');
  const statements = sqlContent.split(';').map(s => s.trim()).filter(s => s.length > 0);

  for (const node of nodes) {
    if (!node.url || !node.token) {
      console.log(`Skipping ${node.name} - missing URL or Token`);
      continue;
    }
    console.log(`\nMigrating on ${node.name}...`);
    const client = createClient({ url: node.url, authToken: node.token });
    
    for (let i = 0; i < statements.length; i++) {
      try {
        await client.execute(statements[i]);
      } catch (err) {
        console.error(`[Error] Node ${node.name} - Statement ${i+1}: ${err.message}`);
        console.error(statements[i]);
      }
    }
    console.log(`Completed ${node.name}.`);
  }
}

migrate().catch(console.error);
