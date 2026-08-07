import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { 
  Home, 
  Music, 
  PlusCircle, 
  Settings, 
  Users, 
  FileText, 
  LogOut,
  HelpCircle,
  LayoutGrid
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', label: 'Panel Principal', icon: Home, roles: ['ADMIN', 'USER'] },
    { to: '/sounds', label: 'Explorar Sonidos', icon: Music, roles: ['ADMIN', 'USER'] },
    { to: '/collections', label: 'Colecciones', icon: LayoutGrid, roles: ['ADMIN', 'USER'] },
    { to: '/sounds/new', label: 'Subir Sonido', icon: PlusCircle, roles: ['ADMIN', 'USER'] },
    { to: '/discord', label: 'Bot de Discord', icon: HelpCircle, roles: ['ADMIN', 'USER'] },
    { to: '/users', label: 'Usuarios', icon: Users, roles: ['ADMIN'] },
    { to: '/audit', label: 'Auditoría', icon: FileText, roles: ['ADMIN'] },
    { to: '/settings', label: 'Configuración', icon: Settings, roles: ['ADMIN', 'USER'] },
  ];

  return (
    <aside className="w-64 bg-darkcard border-r border-darkborder flex flex-col h-screen sticky top-0">
      {/* Header */}
      <div className="p-5 border-b border-darkborder flex items-center gap-3">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center font-bold text-white shadow-md shadow-primary/20">
          SD
        </div>
        <div>
          <h1 className="font-bold text-sm tracking-tight text-white">Discord Assistant</h1>
          <span className="text-xs text-slate-400 font-medium capitalize">Rol: {user?.role.toLowerCase()}</span>
        </div>
      </div>

      {/* Nav Link List */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          // Filtrar enlaces por rol
          if (user && !item.roles.includes(user.role)) return null;

          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => 
                `flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 ${
                  isActive 
                    ? 'bg-primary text-white shadow-lg shadow-primary/10' 
                    : 'text-slate-400 hover:text-white hover:bg-darkborder'
                }`
              }
            >
              <Icon size={18} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="p-4 border-t border-darkborder bg-darkbg/50 flex items-center justify-between">
        <div className="truncate mr-2">
          <p className="text-sm font-semibold text-white truncate">{user?.username}</p>
          <p className="text-xs text-slate-400 truncate">Sesión activa</p>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 text-slate-400 hover:text-accentred hover:bg-darkborder rounded-lg transition-colors duration-150"
          title="Cerrar sesión"
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
};
