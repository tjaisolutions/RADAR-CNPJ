import React, { useState, useEffect } from 'react';
import { X, Save, Lock, User, AlertCircle, CheckCircle2, Plus, Trash2, Shield } from 'lucide-react';
import { User as UserType } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserType | null;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, currentUser }) => {
  const [users, setUsers] = useState<UserType[]>([]);
  
  // State for Adding New User
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      setError('');
      setSuccess('');
      setNewUsername('');
      setNewPassword('');
    }
  }, [isOpen]);

  const loadUsers = () => {
    const usersData = localStorage.getItem('lead_app_users_v2');
    if (usersData) {
        setUsers(JSON.parse(usersData));
    }
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newUsername || !newPassword) {
        setError("Preencha usuário e senha.");
        return;
    }

    // Check if user exists
    if (users.some(u => u.username === newUsername)) {
        setError("Este nome de usuário já existe.");
        return;
    }

    const newUser: UserType = {
        id: crypto.randomUUID(),
        username: newUsername,
        password: newPassword,
        role: 'user', // Default role
        createdAt: Date.now()
    };

    const updatedUsers = [...users, newUser];
    localStorage.setItem('lead_app_users_v2', JSON.stringify(updatedUsers));
    
    setUsers(updatedUsers);
    setNewUsername('');
    setNewPassword('');
    setSuccess(`Usuário ${newUsername} criado com sucesso!`);
  };

  const handleDeleteUser = (userId: string) => {
    if (userId === currentUser?.id) {
        setError("Você não pode excluir a si mesmo.");
        return;
    }

    // Prevent deleting the last admin if needed, but for simplicity let's just warn
    if (users.length <= 1) {
        setError("Deve haver pelo menos um usuário no sistema.");
        return;
    }

    if (confirm("Tem certeza que deseja remover este usuário?")) {
        const updatedUsers = users.filter(u => u.id !== userId);
        localStorage.setItem('lead_app_users_v2', JSON.stringify(updatedUsers));
        setUsers(updatedUsers);
        setSuccess("Usuário removido.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center shrink-0">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            Gerenciar Usuários
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
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

            <div className="grid md:grid-cols-2 gap-8">
                {/* LISTA DE USUÁRIOS */}
                <div className="space-y-4">
                    <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Usuários Existentes
                    </h4>
                    <div className="bg-slate-50 rounded-lg border border-slate-200 divide-y divide-slate-200">
                        {users.map(user => (
                            <div key={user.id} className="p-3 flex items-center justify-between group">
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
                        ))}
                    </div>
                </div>

                {/* ADICIONAR NOVO USUÁRIO */}
                <div className="space-y-4">
                    <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Adicionar Novo Usuário
                    </h4>
                    <form onSubmit={handleAddUser} className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase">Novo Usuário</label>
                            <input
                                type="text"
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                                placeholder="Ex: comercial"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase">Senha de Acesso</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
                                placeholder="******"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-sm transition-colors flex items-center justify-center gap-2 text-sm"
                        >
                            <Save className="w-4 h-4" />
                            Criar Usuário
                        </button>
                    </form>
                </div>
            </div>
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
