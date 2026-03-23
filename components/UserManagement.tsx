import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

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
}

interface Props {
  onBack: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  consultor: 'Consultor',
  viewer: 'Cliente',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800',
  consultor: 'bg-blue-100 text-blue-800',
  viewer: 'bg-green-100 text-green-800',
};

export const UserManagement: React.FC<Props> = ({ onBack }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'consultor' | 'viewer'>('consultor');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Para asignar planes a cliente
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userAccess, setUserAccess] = useState<string[]>([]);
  const [savingAccess, setSavingAccess] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: usersData }, { data: plansData }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('plans').select('plan_id, hotel_name').order('hotel_name'),
    ]);
    setUsers((usersData as UserProfile[]) || []);
    setPlans((plansData as Plan[]) || []);
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
    const { data } = await supabase.from('plan_access').select('plan_id').eq('user_id', user.id);
    setUserAccess((data || []).map((r: any) => r.plan_id));
  };

  const togglePlanAccess = (planId: string) => {
    setUserAccess(prev =>
      prev.includes(planId) ? prev.filter(p => p !== planId) : [...prev, planId]
    );
  };

  const saveAccess = async () => {
    if (!selectedUser) return;
    setSavingAccess(true);

    // Borrar accesos actuales y reinsertar
    await supabase.from('plan_access').delete().eq('user_id', selectedUser.id);

    if (userAccess.length > 0) {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('plan_access').insert(
        userAccess.map(planId => ({
          plan_id: planId,
          user_id: selectedUser.id,
          granted_by: user?.id,
        }))
      );
    }

    setSavingAccess(false);
    setSelectedUser(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="text-gray-500 hover:text-gray-700">
            ← Volver
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de usuarios</h1>
        </div>

        {/* Formulario de invitación */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Invitar nuevo usuario</h2>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Nombre completo"
              value={inviteName}
              onChange={e => setInviteName(e.target.value)}
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <input
              type="email"
              placeholder="Email"
              required
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as any)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="consultor">Consultor</option>
              <option value="admin">Administrador</option>
              <option value="viewer">Cliente</option>
            </select>
            <button
              type="submit"
              disabled={inviting}
              className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {inviting ? 'Enviando...' : 'Invitar'}
            </button>
          </form>
          {inviteMsg && (
            <p className={`mt-3 text-sm ${inviteMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
              {inviteMsg.text}
            </p>
          )}
        </div>

        {/* Lista de usuarios */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-800">Usuarios ({users.length})</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400">Cargando...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3 text-left">Nombre</th>
                  <th className="px-6 py-3 text-left">Email</th>
                  <th className="px-6 py-3 text-left">Rol</th>
                  <th className="px-6 py-3 text-left">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{user.full_name || '—'}</td>
                    <td className="px-6 py-4 text-gray-600">{user.email}</td>
                    <td className="px-6 py-4">
                      <select
                        value={user.role}
                        onChange={e => handleRoleChange(user.id, e.target.value as any)}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 ${ROLE_COLORS[user.role]} cursor-pointer`}
                      >
                        <option value="admin">Administrador</option>
                        <option value="consultor">Consultor</option>
                        <option value="viewer">Cliente</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      {user.role === 'viewer' && (
                        <button
                          onClick={() => openAccessPanel(user)}
                          className="text-blue-600 hover:text-blue-800 text-xs underline"
                        >
                          Gestionar acceso a planes
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal de acceso a planes para cliente */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">
                Acceso de {selectedUser.full_name || selectedUser.email}
              </h3>
              <p className="text-sm text-gray-500 mt-1">Selecciona los planes que puede ver este cliente</p>
            </div>
            <div className="p-6 max-h-96 overflow-y-auto space-y-2">
              {plans.map(plan => (
                <label key={plan.plan_id} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded p-2">
                  <input
                    type="checkbox"
                    checked={userAccess.includes(plan.plan_id)}
                    onChange={() => togglePlanAccess(plan.plan_id)}
                    className="w-4 h-4 accent-green-600"
                  />
                  <span className="text-sm text-gray-800">{plan.hotel_name}</span>
                </label>
              ))}
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={saveAccess}
                disabled={savingAccess}
                className="px-5 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {savingAccess ? 'Guardando...' : 'Guardar acceso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
