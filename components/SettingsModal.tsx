import React, { useState, useEffect } from 'react';
import { X, Save, Lock, User, AlertCircle, CheckCircle2, Plus, Trash2, Shield, UserCog, Settings, Pencil } from 'lucide-react';
import { User as UserType } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserType | null;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'users'>('profile');
  const [users, setUsers] = useState<UserType[]>([]);
  
  // State for User Form (Add/Edit)
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  
  // State for Changing Own Password
  const [myUsername, setMyUsername] = useState('');
  const [myPassword, setMyPassword] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      setError('');
      setSuccess('');
      resetUserForm();
      if (currentUser) {
          setMyUsername(currentUser.username);
          setMyPassword(currentUser.password);
      }
      setActiveTab('profile'); // Reset to profile tab on open
    }
  }, [isOpen, currentUser]);

  const loadUsers = () => {
    const usersData = localStorage.getItem('lead_app_users_v2');
    if (usersData) {
        setUsers(JSON.parse(usersData));
    }
  };

  const resetUserForm = () => {
      setFormUsername('');
      setFormPassword('');
      setEditingUserId(null);
  };

  const handleUpdateProfile = (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSuccess('');
      
      if (!myUsername || !myPassword) {
          setError("Preencha usuário e senha.");
          return;
      }
      
      const updatedUsers = users.map(u => {
          if (u.id === currentUser?.id) {
              return { ...u, username: myUsername, password: myPassword };
          }
          return u;
      });
      
      localStorage.setItem('lead_app_users_v2', JSON.stringify(updatedUsers));
      setUsers(updatedUsers);
      setSuccess("Seus dados foram atualizados com sucesso!");
      
      // Update session if username changed
      const updatedCurrentUser = { ...currentUser!, username: myUsername, password: myPassword };
      localStorage.setItem('lead_app_current_user', JSON.stringify(updatedCurrentUser));
  };

  const handleStartEdit = (user: UserType) => {
      setEditingUserId(user.id);
      setFormUsername(user.username);
      setFormPassword(user.password);
      setError('');
      setSuccess('');
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formUsername || !formPassword) {
        setError("Preencha usuário e senha.");
        return;
    }

    // Verifica duplicidade de nome (apenas se não for o próprio usuário que estamos editando)
    const nameExists = users.some(u => u.username === formUsername && u.id !== editingUserId);
    if (nameExists) {
        setError("Este nome de usuário já existe.");
        return;
    }

    let updatedUsers = [...users];

    if (editingUserId) {
        // EDITAR USUÁRIO EXISTENTE
        updatedUsers = users.map(u => {
            if (u.id === editingUserId) {
                return { ...u, username: formUsername, password: formPassword };
            }
            return u;
        });
        setSuccess(`Usuário ${formUsername} atualizado com sucesso!`);
    } else {
        // ADICIONAR NOVO USUÁRIO
        const newUser: UserType = {
            id: crypto.randomUUID(),
            username: formUsername,
            password: formPassword,
            role: 'user', 
            createdAt: Date.now()
        };
        updatedUsers.push(newUser);
        setSuccess(`Usuário ${formUsername} criado com sucesso!`);
    }

    localStorage.setItem('lead_app_users_v2', JSON.stringify(updatedUsers));
    setUsers(updatedUsers);
    resetUserForm();
  };

  const handleDeleteUser = (userId: string) => {
    if (userId === currentUser?.id) {
        setError("Você não pode excluir a si mesmo.");
        return;
    }

    if (users.length <= 1) {
        setError("Deve haver pelo menos um usuário no sistema.");
        return;
    }

    if (confirm("Tem certeza que deseja remover este usuário?")) {
        const updatedUsers = users.filter(u => u.id !== userId);
        localStorage.setItem('lead_app_users_v2', JSON.stringify(updatedUsers));
        setUsers(updatedUsers);
        
        // Se estava editando este usuário, reseta o formulário
        if (editingUserId === userId) {
            resetUserForm();
        }
        
        setSuccess("Usuário removido.");
    }
  };

  if (!isOpen) return null;

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center shrink-0">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600" />
            Configurações
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-slate-200 bg-white">
            <button
                onClick={() => { setActiveTab('profile'); setError(''); setSuccess(''); }}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'profile' ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                <UserCog className="w-4 h-4" />
                Minha Conta
            </button>
            {isAdmin && (
                <button
                    onClick={() => { setActiveTab('users'); setError(''); setSuccess(''); resetUserForm(); }}
                    className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'users' ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <Shield className="w-4 h-4" />
                    Gerenciar Usuários (Admin)
                </button>
            )}
        </div>

        <div className="p-6 overflow-y-auto">
            {error && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center gap-2 border border-red-100 mb-4">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
                </div>
            )}
            
            {success && (
                <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2 border border-green-200 mb-4">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {success}
                </div>
            )}

            {activeTab === 'profile' && (
                <div className="space-y-4 max-w-md mx-auto">
                    <p className="text-sm text-slate-500 mb-4">Atualize seus dados de acesso abaixo.</p>
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase">Meu Usuário</label>
                            <div className="relative">
                                <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={myUsername}
                                    onChange={(e) => setMyUsername(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase">Minha Senha</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                <input
                                    type="text" 
                                    value={myPassword}
                                    onChange={(e) => setMyPassword(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm font-mono"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-sm transition-colors flex items-center justify-center gap-2 text-sm"
                        >
                            <Save className="w-4 h-4" />
                            Salvar Alterações
                        </button>
                    </form>
                </div>
            )}

            {activeTab === 'users' && isAdmin && (
                <div className="grid md:grid-cols-2 gap-8">
                    {/* LISTA DE USUÁRIOS */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Usuários Existentes
                        </h4>
                        <div className="bg-slate-50 rounded-lg border border-slate-200 divide-y divide-slate-200 max-h-[300px] overflow-y-auto">
                            {users.map(user => (
                                <div key={user.id} className={`p-3 flex items-center justify-between group transition-colors ${editingUserId === user.id ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-slate-50'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${user.username === currentUser?.username ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                                            {user.username.substring(0,2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-800">
                                                {user.username}
                                                {user.username === currentUser?.username && <span className="ml-2 text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">Você</span>}
                                            </p>
                                            <p className="text-[10px] text-slate-400">Criado em: {new Date(user.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button 
                                            onClick={() => handleStartEdit(user)}
                                            className={`p-2 rounded transition-colors ${editingUserId === user.id ? 'text-indigo-600 bg-indigo-100' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                            title="Editar Usuário"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        {user.username !== currentUser?.username && (
                                            <button 
                                                onClick={() => handleDeleteUser(user.id)}
                                                className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-50 rounded transition-colors"
                                                title="Remover Usuário"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* FORMULÁRIO (ADICIONAR / EDITAR) */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                                {editingUserId ? (
                                    <>
                                        <Pencil className="w-4 h-4 text-indigo-600" />
                                        <span className="text-indigo-700">Editando Usuário</span>
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4" />
                                        Adicionar Novo Usuário
                                    </>
                                )}
                            </h4>
                            {editingUserId && (
                                <button 
                                    onClick={resetUserForm}
                                    className="text-xs text-red-500 hover:underline"
                                >
                                    Cancelar
                                </button>
                            )}
                        </div>

                        <form onSubmit={handleSaveUser} className={`bg-slate-50 p-4 rounded-lg border space-y-4 transition-all ${editingUserId ? 'border-indigo-200 shadow-sm bg-indigo-50/30' : 'border-slate-200'}`}>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase">
                                    {editingUserId ? "Editar Nome de Usuário" : "Novo Usuário"}
                                </label>
                                <input
                                    type="text"
                                    value={formUsername}
                                    onChange={(e) => setFormUsername(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                                    placeholder="Ex: comercial"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase">
                                    {editingUserId ? "Nova Senha" : "Senha de Acesso"}
                                </label>
                                <input
                                    type="text" // Showing password visible as requested context often implies simple management
                                    value={formPassword}
                                    onChange={(e) => setFormPassword(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                                    placeholder="******"
                                />
                            </div>
                            <button
                                type="submit"
                                className={`w-full py-2 text-white rounded-lg font-medium shadow-sm transition-colors flex items-center justify-center gap-2 text-sm ${editingUserId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                            >
                                <Save className="w-4 h-4" />
                                {editingUserId ? "Salvar Alterações" : "Criar Usuário"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
        
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 text-right">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors text-sm"
            >
              Fechar
            </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
