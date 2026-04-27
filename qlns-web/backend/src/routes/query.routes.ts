import { FastifyInstance } from 'fastify';
import { db, NodeId } from '../config/database';

export async function queryRoutes(app: FastifyInstance) {
  app.post<{
    Body: { sql: string; node?: string }
  }>('/', async (req, reply) => {
    const start = Date.now();
    const { sql: sqlText, node = 'master' } = req.body;

    if (!sqlText || !sqlText.trim()) {
      return reply.status(400).send({ success: false, error: 'SQL query is required' });
    }

    const nodeId = node as NodeId;
    const validNodes: NodeId[] = ['master', 'cn1', 'cn2', 'cn3'];
    if (!validNodes.includes(nodeId)) {
      return reply.status(400).send({ success: false, error: `Invalid node. Use: ${validNodes.join(', ')}` });
    }

    const allowDDL = process.env.ALLOW_DDL === 'true';
    const strippedSql = sqlText.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim().toUpperCase();
    const allowedPrefixes = allowDDL
      ? ['SELECT', 'WITH', 'EXEC', 'EXECUTE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'PRAGMA']
      : ['SELECT', 'WITH', 'EXEC', 'EXECUTE', 'INSERT', 'UPDATE', 'DELETE', 'PRAGMA'];

    if (!allowedPrefixes.some(p => strippedSql.startsWith(p))) {
      return reply.status(400).send({
        success: false,
        error: `Chỉ cho phép lệnh: ${allowedPrefixes.join(', ')}`,
        suggestions: ['Viết câu truy vấn bắt đầu bằng SELECT hoặc WITH'],
        errorLine: 1,
      });
    }

    try {
      const client = await db.getPoolOrThrow(nodeId);
      const result = await client.execute(sqlText);

      return reply.send({
        success: true,
        data: {
          columns: result.columns,
          rows: result.rows,
          rowCount: result.rows.length,
          node: nodeId,
          nodeInfo: db.nodes[nodeId],
        },
        meta: {
          executionTimeMs: Date.now() - start,
          sourceNodes: [nodeId],
          queryMode: process.env.QUERY_MODE || 'direct',
        },
      });
    } catch (err) {
      return reply.status(422).send({
        success: false,
        error: (err as Error).message,
        errorLine: null,
        suggestions: [],
        node: nodeId,
      });
    }
  });
}

export async function schemaRoutes(app: FastifyInstance) {
  app.get<{ Params: { nodeId: string } }>('/:nodeId', async (req, reply) => {
    const start = Date.now();
    const nodeId = req.params.nodeId as NodeId;
    const validNodes: NodeId[] = ['master', 'cn1', 'cn2', 'cn3'];

    if (!validNodes.includes(nodeId)) {
      return reply.status(400).send({ success: false, error: 'Invalid node ID' });
    }

    try {
      const client = await db.getPoolOrThrow(nodeId);
      
      const tablesResult = await client.execute(`
        SELECT name AS TABLE_NAME, type AS TABLE_TYPE 
        FROM sqlite_schema 
        WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `);
      
      const tablesMap: Record<string, { type: string; columns: any[] }> = {};
      
      for (const row of tablesResult.rows) {
        const tableName = String(row.TABLE_NAME);
        tablesMap[tableName] = { type: String(row.TABLE_TYPE) === 'table' ? 'BASE TABLE' : 'VIEW', columns: [] };
        
        const colResult = await client.execute(`PRAGMA table_info('${tableName}')`);
        for (const col of colResult.rows) {
            tablesMap[tableName].columns.push({
                name: col.name,
                type: col.type,
                maxLength: null,
                nullable: col.notnull === 0,
                default: col.dflt_value,
                position: col.cid,
            });
        }
      }

      const tables = Object.entries(tablesMap).map(([name, info]) => ({
        name,
        type: info.type,
        columns: info.columns,
      }));

      return reply.send({
        success: true,
        data: {
          node: nodeId,
          nodeInfo: db.nodes[nodeId],
          tables,
          tableCount: tables.filter(t => t.type === 'BASE TABLE').length,
          viewCount: tables.filter(t => t.type === 'VIEW').length,
        },
        meta: { executionTimeMs: Date.now() - start, sourceNodes: [nodeId] },
      });
    } catch (err) {
      return reply.status(500).send({ success: false, error: (err as Error).message });
    }
  });
}
