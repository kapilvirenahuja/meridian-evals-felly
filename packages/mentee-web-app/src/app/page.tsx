import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Felly Club</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Find your perfect mentor and accelerate your career
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            Get Started
          </Link>
        </div>
      </div>
    </main>
  );
}
