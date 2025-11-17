import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { setupService } from '../services/setupService';

interface SetupGuardProps {
  children: React.ReactNode;
}

/**
 * Guard component that checks if initial setup is required
 * and redirects to the setup page if needed.
 */
export default function SetupGuard({ children }: SetupGuardProps) {
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      const status = await setupService.checkSetupStatus();
      console.log('Setup status:', status);
      setSetupComplete(status.setup_complete);
    } catch (error) {
      console.error('Failed to check setup status:', error);
      // If we can't check setup status, assume setup is NOT complete (safer default)
      // This will redirect to setup page where user can see the actual error
      setSetupComplete(false);
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking setup status
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // If setup is not complete and we're not on the setup page, redirect to setup
  if (!setupComplete && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }

  // If setup is complete and we're on the setup page, redirect to login
  if (setupComplete && location.pathname === '/setup') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
