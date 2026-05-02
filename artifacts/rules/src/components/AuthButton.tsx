import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LogIn, User, LogOut } from "lucide-react";
import { getCurrentUser, logout, setBaseUrl } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function AuthButton() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    setBaseUrl(import.meta.env.VITE_API_URL || "https://retrime.korsetov2009.workers.dev");
  }, []);

  const validateToken = () => {
    const token =
      localStorage.getItem("auth_token") ||
      (() => {
        const match = document.cookie.match(/(?:^|; )auth_token=([^;]*)/);
        return match ? decodeURIComponent(match[1]) : null;
      })();
    if (!token) {
      setIsAuthenticated(false);
      setUser(null);
      return;
    }

    getCurrentUser()
      .then((data) => {
        if (data && data.id) {
          setIsAuthenticated(true);
          setUser(data);
        } else {
          localStorage.removeItem("auth_token");
          setIsAuthenticated(false);
          setUser(null);
        }
      })
      .catch(() => {
        localStorage.removeItem("auth_token");
        setIsAuthenticated(false);
        setUser(null);
      });
  };

  useEffect(() => {
    validateToken();
  }, []);

  useEffect(() => {
    const handleTokenChange = () => validateToken();
    window.addEventListener("auth:token-changed", handleTokenChange);
    return () => window.removeEventListener("auth:token-changed", handleTokenChange);
  }, []);

  const handleLogin = () => {
    window.location.href = "https://retrime.korsetov2009.workers.dev/auth/discord";
  };

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    setIsAuthenticated(false);
    setUser(null);
    queryClient.clear();
    window.dispatchEvent(new CustomEvent("auth:token-changed"));
    logout().catch(() => {});
  };

  if (isAuthenticated && user) {
    const avatarHash = user.avatar || "";
    const userId = user.discordId || user.id || "";
    const avatarUrl =
      avatarHash && userId
        ? `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=64`
        : "";

    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full bg-[#282A2C] flex items-center justify-center hover:bg-[#3C4043] transition-colors overflow-hidden flex-shrink-0"
            title={user.username}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  (e.target as HTMLImageElement).parentElement!.innerHTML =
                    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user w-5 h-5 text-[#9AA0A6]"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
                }}
              />
            ) : (
              <User className="w-5 h-5 text-[#9AA0A6]" />
            )}
          </div>
          <span className="text-sm text-[#E3E3E3] truncate max-w-[100px]" title={user.username}>
            {user.username}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          className="h-7 w-7 rounded-full text-[#9AA0A6] hover:text-[#E3E3E3] hover:bg-[#3C4043] flex-shrink-0"
          title="Выход"
        >
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={handleLogin}
      className="rounded-full bg-[#5865F2] hover:bg-[#4752C4] text-white h-9 px-4 gap-2 mx-3 mb-2"
    >
      <LogIn className="h-4 w-4" />
      Войти через Discord
    </Button>
  );
}
