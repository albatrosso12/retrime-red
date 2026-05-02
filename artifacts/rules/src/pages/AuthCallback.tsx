import { useEffect } from "react";
import { useLocation } from "wouter";

export default function AuthCallback() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#token=')) {
      const tokenWithParams = hash.substring(7);
      const token = tokenWithParams.split('&')[0].split('#')[0];
      
      if (token && token.length > 10) {
        localStorage.setItem('auth_token', token);
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        window.dispatchEvent(new CustomEvent('auth:token-changed'));
      }
    }
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
