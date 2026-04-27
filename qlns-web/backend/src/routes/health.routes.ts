import { FastifyInstance } from 'fastify';
import { db } from '../config/database';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const start = Date.now();
    const statusMap = db.getStatus();
    
    const nodes = await Promise.all(
      Object.entries(statusMap).map(async ([id, info]) => {
        let latencyMs: number | null = null;
        if (info.status === 'online') {
          const t0 = Date.now();
          try {
            const client = db.getPool(id);
            if (client) await client.execute('SELECT 1 AS ping');
            latencyMs = Date.now() - t0;
          } catch { latencyMs = null; }
        }
        return {
          ...info.info,
          status: info.status,
          latencyMs,
        };
      })
    );

    const onlineCount = nodes.filter(n => n.status === 'online').length;

    return reply.send({
      success: true,
      data: {
        nodes,
        summary: {
          total: nodes.length,
          online: onlineCount,
          offline: nodes.length - onlineCount,
          queryMode: process.env.QUERY_MODE || 'direct',
        },
      },
      meta: { executionTimeMs: Date.now() - start, sourceNodes: [], queryMode: process.env.QUERY_MODE as any },
    });
  });

  app.post<{ Params: { nodeId: string } }>('/reconnect/:nodeId', async (req, reply) => {
    const { nodeId } = req.params;
    if (!db.nodes[nodeId]) {
      return reply.status(400).send({ success: false, error: 'Invalid node ID' });
    }
    await db.connectNode(nodeId);
    const status = db.getStatus();
    return reply.send({
      success: true,
      data: { nodeId, status: (status as any)[nodeId]?.status },
    });
  });
}
