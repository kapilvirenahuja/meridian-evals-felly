import { AuthProvider } from '../../lib/auth-context';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <a href="/" className="text-lg font-bold text-foreground">
                Felly Club
              </a>
              <nav className="flex items-center gap-4">
                <a
                  href="/mentors"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Find Mentors
                </a>
                <a
                  href="/dashboard"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Dashboard
                </a>
              </nav>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </AuthProvider>
  );
}
