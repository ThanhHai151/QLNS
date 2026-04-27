import { createClient } from '@libsql/client';
import 'dotenv/config';

export const masterDb = createClient({
  url: process.env.TURSO_MASTER_URL,
  authToken: process.env.TURSO_MASTER_TOKEN,
});

export const hanoiDb = createClient({
  url: process.env.TURSO_HANOI_URL,
  authToken: process.env.TURSO_HANOI_TOKEN,
});

export const danangDb = createClient({
  url: process.env.TURSO_DANANG_URL,
  authToken: process.env.TURSO_DANANG_TOKEN,
});

export const hcmDb = createClient({
  url: process.env.TURSO_HCM_URL,
  authToken: process.env.TURSO_HCM_TOKEN,
});

// Map tên chi nhánh -> client tương ứng
export const branchClients = {
  master: masterDb,
  hanoi: hanoiDb,
  danang: danangDb,
  hcm: hcmDb,
};
