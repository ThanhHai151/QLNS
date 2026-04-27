import fs from 'fs';
import path from 'path';
import { branchClients } from './turso.js';

async function migrate() {
  const [, , sqlFilePath, branch] = process.argv;

  if (!sqlFilePath || !branch) {
    console.error('Cách dùng: node src/db/migrate.js <duong-dan-file.sql> <ten-chi-nhanh>');
    process.exit(1);
  }

  const client = branchClients[branch];
  if (!client) {
    console.error(`Chi nhánh không hợp lệ. Các chi nhánh hỗ trợ: ${Object.keys(branchClients).join(', ')}`);
    process.exit(1);
  }

  try {
    const fullPath = path.resolve(process.cwd(), sqlFilePath);
    console.log(`Đang đọc file SQL từ: ${fullPath}`);
    
    if (!fs.existsSync(fullPath)) {
        console.error(`File không tồn tại: ${fullPath}`);
        process.exit(1);
    }
    
    const sqlContent = fs.readFileSync(fullPath, 'utf-8');
    
    // Tách các câu lệnh theo dấu ;
    // Loại bỏ các câu lệnh rỗng
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    console.log(`Tìm thấy ${statements.length} câu lệnh SQL. Bắt đầu chạy trên chi nhánh [${branch}]...`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        await client.execute(stmt);
        console.log(`[Thành công] Lệnh ${i + 1}/${statements.length}`);
      } catch (err) {
        console.error(`[Lỗi] Lệnh ${i + 1}/${statements.length}:`, err.message);
        console.error(`  Câu lệnh: ${stmt.substring(0, 100)}...`);
      }
    }

    console.log(`Hoàn thành chạy script trên chi nhánh [${branch}].`);
    process.exit(0);
  } catch (error) {
    console.error('Lỗi không mong muốn:', error);
    process.exit(1);
  }
}

migrate();
