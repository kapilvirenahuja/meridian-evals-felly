import { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from '../../../components/auth/LoginForm';
import { SocialLoginButtons } from '../../../components/auth/SocialLoginButtons';

export const metadata: Metadata = {
  title: 'Sign In — Felly Club',
  description: 'Sign in to your Felly Club account',
};

export default function LoginPage() {
  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="text-xl font-semibold text-foreground">Sign in to your account</h2>
        <p className="mt-1 text-sm text-muted-foreground">Welcome back to Felly Club</p>
      </div>

      <SocialLoginButtons />

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
        </div>
      </div>

      <LoginForm />

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="underline hover:text-foreground">
          Create one
        </Link>
      </p>
    </div>
  );
}
