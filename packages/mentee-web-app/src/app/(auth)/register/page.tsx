import { Metadata } from 'next';
import { RegisterForm } from '../../../components/auth/RegisterForm';
import { SocialLoginButtons } from '../../../components/auth/SocialLoginButtons';

export const metadata: Metadata = {
  title: 'Create Account — Felly Club',
  description: 'Join Felly Club and connect with experienced mentors',
};

export default function RegisterPage() {
  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="text-xl font-semibold text-foreground">Create your account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Join Felly Club to find your perfect mentor
        </p>
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

      <RegisterForm />

      <p className="mt-4 text-center text-xs text-muted-foreground">
        By creating an account, you agree to our{' '}
        <a href="/terms" className="underline hover:text-foreground">
          Terms of Service
        </a>{' '}
        and{' '}
        <a href="/privacy" className="underline hover:text-foreground">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}
