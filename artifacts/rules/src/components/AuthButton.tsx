import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, User } from "lucide-react";
import { useNavigate } from "wouter";
import { getCurrentUser, logout } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function AuthButton() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: userData, isError } = useQuery({
    queryKey: ["currentUser"],
    queryFn: getCurrentUser,
    retry: false,
  });

  useEffect(() => {
    if (userData && !isError) {
      setIsAuthenticated(true);
      setUser(userData);
    } else {
      setIsAuthenticated(false);
      setUser(null);
    }
  }, [userData, isError]);

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      setIsAuthenticated(false);
      setUser(null);
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
  });

  const handleLogin = () => {
    window.location.href = "/api/auth/discord";
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        {user.avatar ? (
          <img 
            src={`https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png`}
            alt="Avatar"
            className="w-6 h-6 rounded-full"
          />
        ) : (
          <User className="w-5 h-5 text-[#9AA0A6]" />
        )}
        <span className="text-sm text-[#E3E3E3] truncate flex-1">{user.username}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          className="rounded-full text-[#9AA0A6] hover:bg-[#282A2C] hover:text-[#E3E3E3] h-8 w-8"
          aria-label="Выйти"
        >
          <LogOut className="h-4 w-4" />
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
