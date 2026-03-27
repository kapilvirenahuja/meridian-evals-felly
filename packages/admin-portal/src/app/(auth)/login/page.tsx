import { Metadata } from 'next';
import { LoginForm } from '../../../components/auth/login-form';

export const metadata: Metadata = {
  title: 'Sign In — Felly Club Admin',
  description: 'Sign in to the Felly Club Admin Portal',
};

export default function AdminLoginPage() {
  return (
    <div>
      <div className="mb-6 text-center">
        <h2 className="text-xl font-semibold text-foreground">Admin Sign In</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to manage the Felly Club platform
        </p>
      </div>

      <LoginForm />
    </div>
  );
}
