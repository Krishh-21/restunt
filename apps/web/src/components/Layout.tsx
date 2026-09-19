import { useAuthStore } from '../store/authStore';

interface LayoutProps {
  title: string;
  children: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
}

export default function Layout({ title, children, showBack, onBack }: LayoutProps) {
  const { user, logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBack && onBack && (
              <button onClick={onBack} className="text-gray-500 hover:text-gray-800 text-xl">
                ←
              </button>
            )}
            <div>
              <h1 className="text-lg font-bold text-gray-900">{title}</h1>
              {user && <p className="text-xs text-gray-500">{user.fullName}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Online</span>
            <button
              onClick={logout}
              className="text-sm text-gray-500 hover:text-red-600"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
