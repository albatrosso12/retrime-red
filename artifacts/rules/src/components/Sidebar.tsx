import { useLocation } from "wouter";
import { Menu, Plus, Settings, MessageSquare, Trash2, Home as HomeIcon, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useChats } from "@/hooks/useChats";
import { AuthButton } from "@/components/AuthButton";

type Props = {
  expanded: boolean;
  setExpanded: (v: boolean) => void;
  onOpenSettings: () => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (v: boolean) => void;
};

const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

function withBase(path: string): string {
  return `${baseUrl}${path}`;
}

export function Sidebar({
  expanded,
  setExpanded,
  onOpenSettings,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
}: Props) {
  const [location, navigate] = useLocation();
  const { chats, createChat, deleteChat } = useChats();

  const goToChat = (id: string) => {
    navigate(`/chat/${id}`);
    setIsMobileMenuOpen(false);
  };

  const goHome = () => {
    navigate("/");
    setIsMobileMenuOpen(false);
  };

  const handleCreate = () => {
    const next = createChat();
    setExpanded(true);
    goToChat(next.id);
  };

  const activeChatId = location.startsWith("/chat/")
    ? location.slice("/chat/".length)
    : null;

  const Panel = ({ onClose }: { onClose?: () => void }) => (
    <div className="flex flex-col h-full bg-[#1E1F20] w-[280px] p-3 text-[#E3E3E3]">
      <div className="flex items-center justify-between mb-2 px-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="rounded-full text-[#E3E3E3] hover:bg-[#282A2C] hover:text-[#E3E3E3] h-10 w-10"
          aria-label="Свернуть меню"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      <div className="mb-4 px-1">
        <Button
          variant="ghost"
          onClick={handleCreate}
          className="rounded-full bg-[#282A2C] text-[#E3E3E3] hover:bg-[#444746] hover:text-[#E3E3E3] h-11 px-4 gap-2"
        >
          <Plus className="h-5 w-5" />
          Новое обращение
        </Button>
      </div>

      <button
        onClick={goHome}
        className={`flex items-center gap-3 rounded-full px-3 py-2 text-sm font-normal mb-2 mx-1 transition-colors ${
          location === "/"
            ? "bg-[#282A2C] text-[#8AB4F8]"
            : "text-[#E3E3E3] hover:bg-[#282A2C]"
        }`}
      >
        <HomeIcon className="h-4 w-4 shrink-0" />
        Свод правил
      </button>

      <div className="flex-1 overflow-y-auto px-1">
        <p className="px-3 text-xs font-medium text-[#9AA0A6] mb-2 mt-2">
          Обращения
        </p>
        {chats.length === 0 ? (
          <p className="px-3 py-4 text-sm text-[#9AA0A6]">
            Пока нет обращений. Нажмите «+», чтобы создать первое.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={`group flex items-center rounded-full transition-colors ${
                  activeChatId === chat.id ? "bg-[#282A2C]" : "hover:bg-[#282A2C]"
                }`}
              >
                <button
                  onClick={() => goToChat(chat.id)}
                  className="flex-1 flex items-center gap-3 px-3 py-2 text-sm font-normal text-[#E3E3E3] truncate text-left"
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-[#9AA0A6]" />
                  <span className="truncate">{chat.title}</span>
                  {chat.status === "sent" && (
                    <span className="ml-auto text-[10px] text-[#8AB4F8] uppercase tracking-wide">
                      отправлено
                    </span>
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChat(chat.id);
                    if (activeChatId === chat.id) navigate("/");
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-2 mr-1 text-[#9AA0A6] hover:text-[#E3E3E3]"
                  aria-label="Удалить обращение"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-auto pt-3 px-1 border-t border-[#282A2C]">
        <Button
          variant="ghost"
          onClick={() => navigate("/review")}
          className="w-full justify-start rounded-full text-sm font-normal text-[#E3E3E3] hover:bg-[#282A2C] hover:text-[#E3E3E3] h-11 px-3 gap-3"
        >
          <Scale className="h-5 w-5 text-[#9AA0A6]" />
          Рассмотрение жалоб
        </Button>
        <Button
          variant="ghost"
          onClick={onOpenSettings}
          className="w-full justify-start rounded-full text-sm font-normal text-[#E3E3E3] hover:bg-[#282A2C] hover:text-[#E3E3E3] h-11 px-3 gap-3"
        >
          <Settings className="h-5 w-5 text-[#9AA0A6]" />
          Настройки
        </Button>
      </div>
      <div className="px-1 pb-3 mt-10">
        <AuthButton />
      </div>
    </div>
  );

  return (
    <>
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="left" className="w-[280px] p-0 border-none bg-transparent">
          <SheetTitle className="sr-only">Меню навигации</SheetTitle>
          <Panel onClose={() => setIsMobileMenuOpen(false)} />
        </SheetContent>
      </Sheet>
      <aside
        className={`hidden md:flex shrink-0 h-screen sticky top-0 z-40 transition-[width] duration-300 ease-out ${
          expanded ? "w-[280px]" : "w-[68px]"
        }`}
      >
        {expanded ? (
          <Panel onClose={() => setExpanded(false)} />
        ) : (
          <div className="flex flex-col w-[68px] h-full bg-[#131314] py-4 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpanded(true)}
              className="rounded-full text-[#E3E3E3] hover:bg-[#282A2C] hover:text-[#E3E3E3] h-10 w-10"
              aria-label="Раскрыть меню"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleCreate}
              className="rounded-full bg-[#282A2C] text-[#E3E3E3] hover:bg-[#444746] hover:text-[#E3E3E3] h-10 w-10 mt-2"
              aria-label="Новое обращение"
            >
              <Plus className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={goHome}
              className={`rounded-full h-10 w-10 ${
                location === "/"
                  ? "bg-[#282A2C] text-[#8AB4F8]"
                  : "text-[#E3E3E3] hover:bg-[#282A2C] hover:text-[#E3E3E3]"
              }`}
              aria-label="Свод правил"
              title="Свод правил"
            >
              <HomeIcon className="h-4 w-4" />
            </Button>

            <div className="mt-2 flex flex-col gap-1 w-full px-2 overflow-y-auto no-scrollbar">
              {chats.slice(0, 6).map((chat) => (
                <Button
                  key={chat.id}
                  variant="ghost"
                  size="icon"
                  onClick={() => goToChat(chat.id)}
                  className={`rounded-full w-10 h-10 mx-auto ${
                    activeChatId === chat.id
                      ? "bg-[#282A2C] text-[#8AB4F8]"
                      : "text-[#E3E3E3] hover:bg-[#282A2C] hover:text-[#E3E3E3]"
                  }`}
                  aria-label={chat.title}
                  title={chat.title}
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
              ))}
            </div>

            <div className="mt-auto">
              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenSettings}
                className="rounded-full text-[#E3E3E3] hover:bg-[#282A2C] hover:text-[#E3E3E3] h-10 w-10"
                aria-label="Настройки"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>
        )}
      </aside>

    </>
  );
}

export function MobileMenuTrigger({ onClick }: { onClick: () => void }) {
  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={onClick}
        className="rounded-full text-[#E3E3E3] hover:bg-[#282A2C] hover:text-[#E3E3E3]"
        aria-label="Открыть меню"
      >
        <Menu className="h-5 w-5" />
      </Button>
    </div>
  );
}

export { withBase };
