'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { healthApi, systemApi, NODE_COLORS, NodeId } from '@/lib/api';
import { Server, RefreshCw, Loader2, Wifi, WifiOff, Zap, Database, Plus, Pencil, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

function NodeModal({ node, onClose, onSave }: { node?: any, onClose: () => void, onSave: (data: any) => void }) {
  const isEdit = !!node;
  const [form, setForm] = useState({
    id: node?.id || '',
    name: node?.name || '',
    branch: node?.branch || '',
    city: node?.city || '',
    host: node?.host || 'localhost',
    port: node?.port || 1433,
    user: node?.user || 'sa',
    password: node?.password || '',
    database: node?.database || 'QuanLyNhanSu'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto glass rounded-2xl border border-white/15 shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/90 backdrop-blur-sm z-10">
          <h3 className="text-white font-semibold">{isEdit ? 'Cấu hình Server Node' : 'Thêm Server Node mới'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Node ID (VD: cn4)</label>
              <input name="id" value={form.id} onChange={handleChange} disabled={isEdit} className="input-field disabled:opacity-50" />
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Tên Server (VD: Chi nhánh Cần Thơ)</label>
              <input name="name" value={form.name} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Mã Chi Nhánh (VD: CN4)</label>
              <input name="branch" value={form.branch} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Thành phố</label>
              <input name="city" value={form.city} onChange={handleChange} className="input-field" />
            </div>
            <div className="col-span-2">
              <label className="text-white/60 text-xs mb-1.5 block">Host (IP / Domain)</label>
              <input name="host" value={form.host} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Port</label>
              <input type="number" name="port" value={form.port} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Database</label>
              <input name="database" value={form.database} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">User</label>
              <input name="user" value={form.user} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1.5 block">Password Mới (để trống nếu ko đổi)</label>
              <input type="password" name="password" value={form.password} onChange={handleChange} className="input-field" />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex gap-3 px-6 py-4 border-t border-white/10 bg-slate-900/90 backdrop-blur-sm">
          <button onClick={onClose} className="btn btn-secondary flex-1">Hủy</button>
          <button onClick={() => onSave({ ...form, port: Number(form.port) })} className="btn btn-primary flex-1">
            Lưu Node Config
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SystemPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editNode, setEditNode] = useState<any>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['health'],
    queryFn: () => healthApi.check().then(r => r.data.data!),
    refetchInterval: 10000,
  });

  const { data: nodesData } = useQuery({
    queryKey: ['systemNodes'],
    queryFn: () => systemApi.getNodes().then(r => r.data.data),
  });

  const reconnectMut = useMutation({
    mutationFn: (nodeId: string) => healthApi.reconnect(nodeId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['health'] }); refetch(); },
  });

  const saveMut = useMutation({
    mutationFn: (node: any) => node.isEdit ? systemApi.updateNode(node.id, node) : systemApi.addNode(node),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health'] });
      qc.invalidateQueries({ queryKey: ['systemNodes'] });
      setShowModal(false);
      setEditNode(null);
    }
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => systemApi.deleteNode(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health'] });
      qc.invalidateQueries({ queryKey: ['systemNodes'] });
    }
  });

  const healthNodes = data?.nodes ?? [];
  const systemNodes = nodesData ? Object.values(nodesData) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Server className="h-6 w-6 text-slate-400" /> Hệ Thống Phân Tán
          </h1>
          <p className="text-white/50 text-sm mt-0.5">Giám sát và quản lý trạng thái các máy chủ Database tĩnh & động</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
            Refresh
          </button>
          <button onClick={() => setShowModal(true)} className="btn btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" /> Thêm Server Mới
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center h-40 items-center">
          <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="glass p-5 text-center">
              <p className="text-white text-4xl font-bold">{data?.summary.online}</p>
              <p className="text-green-400 text-sm mt-1 flex items-center justify-center gap-1">
                <Wifi className="h-3.5 w-3.5" /> Online
              </p>
            </div>
            <div className="glass p-5 text-center">
              <p className="text-white text-4xl font-bold">{data?.summary.offline}</p>
              <p className="text-red-400 text-sm mt-1 flex items-center justify-center gap-1">
                <WifiOff className="h-3.5 w-3.5" /> Offline
              </p>
            </div>
            <div className="glass p-5 text-center">
              <p className="text-white text-2xl font-bold font-mono">{data?.summary.queryMode}</p>
              <p className="text-white/40 text-sm mt-1 flex items-center justify-center gap-1">
                <Database className="h-3.5 w-3.5" /> Query Mode
              </p>
            </div>
          </div>

          {/* Node cards */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {systemNodes.map((n: any) => {
              const node = n.info;
              const isOnline = n.status === 'online';
              const isMaster = node.id === 'master';
              // Check latency from health API
              const hNode = healthNodes.find((hn: any) => hn.id === node.id);
              const latencyMs = hNode?.latencyMs;

              // Generate color statically from nodeId hash, or from predefined map
              const color = NODE_COLORS[node.id as NodeId] || `hsl(${Array.from(node.id as string).reduce((s, c: any) => s + c.charCodeAt(0), 0) * 137 % 360}, 70%, 60%)`;

              return (
                <div
                  key={node.id}
                  className={cn(
                    'glass p-6 border transition-all duration-300 relative group',
                    isOnline ? 'border-white/10 hover:border-white/20' : 'border-red-500/30 bg-red-500/5'
                  )}
                >
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-slate-900/80 p-1 rounded-lg backdrop-blur z-10 border border-white/10">
                    <button
                      onClick={() => setEditNode(node)}
                      className="p-1.5 rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                      title="Sửa Config"
                    >
                      <Pencil size={14} />
                    </button>
                    {!isMaster && (
                      <button
                        onClick={() => { if (confirm(`Bạn có chắc muốn xóa cấu hình Server ${node.id}?`)) deleteMut.mutate(node.id); }}
                        className="p-1.5 rounded-md hover:bg-red-500/20 text-red-400/70 hover:text-red-400 transition-colors"
                        title="Xóa Config"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                          style={{ backgroundColor: `${color}20`, border: `2px solid ${color}40` }}>
                          <Server className="h-5 w-5" style={{ color }} />
                        </div>
                        <span className={cn(
                          'absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-slate-950',
                          isOnline ? 'bg-green-400' : 'bg-red-400'
                        )} />
                        {isOnline && (
                          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-400 animate-ping" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-white font-semibold flex items-center gap-2">
                          {node.name} {isMaster && <span className="px-1.5 py-0.5 rounded text-[9px] bg-indigo-500/20 text-indigo-300 font-mono">MASTER</span>}
                        </h3>
                        <p className="text-white/40 text-xs">{node.city}</p>
                      </div>
                    </div>

                    <span className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium mr-14',
                      isOnline ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                    )}>
                      {isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-white/[0.04] rounded-lg p-3">
                      <p className="text-white/40 text-xs mb-1">Node ID & Host</p>
                      <p className="text-white font-mono font-medium">{node.id} @ {node.host}:{node.port}</p>
                    </div>
                    <div className="bg-white/[0.04] rounded-lg p-3">
                      <p className="text-white/40 text-xs mb-1">Database & User</p>
                      <p className="text-white font-mono font-medium">{node.database} (u: {node.user})</p>
                    </div>
                    <div className="bg-white/[0.04] rounded-lg p-3">
                      <p className="text-white/40 text-xs mb-1">Chi nhánh</p>
                      <p className="font-bold" style={{ color }}>{node.branch}</p>
                    </div>
                    <div className="bg-white/[0.04] rounded-lg p-3">
                      <p className="text-white/40 text-xs mb-1">Latency</p>
                      <p className="text-white font-mono flex items-center gap-1">
                        {isOnline && latencyMs != null ? (
                          <>
                            <Zap className="h-3 w-3 text-amber-400" />
                            {latencyMs}ms
                          </>
                        ) : '—'}
                      </p>
                    </div>
                  </div>

                  {!isOnline && (
                    <button
                      onClick={() => reconnectMut.mutate(node.id)}
                      disabled={reconnectMut.isPending}
                      className="mt-4 w-full btn btn-secondary justify-center text-amber-400"
                    >
                      {reconnectMut.isPending
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang kết nối...</>
                        : <><RefreshCw className="h-4 w-4" /> Thử kết nối lại</>
                      }
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {showModal && (
        <NodeModal
          onClose={() => setShowModal(false)}
          onSave={(data) => saveMut.mutate({ ...data, isEdit: false })}
        />
      )}
      {editNode && (
        <NodeModal
          node={editNode}
          onClose={() => setEditNode(null)}
          onSave={(data) => saveMut.mutate({ ...data, isEdit: true })}
        />
      )}
    </div>
  );
}
