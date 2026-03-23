import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { ArrowLeft, Users, Shield, Briefcase, Plus, Pencil, Trash2, Check, X, Search } from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'consultor' | 'viewer';
  active: boolean;
  created_at: string;
}

interface Plan {
  plan_id: string;
  hotel_name: string;
  consultor: string | null;
}

interface Props {
  onBack: () => void;
}

const ROLE_CONFIG = {
  admin:     { label: 'Administrador', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Shield },
  consultor: { label: 'Consultor',     color: 'bg-blue-100 text-blue-700 border-blue-200',       icon: Briefcase },
  viewer:    { label: 'Cliente',        color: 'bg-green-100 text-green-700 border-green-200',    icon: Users },
};

export const UserManagement: React.FC<Props> = ({ onBack }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planAccessMap, setPlanAccessMap] = useState<Record<string, string[]>>({}); // userId → [planId]
  const [loading, setLoading] = useState(true);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'consultor' | 'viewer'>('viewer');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Access modal
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userAccess, setUserAccess] = useState<string[]>([]);
  const [savingAccess, setSavingAccess] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<'clientes' | 'equipo'>('clientes');

  // Search / filter
  const [search, setSearch] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: usersData }, { data: plansData }, { data: accessData }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('plans').select('plan_id, hotel_name, consultor').order('hotel_name'),
      supabase.from('plan_access').select('user_id, plan_id'),
    ]);
    setUsers((usersData as UserProfile[]) || []);
    setPlans((plansData as Plan[]) || []);

    // Build access map: userId → [planId]
    const map: Record<string, string[]> = {};
    for (const row of (accessData || []) as any[]) {
      if (!map[row.user_id]) map[row.user_id] = [];
      map[row.user_id].push(row.plan_id);
    }
    setPlanAccessMap(map);
    setLoading(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setInviteMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), full_name: inviteName.trim(), role: inviteRole }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setInviteMsg({ type: 'ok', text: `Invitación enviada a ${inviteEmail}` });
      setInviteEmail('');
      setInviteName('');
      fetchData();
    } catch (err: any) {
      setInviteMsg({ type: 'err', text: err.message });
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'consultor' | 'viewer') => {
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
  };

  const openAccessPanel = async (user: UserProfile) => {
    setSelectedUser(user);
    setUserAccess(planAccessMap[user.id] || []);
  };

  const saveAccess = async () => {
    if (!selectedUser) return;
    setSavingAccess(true);
    await supabase.from('plan_access').delete().eq('user_id', selectedUser.id);
    if (userAccess.length > 0) {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('plan_access').insert(
        userAccess.map(planId => ({ plan_id: planId, user_id: selectedUser.id, granted_by: user?.id }))
      );
    }
    setPlanAccessMap(prev => ({ ...prev, [selectedUser.id]: userAccess }));
    setSavingAccess(false);
    setSelectedUser(null);
  };

  const q = search.toLowerCase().trim();
  const clients   = users.filter(u => u.role === 'viewer' && (
    !q || u.full_name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  ));
  const teamUsers = users.filter(u => u.role !== 'viewer' && (
    !q || u.full_name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  ));

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft size={18} /> Volver
        </button>
        <div className="h-5 w-px bg-slate-200" />
        <h1 className="text-lg font-black text-slate-900">Gestión de usuarios</h1>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Invite form */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-4">Invitar nuevo usuario</h2>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
            <input type="text" placeholder="Nombre completo" value={inviteName}
              onChange={e => setInviteName(e.target.value)}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            <input type="email" placeholder="Email" required value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value as any)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="viewer">Cliente</option>
              <option value="consultor">Consultor</option>
              <option value="admin">Administrador</option>
            </select>
            <button type="submit" disabled={inviting}
              className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
              <Plus size={16} /> {inviting ? 'Enviando...' : 'Invitar'}
            </button>
          </form>
          {inviteMsg && (
            <p className={`mt-3 text-sm ${inviteMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{inviteMsg.text}</p>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-slate-200">
          {(['clientes', 'equipo'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-bold uppercase tracking-wider transition-all rounded-t-lg ${
                activeTab === tab
                  ? 'bg-white border border-b-white border-slate-200 text-green-600 -mb-px'
                  : 'text-slate-400 hover:text-slate-600'
              }`}>
              {tab === 'clientes' ? `Clientes (${clients.length})` : `Equipo (${teamUsers.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Cargando...</div>
        ) : activeTab === 'clientes' ? (
          /* CLIENTES */
          <div className="space-y-3">
            {clients.length === 0 ? (
              <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200">
                <Users size={32} className="mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No hay clientes registrados todavía.</p>
              </div>
            ) : clients.map(client => {
              const assignedPlanIds = planAccessMap[client.id] || [];
              const assignedPlans = plans.filter(p => assignedPlanIds.includes(p.plan_id));
              return (
                <div key={client.id} className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-bold text-slate-900">{client.full_name || client.email}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ROLE_CONFIG.viewer.color}`}>Cliente</span>
                      </div>
                      <p className="text-xs text-slate-400 mb-3">{client.email}</p>
                      {/* Planes asignados */}
                      <div className="flex flex-wrap gap-2">
                        {assignedPlans.length === 0 ? (
                          <span className="text-xs text-slate-400 italic">Sin planes asignados</span>
                        ) : assignedPlans.map(p => (
                          <span key={p.plan_id} className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">
                            {p.hotel_name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => openAccessPanel(client)}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:border-green-400 hover:text-green-700 transition-all">
                      <Pencil size={13} /> Editar acceso
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* EQUIPO */
          <div className="space-y-3">
            {teamUsers.length === 0 ? (
              <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200">
                <Briefcase size={32} className="mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No hay miembros de equipo registrados.</p>
              </div>
            ) : teamUsers.map(user => {
              const userPlans = plans.filter(p => p.consultor === user.email);
              const RoleIcon = ROLE_CONFIG[user.role]?.icon || Users;
              return (
                <div key={user.id} className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-bold text-slate-900">{user.full_name || user.email}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ROLE_CONFIG[user.role]?.color}`}>
                          {ROLE_CONFIG[user.role]?.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mb-3">{user.email}</p>
                      {/* Planes asignados */}
                      <div className="flex flex-wrap gap-2">
                        {userPlans.length === 0 ? (
                          <span className="text-xs text-slate-400 italic">Sin planes asignados</span>
                        ) : userPlans.map(p => (
                          <span key={p.plan_id} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                            {p.hotel_name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <select value={user.role} onChange={e => handleRoleChange(user.id, e.target.value as any)}
                      className={`text-xs font-bold px-2 py-1 rounded-full border cursor-pointer ${ROLE_CONFIG[user.role]?.color}`}>
                      <option value="admin">Administrador</option>
                      <option value="consultor">Consultor</option>
                      <option value="viewer">Cliente</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal asignación de planes */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-slate-800">Planes de {selectedUser.full_name || selectedUser.email}</h3>
              <p className="text-sm text-slate-500 mt-1">Marca los planes a los que tiene acceso este cliente.</p>
            </div>
            <div className="p-6 max-h-80 overflow-y-auto space-y-2">
              {plans.length === 0 ? (
                <p className="text-sm text-slate-400">No hay planes disponibles.</p>
              ) : plans.map(plan => (
                <label key={plan.plan_id} className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 rounded-lg p-2">
                  <input type="checkbox" checked={userAccess.includes(plan.plan_id)}
                    onChange={() => setUserAccess(prev =>
                      prev.includes(plan.plan_id) ? prev.filter(p => p !== plan.plan_id) : [...prev, plan.plan_id]
                    )}
                    className="w-4 h-4 accent-green-600" />
                  <span className="text-sm text-slate-800">{plan.hotel_name}</span>
                </label>
              ))}
            </div>
            <div className="p-6 border-t flex items-center justify-between">
              <span className="text-xs text-slate-400">{userAccess.length} plan{userAccess.length !== 1 ? 'es' : ''} seleccionado{userAccess.length !== 1 ? 's' : ''}</span>
              <div className="flex gap-3">
                <button onClick={() => setSelectedUser(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 flex items-center gap-1">
                  <X size={14} /> Cancelar
                </button>
                <button onClick={saveAccess} disabled={savingAccess}
                  className="px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1">
                  <Check size={14} /> {savingAccess ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
