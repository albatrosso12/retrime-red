import { useEffect } from "react";
import { useLocation } from "wouter";

export default function AuthCallback() {
  const [, navigate] = useLocation();

  useEffect(() => {
    // Get token from URL hash (e.g., #token=...)
    const hash = window.location.hash;
    if (hash && hash.startsWith('#token=')) {
      const token = hash.substring(7); // Remove '#token='
      if (token) {
        localStorage.setItem('auth_token', token);
      }
    }
    // Redirect to home page
    navigate('/');
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#131314] text-[#E3E3E3] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8AB4F8] mx-auto mb-4"></div>
        <p>Completing authentication...</p>
      </div>
    </div>
  );
}
