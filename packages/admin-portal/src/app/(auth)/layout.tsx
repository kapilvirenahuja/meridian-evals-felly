export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-foreground">Felly Club Admin</h1>
        </div>
        <div className="rounded-lg bg-background p-8 shadow-sm border border-border">
          {children}
        </div>
      </div>
    </div>
  );
}
