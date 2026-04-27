'use client';

import { NodeId, NODE_COLORS, NODE_LABELS } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Database, Zap } from 'lucide-react';

interface QueryBadgeProps {
  nodes: NodeId[];
  executionTimeMs?: number;
  queryMode?: string;
  className?: string;
}

export function QueryBadge({ nodes, executionTimeMs, queryMode, className }: QueryBadgeProps) {
  if (!nodes || nodes.length === 0) return null;

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      {/* Source nodes */}
      <div className="flex items-center gap-1.5">
        <Database className="h-3.5 w-3.5 text-white/40" />
        <div className="flex gap-1">
          {nodes.map((n) => (
            <span
              key={n}
              className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono"
              style={{ backgroundColor: `${NODE_COLORS[n]}25`, color: NODE_COLORS[n], border: `1px solid ${NODE_COLORS[n]}40` }}
            >
              {NODE_LABELS[n]}
            </span>
          ))}
        </div>
      </div>

      {/* Execution time */}
      {executionTimeMs !== undefined && (
        <div className="flex items-center gap-1 text-white/30 text-[10px]">
          <Zap className="h-3 w-3" />
          <span>{executionTimeMs}ms</span>
        </div>
      )}

      {/* Query mode */}
      {queryMode && (
        <span className="px-1.5 py-0.5 rounded bg-white/5 text-white/30 text-[10px] font-mono border border-white/10">
          {queryMode}
        </span>
      )}
    </div>
  );
}

// ── Simple node color indicator ──────────────────────────────
export function NodeIndicator({ nodeId, label }: { nodeId?: NodeId; label?: string }) {
  if (!nodeId) return null;
  const color = NODE_COLORS[nodeId];
  const text = label || NODE_LABELS[nodeId];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
      style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}30` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {text}
    </span>
  );
}
