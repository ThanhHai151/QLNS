'use client';

import { useQuery } from '@tanstack/react-query';
import { healthApi, NodeStatus, NODE_COLORS, NodeId } from '@/lib/api';
import { cn } from '@/lib/utils';
import { RefreshCw, Server, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useState } from 'react';

function NodeBadge({ node }: { node: NodeStatus }) {
  const [reconnecting, setReconnecting] = useState(false);

  const handleReconnect = async () => {
    setReconnecting(true);
    try {
      await healthApi.reconnect(node.id);
    } finally {
      setReconnecting(false);
    }
  };

  const color = NODE_COLORS[node.id as NodeId];
  const isOnline = node.status === 'online';

  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-300',
        isOnline
          ? 'bg-white/10 border-white/20 hover:bg-white/15'
          : 'bg-red-500/10 border-red-500/30 hover:bg-red-500/15'
      )}
      title={`${node.name} — Port ${node.port}${node.latencyMs ? ` — ${node.latencyMs}ms` : ''}`}
    >
      {/* Status dot */}
      <span
        className={cn(
          'relative flex h-2 w-2 rounded-full',
          isOnline ? 'bg-green-400' : 'bg-red-400'
        )}
      >
        {isOnline && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
        )}
      </span>

      {/* Node label */}
      <span className="text-white/90">
        <span style={{ color }} className="font-bold">{node.branch === 'ALL' ? 'MST' : node.branch}</span>
        <span className="text-white/50 ml-1">{node.city.split(' ')[node.city.split(' ').length - 1]}</span>
      </span>

      {/* Latency */}
      {isOnline && node.latencyMs != null && (
        <span className="text-white/40 font-mono">{node.latencyMs}ms</span>
      )}

      {/* Reconnect button when offline */}
      {!isOnline && (
        <button
          onClick={handleReconnect}
          disabled={reconnecting}
          className="ml-1 opacity-0 group-hover:opacity-100 text-red-300 hover:text-white transition-opacity"
        >
          {reconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </button>
      )}
    </div>
  );
}

export function ServerStatusBar() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['health'],
    queryFn: () => healthApi.check().then((r) => r.data.data!),
    refetchInterval: 15000,
    retry: false,
  });

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-white/5 backdrop-blur-sm border-b border-white/10">
      {/* Icon */}
      <div className="flex items-center gap-1.5 text-white/50 text-xs">
        <Server className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Distributed Nodes</span>
      </div>

      {/* Separator */}
      <div className="h-4 w-px bg-white/20" />

      {/* Node badges */}
      {isLoading ? (
        <div className="flex gap-2">
          {['master', 'cn1', 'cn2', 'cn3'].map((n) => (
            <div key={n} className="h-6 w-20 rounded-full bg-white/10 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          {data?.nodes.map((node) => (
            <NodeBadge key={node.id} node={node} />
          ))}
        </div>
      )}

      {/* Summary */}
      {data && (
        <>
          <div className="hidden md:flex items-center gap-1.5 ml-auto text-xs text-white/40">
            {data.summary.online > 0 ? (
              <Wifi className="h-3.5 w-3.5 text-green-400" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-red-400" />
            )}
            <span>
              {data.summary.online}/{data.summary.total} online
            </span>
            <span className="ml-2 px-1.5 py-0.5 rounded bg-white/10 font-mono">
              {data.summary.queryMode}
            </span>
          </div>

          <button
            onClick={() => refetch()}
            className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
            title="Refresh node status"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </>
      )}
    </div>
  );
}
