import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard — Felly Club',
  description: 'Your Felly Club mentee dashboard',
};

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Welcome to Felly Club</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your account is active. Find your perfect mentor to get started.
      </p>
      <div className="mt-8 rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">Get Started</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Browse mentors and book your first session. Mentor discovery will be available soon.
        </p>
      </div>
    </div>
  );
}
