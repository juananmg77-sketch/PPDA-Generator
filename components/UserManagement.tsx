import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { ArrowLeft, Users, Shield, Briefcase, Plus, Pencil, Check, X, Search, Copy, KeyRound, CheckCheck, Eye, EyeOff, Trash2, AlertTriangle } from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'consultor' | 'viewer' | 'operador';
  active: boolean;
  created_at: string;
}

interface Plan {
  plan_id: string;
  hotel_name: string;
  consultor: string | null;
}

interface CreatedCredentials {
  email: string;
  password: string;
  fullName: string;
  role: string;
}

interface Props {
  onBack: () => void;
}

const ROLE_CONFIG = {
  admin:     { label: 'Administrador', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Shield },
  consultor: { label: 'Consultor',     color: 'bg-blue-100 text-blue-700 border-blue-200',       icon: Briefcase },
  viewer:    { label: 'Cliente',       color: 'bg-green-100 text-green-700 border-green-200',    icon: Users },
  operador:  { label: 'Operador',      color: 'bg-amber-100 text-amber-700 border-amber-200',    icon: Users },
};

export const UserManagement: React.FC<Props> = ({ onBack }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planAccessMap, setPlanAccessMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'consultor' | 'viewer'>('viewer');
  const [invitePassword, setInvitePassword] = useState('');
  const [showInvitePwd, setShowInvitePwd] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteErr, setInviteErr] = useState<string | null>(null);

  // Credentials modal (shown after successful invite)
  const [createdCreds, setCreatedCreds] = useState<CreatedCredentials | null>(null);
  const [copied, setCopied] = useState(false);

  // Access modal
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userAccess, setUserAccess] = useState<string[]>([]);
  const [savingAccess, setSavingAccess] = useState(false);

  const [roleChangeErr, setRoleChangeErr] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'clientes' | 'equipo'>('clientes');
  const [search, setSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

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
    if (invitePassword.length < 8) { setInviteErr('La contraseña debe tener al menos 8 caracteres.'); return; }
    setInviting(true);
    setInviteErr(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('invite-user', {
        body: {
          email: inviteEmail.trim().toLowerCase(),
          full_name: inviteName.trim(),
          role: inviteRole,
          password: invitePassword,
        },
      });
      if (fnError) throw new Error(fnError.message);
      if (result?.error) throw new Error(result.error);

      setCreatedCreds({
        email: inviteEmail.trim().toLowerCase(),
        password: invitePassword,
        fullName: inviteName.trim() || inviteEmail,
        role: inviteRole,
      });
      setInviteEmail('');
      setInviteName('');
      setInvitePassword('');
      setTimeout(() => fetchData(), 800);
    } catch (err: any) {
      setInviteErr(err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdCreds) return;
    const roleLabel = ROLE_CONFIG[createdCreds.role as keyof typeof ROLE_CONFIG]?.label || createdCreds.role;
    const text =
      `🌱 Acceso a HS Green — Planes de Desperdicio Alimentario\n\n` +
      `Hola ${createdCreds.fullName},\n\n` +
      `Se ha creado tu acceso como ${roleLabel}.\n\n` +
      `🔗 App: https://ppdagenerator.netlify.app\n` +
      `📧 Usuario: ${createdCreds.email}\n` +
      `🔑 Contraseña temporal: ${createdCreds.password}\n\n` +
      `⚠️ Por seguridad, cámbiala en tu primer acceso desde el menú superior.`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'consultor' | 'viewer') => {
    setRoleChangeErr(null);
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) { setRoleChangeErr(`Error al cambiar rol: ${error.message}`); return; }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
  };

  const handleDeleteUser = async (userId: string) => {
    setDeleting(true);
    setDeleteErr(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('delete-user', {
        body: { user_id: userId },
      });
      if (fnError) throw new Error(fnError.message);
      if (result?.error) throw new Error(result.error);
      setUsers(prev => prev.filter(u => u.id !== userId));
      setConfirmDeleteId(null);
    } catch (err: any) {
      setDeleteErr(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const openAccessPanel = (user: UserProfile) => {
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
  const clients   = users.filter(u => (u.role === 'viewer' || u.role === 'operador') && (!q || u.full_name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));
  const teamUsers = users.filter(u => u.role !== 'viewer' && u.role !== 'operador' && (!q || u.full_name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));

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
          <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-1">Crear nuevo acceso</h2>
          <p className="text-xs text-slate-400 mb-4">Asigna tú mismo la contraseña inicial y compártela con el usuario.</p>
          <form onSubmit={handleInvite} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <input type="text" placeholder="Nombre completo" value={inviteName}
                onChange={e => setInviteName(e.target.value)}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <input type="email" placeholder="Email" required value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value as any)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="viewer">Cliente</option>
                <option value="operador">Operador</option>
                <option value="consultor">Consultor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <input
                  type={showInvitePwd ? 'text' : 'password'}
                  placeholder="Contraseña inicial (mín. 8 caracteres)"
                  required
                  value={invitePassword}
                  onChange={e => setInvitePassword(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm pr-9 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button type="button" onClick={() => setShowInvitePwd(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showInvitePwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <button type="submit" disabled={inviting}
                className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap">
                <Plus size={16} /> {inviting ? 'Creando...' : 'Crear acceso'}
              </button>
            </div>
          </form>
          {inviteErr && <p className="mt-3 text-sm text-red-600">{inviteErr}</p>}
        </div>

        {/* Search + Tabs */}
        <div className="relative mb-5">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input type="text" placeholder="Buscar por nombre o email..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

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

        {roleChangeErr && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-center justify-between">
            <span>{roleChangeErr}</span>
            <button onClick={() => setRoleChangeErr(null)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-400">Cargando...</div>
        ) : activeTab === 'clientes' ? (
          <div className="space-y-3">
            {clients.length === 0 ? (
              <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200">
                <Users size={32} className="mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No hay clientes registrados todavía.</p>
              </div>
            ) : clients.map(client => {
              const assignedPlanIds = planAccessMap[client.id] || [];
              const assignedPlans = plans.filter(p => assignedPlanIds.includes(p.plan_id));
              const isConfirmingDelete = confirmDeleteId === client.id;
              return (
                <div key={client.id} className={`bg-white rounded-xl border p-5 transition-all ${isConfirmingDelete ? 'border-red-300 bg-red-50/30' : 'border-slate-200'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-bold text-slate-900">{client.full_name || client.email}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ROLE_CONFIG.viewer.color}`}>Cliente</span>
                      </div>
                      <p className="text-xs text-slate-400 mb-3">{client.email}</p>
                      <div className="flex flex-wrap gap-2">
                        {assignedPlans.length === 0
                          ? <span className="text-xs text-slate-400 italic">Sin planes asignados</span>
                          : assignedPlans.map(p => (
                            <span key={p.plan_id} className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">
                              {p.hotel_name}
                            </span>
                          ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!isConfirmingDelete ? (
                        <>
                          {/* Cambiar rol */}
                          <select
                            value={client.role}
                            onChange={e => handleRoleChange(client.id, e.target.value as any)}
                            className="text-xs font-bold px-2 py-1.5 rounded-lg border border-slate-200 text-slate-600 cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                            title="Cambiar rol"
                          >
                            <option value="viewer">Cliente</option>
                            <option value="operador">Operador</option>
                            <option value="consultor">Consultor</option>
                            <option value="admin">Administrador</option>
                          </select>
                          {/* Editar acceso */}
                          <button onClick={() => openAccessPanel(client)}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:border-green-400 hover:text-green-700 transition-all">
                            <Pencil size={13} /> Acceso
                          </button>
                          {/* Eliminar */}
                          <button onClick={() => { setConfirmDeleteId(client.id); setDeleteErr(null); }}
                            className="p-1.5 border border-slate-200 rounded-lg text-slate-400 hover:text-red-500 hover:border-red-300 transition-all">
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 text-xs font-bold text-red-600">
                            <AlertTriangle size={13} /> ¿Eliminar?
                          </span>
                          <button onClick={() => handleDeleteUser(client.id)} disabled={deleting}
                            className="px-3 py-1.5 bg-red-600 text-white text-xs font-black rounded-lg hover:bg-red-700 disabled:opacity-50 transition-all">
                            {deleting ? 'Eliminando...' : 'Confirmar'}
                          </button>
                          <button onClick={() => setConfirmDeleteId(null)}
                            className="px-3 py-1.5 border border-slate-200 text-xs font-semibold text-slate-600 rounded-lg hover:bg-slate-50">
                            Cancelar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {isConfirmingDelete && deleteErr && (
                    <p className="mt-2 text-xs text-red-600 font-medium">{deleteErr}</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {teamUsers.length === 0 ? (
              <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200">
                <Briefcase size={32} className="mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No hay miembros de equipo registrados.</p>
              </div>
            ) : teamUsers.map(user => {
              const userPlans = plans.filter(p => p.consultor === user.email);
              const isConfirmingDelete = confirmDeleteId === user.id;
              return (
                <div key={user.id} className={`bg-white rounded-xl border p-5 transition-all ${isConfirmingDelete ? 'border-red-300 bg-red-50/30' : 'border-slate-200'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-bold text-slate-900">{user.full_name || user.email}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ROLE_CONFIG[user.role]?.color}`}>
                          {ROLE_CONFIG[user.role]?.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mb-3">{user.email}</p>
                      <div className="flex flex-wrap gap-2">
                        {userPlans.length === 0
                          ? <span className="text-xs text-slate-400 italic">Sin planes asignados</span>
                          : userPlans.map(p => (
                            <span key={p.plan_id} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                              {p.hotel_name}
                            </span>
                          ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!isConfirmingDelete ? (
                        <>
                          <select value={user.role} onChange={e => handleRoleChange(user.id, e.target.value as any)}
                            className={`text-xs font-bold px-2 py-1.5 rounded-lg border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 ${ROLE_CONFIG[user.role]?.color}`}>
                            <option value="admin">Administrador</option>
                            <option value="consultor">Consultor</option>
                            <option value="operador">Operador</option>
                            <option value="viewer">Cliente</option>
                          </select>
                          <button onClick={() => { setConfirmDeleteId(user.id); setDeleteErr(null); }}
                            className="p-1.5 border border-slate-200 rounded-lg text-slate-400 hover:text-red-500 hover:border-red-300 transition-all">
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 text-xs font-bold text-red-600">
                            <AlertTriangle size={13} /> ¿Eliminar?
                          </span>
                          <button onClick={() => handleDeleteUser(user.id)} disabled={deleting}
                            className="px-3 py-1.5 bg-red-600 text-white text-xs font-black rounded-lg hover:bg-red-700 disabled:opacity-50 transition-all">
                            {deleting ? 'Eliminando...' : 'Confirmar'}
                          </button>
                          <button onClick={() => setConfirmDeleteId(null)}
                            className="px-3 py-1.5 border border-slate-200 text-xs font-semibold text-slate-600 rounded-lg hover:bg-slate-50">
                            Cancelar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {isConfirmingDelete && deleteErr && (
                    <p className="mt-2 text-xs text-red-600 font-medium">{deleteErr}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── MODAL: Credenciales creadas ─────────────────────────────────── */}
      {createdCreds && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

            {/* Header */}
            <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-t-2xl p-6 text-white text-center">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <KeyRound size={22} />
              </div>
              <h3 className="text-lg font-black">✅ Acceso creado</h3>
              <p className="text-green-100 text-sm mt-1">
                {createdCreds.fullName} · {ROLE_CONFIG[createdCreds.role as keyof typeof ROLE_CONFIG]?.label}
              </p>
            </div>

            <div className="p-6">
              {/* Credentials */}
              <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 mb-4 space-y-3">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">🔗 App</p>
                  <p className="font-mono text-sm font-bold text-blue-600">ppdagenerator.netlify.app</p>
                </div>
                <div className="border-t border-slate-200 pt-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">📧 Usuario</p>
                  <p className="font-mono text-sm font-bold text-slate-800 break-all">{createdCreds.email}</p>
                </div>
                <div className="border-t border-slate-200 pt-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">🔑 Contraseña</p>
                  <p className="font-mono text-2xl font-black text-green-600 tracking-widest">{createdCreds.password}</p>
                </div>
              </div>

              {/* Warning */}
              <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-lg px-4 py-3 mb-5 text-xs text-amber-800">
                ⚠️ Copia las credenciales <strong>antes de cerrar</strong>. La contraseña no se almacena y no podrás recuperarla.
              </div>

              {/* Actions — copy is primary */}
              <button onClick={handleCopyCredentials}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-base transition-all mb-3 ${
                  copied ? 'bg-green-600 text-white' : 'bg-green-600 hover:bg-green-700 text-white'
                }`}>
                {copied ? <><CheckCheck size={18} /> ¡Copiado! Listo para pegar en WhatsApp o email</> : <><Copy size={18} /> Copiar credenciales para compartir</>}
              </button>
              <button onClick={() => { setCreatedCreds(null); setCopied(false); }}
                className="w-full py-2.5 rounded-xl font-semibold text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Asignación de planes ─────────────────────────────────── */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold text-slate-800">Planes de {selectedUser.full_name || selectedUser.email}</h3>
              <p className="text-sm text-slate-500 mt-1">Marca los planes a los que tiene acceso este cliente.</p>
            </div>
            <div className="p-6 max-h-80 overflow-y-auto space-y-2">
              {plans.length === 0
                ? <p className="text-sm text-slate-400">No hay planes disponibles.</p>
                : plans.map(plan => (
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
