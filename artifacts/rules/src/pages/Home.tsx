import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { ruleSections, ranks } from "../data/rules";
import { Menu, Settings, MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

const factions = [
  "Гражданские",
  "Сербская Армия",
  "НАТО / Канадцы",
  "Армия РФ"
];

const documents = [
  {
    title: "ШАБЛОН РАПОРТА",
    content: `КОМУ: Командиру подразделения
ОТ КОГО: [Звание] [Фамилия]
ДАТА: ДД.ММ.ГГГГ

СОДЕРЖАНИЕ:
Докладываю о происшествии во время патруля квадрата D4. В 14:00 был обнаружен...

ПОДПИСЬ: _______`
  },
  {
    title: "ШАБЛОН ПРИКАЗА",
    content: `ПРИКАЗ № ___
ОТ: [Должность, Звание]
ДАТА: ДД.ММ.ГГГГ

СОДЕРЖАНИЕ:
1. Выдвинуться в квадрат B2 для зачистки.
2. Организовать блокпост на перекрестке.
3. Открывать огонь на поражение при сопротивлении.

ПОДПИСЬ: _______`
  },
  {
    title: "ПРОТОКОЛ ЗАДЕРЖАНИЯ",
    content: `ПРОТОКОЛ № ___
ОТ КОГО: Патрульный [Звание]
ДАТА: ДД.ММ.ГГГГ
ЗАДЕРЖАННЫЙ: [Имя Фамилия или Описание]

ПРИЧИНА ЗАДЕРЖАНИЯ:
Нарушение комендантского часа, ношение оружия.
ИЗЪЯТОЕ ИМУЩЕСТВО:
- Пистолет ПМ
- Радиостанция

ПОДПИСЬ: _______`
  }
];

export default function Home() {
  const [activeSection, setActiveSection] = useState<string>("general");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);

            if (navRef.current) {
              const container = navRef.current;
              const activeBtn = container.querySelector<HTMLElement>(
                `[data-section="${entry.target.id}"]`
              );
              if (activeBtn) {
                const target =
                  activeBtn.offsetLeft -
                  container.clientWidth / 2 +
                  activeBtn.clientWidth / 2;
                container.scrollTo({ left: target, behavior: "smooth" });
              }
            }
          }
        });
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );

    const sections = document.querySelectorAll("section[id]");
    sections.forEach((section) => observer.observe(section));

    return () => sections.forEach((section) => observer.unobserve(section));
  }, []);

  const scrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setIsMobileMenuOpen(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#1E1F20] w-[280px] p-4 text-[#E3E3E3]">
      <div className="mb-8">
        <Button variant="ghost" className="w-full justify-start rounded-full text-[#E3E3E3] hover:bg-[#282A2C] hover:text-[#E3E3E3] h-12 px-4">
          <Plus className="mr-2 h-5 w-5" />
          Новый чат
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <p className="px-4 text-xs font-medium text-[#9AA0A6] mb-4">Недавние</p>
        <div className="flex flex-col gap-1">
          {ruleSections.slice(0, 4).map((section) => (
            <Button
              key={section.id}
              variant="ghost"
              onClick={() => scrollTo(section.id)}
              className="w-full justify-start rounded-full text-sm font-normal text-[#E3E3E3] hover:bg-[#282A2C] hover:text-[#E3E3E3] h-10 px-4 truncate"
            >
              <MessageSquare className="mr-3 h-4 w-4 shrink-0 text-[#E3E3E3]" />
              <span className="truncate">{section.title}</span>
            </Button>
          ))}
        </div>
      </div>
      <div className="mt-auto pt-4 flex flex-col gap-1 border-t border-[#444746]">
         <Button variant="ghost" className="w-full justify-start rounded-full text-sm font-normal text-[#E3E3E3] hover:bg-[#282A2C] hover:text-[#E3E3E3] h-10 px-4">
           <Settings className="mr-3 h-4 w-4 text-[#E3E3E3]" />
           Настройки
         </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#131314] text-[#E3E3E3] flex font-sans selection:bg-[#8AB4F8] selection:text-[#131314]">
      
      {/* Slim Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-[68px] shrink-0 h-screen sticky top-0 bg-[#131314] py-4 items-center gap-4 z-40">
        <Button variant="ghost" size="icon" className="rounded-full text-[#E3E3E3] hover:bg-[#282A2C] hover:text-[#E3E3E3]">
          <Menu className="h-5 w-5" />
        </Button>
        
        <div className="mt-4">
          <Button variant="ghost" size="icon" className="rounded-full bg-[#282A2C] text-[#E3E3E3] hover:bg-[#444746] hover:text-[#E3E3E3] h-10 w-10">
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        <div className="mt-4 flex flex-col gap-2 w-full px-2">
          {ruleSections.slice(0, 3).map((section, idx) => (
             <Button key={idx} variant="ghost" size="icon" onClick={() => scrollTo(section.id)} className="rounded-full text-[#E3E3E3] hover:bg-[#282A2C] hover:text-[#E3E3E3] w-10 h-10 mx-auto">
               <MessageSquare className="h-4 w-4" />
             </Button>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <Button variant="ghost" size="icon" className="rounded-full text-[#E3E3E3] hover:bg-[#282A2C] hover:text-[#E3E3E3]">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#131314]">
        
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between p-4 bg-[#131314]/90 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="md:hidden">
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full text-[#E3E3E3] hover:bg-[#282A2C] hover:text-[#E3E3E3]">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px] p-0 border-none bg-transparent">
                  <SheetTitle className="sr-only">Меню навигации</SheetTitle>
                  <SidebarContent />
                </SheetContent>
              </Sheet>
            </div>
            
            <span className="text-[#E3E3E3] text-xl font-medium tracking-tight flex items-center gap-2">
              <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="Logo" className="w-8 h-8 rounded-full object-cover" />
              Балканский Конфликт
            </span>
          </div>
          
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-x-hidden">
          <div className="max-w-[880px] mx-auto px-4 md:px-8 py-8 md:py-12 pb-24 flex flex-col gap-12">
            
            {/* Hero Section */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="flex flex-col gap-6 pt-4 pb-8"
            >
              <h1 className="text-4xl md:text-5xl font-normal text-[#9AA0A6] tracking-tight">
                Добро пожаловать
              </h1>
              <h2 className="text-5xl md:text-6xl font-medium bg-clip-text text-transparent bg-gradient-to-r from-[#8AB4F8] to-[#D7E3FC] tracking-tight">
                Свод правил сервера
              </h2>
              
              <div className="flex flex-wrap gap-2 mt-4">
                {factions.map(faction => (
                  <div key={faction} className="px-4 py-2 rounded-full bg-[#1E1F20] text-[#E3E3E3] text-sm font-medium border border-[#444746] select-none">
                    {faction}
                  </div>
                ))}
              </div>

              {/* Quick Jump Pills */}
              <div className="flex flex-wrap gap-2 mt-4">
                 <Button onClick={() => scrollTo("general")} variant="secondary" className="rounded-full bg-[#282A2C] text-[#E3E3E3] hover:bg-[#444746] border-none px-5 font-normal">
                   Общие правила
                 </Button>
                 <Button onClick={() => scrollTo("terms")} variant="secondary" className="rounded-full bg-[#282A2C] text-[#E3E3E3] hover:bg-[#444746] border-none px-5 font-normal">
                   Свод терминов
                 </Button>
                 <Button onClick={() => scrollTo("ranks")} variant="secondary" className="rounded-full bg-[#282A2C] text-[#E3E3E3] hover:bg-[#444746] border-none px-5 font-normal">
                   Звания фракций
                 </Button>
                 <Button onClick={() => scrollTo("documents")} variant="secondary" className="rounded-full bg-[#282A2C] text-[#E3E3E3] hover:bg-[#444746] border-none px-5 font-normal">
                   Шаблоны документов
                 </Button>
              </div>
            </motion.div>

            {/* Horizontal Navigation row */}
            <div className="sticky top-20 z-20 py-2 bg-[#131314]/90 backdrop-blur -mx-4 px-4 md:mx-0 md:px-0">
               <div 
                 ref={navRef}
                 onWheel={(e) => {
                   if (e.deltaY === 0) return;
                   const el = e.currentTarget;
                   const max = el.scrollWidth - el.clientWidth;
                   if (max <= 0) return;
                   if (
                     (e.deltaY > 0 && el.scrollLeft < max) ||
                     (e.deltaY < 0 && el.scrollLeft > 0)
                   ) {
                     e.preventDefault();
                     el.scrollLeft += e.deltaY;
                   }
                 }}
                 className="flex gap-2 overflow-x-auto no-scrollbar pb-2 pt-1 cursor-grab active:cursor-grabbing"
               >
                 {ruleSections.map((section) => (
                   <button
                     key={section.id}
                     data-section={section.id}
                     onClick={() => scrollTo(section.id)}
                     className={`shrink-0 px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                       activeSection === section.id 
                         ? 'bg-[#8AB4F8]/10 text-[#8AB4F8]' 
                         : 'bg-[#1E1F20] text-[#E3E3E3] hover:bg-[#282A2C]'
                     }`}
                   >
                     {section.title}
                   </button>
                 ))}
                 <button
                   data-section="ranks"
                   onClick={() => scrollTo("ranks")}
                   className={`shrink-0 px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                     activeSection === "ranks" 
                       ? 'bg-[#8AB4F8]/10 text-[#8AB4F8]' 
                       : 'bg-[#1E1F20] text-[#E3E3E3] hover:bg-[#282A2C]'
                   }`}
                 >
                   Звания
                 </button>
                 <button
                   data-section="documents"
                   onClick={() => scrollTo("documents")}
                   className={`shrink-0 px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                     activeSection === "documents" 
                       ? 'bg-[#8AB4F8]/10 text-[#8AB4F8]' 
                       : 'bg-[#1E1F20] text-[#E3E3E3] hover:bg-[#282A2C]'
                   }`}
                 >
                   Документы
                 </button>
               </div>
            </div>

            {/* Rules Sections */}
            <div className="flex flex-col gap-10">
              {ruleSections.map((section, index) => {
                const num = String(index + 1).padStart(2, "0");
                return (
                  <motion.section 
                    key={section.id} 
                    id={section.id}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-100px" }}
                    variants={containerVariants}
                    className="scroll-mt-36"
                  >
                    <div className="bg-[#1E1F20] rounded-3xl p-6 md:p-10 shadow-sm border border-[#282A2C]">
                      <div className="mb-8">
                        <span className="text-sm font-medium text-[#8AB4F8] mb-2 block">Раздел {num}</span>
                        <h2 className="text-2xl md:text-3xl font-medium text-[#E3E3E3] mb-2">{section.title}</h2>
                        <p className="text-base text-[#9AA0A6]">{section.subtitle}</p>
                      </div>

                      <div className="flex flex-col gap-5">
                        {section.rules.map((rule, ruleIdx) => (
                          <motion.div 
                            key={ruleIdx} 
                            variants={itemVariants}
                            className="flex gap-4 text-[15px] text-[#E3E3E3] leading-relaxed"
                          >
                            <span className="text-[#9AA0A6] font-medium mt-0.5 shrink-0 w-6">
                              {ruleIdx + 1}.
                            </span>
                            <div>{rule}</div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.section>
                );
              })}

              {/* Ranks Section */}
              <motion.section
                id="ranks"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={containerVariants}
                className="scroll-mt-36"
              >
                <div className="bg-[#1E1F20] rounded-3xl p-6 md:p-10 shadow-sm border border-[#282A2C]">
                  <div className="mb-8">
                     <span className="text-sm font-medium text-[#8AB4F8] mb-2 block">Раздел {String(ruleSections.length + 1).padStart(2, "0")}</span>
                     <h2 className="text-2xl md:text-3xl font-medium text-[#E3E3E3] mb-2">Звания всех фракций</h2>
                     <p className="text-base text-[#9AA0A6]">Иерархия вооруженных сил и гражданских групп.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {ranks.map((faction, idx) => (
                      <motion.div key={idx} variants={itemVariants} className="bg-[#282A2C] rounded-2xl p-6">
                        <h3 className="text-lg font-medium text-[#E3E3E3] mb-4 pb-3 border-b border-[#444746]">
                          {faction.faction}
                        </h3>
                        <div className="flex flex-col">
                          {faction.list.map((rank, rankIdx) => (
                            <div 
                              key={rankIdx} 
                              className="py-2 border-b border-[#444746]/50 last:border-0 text-[15px] flex items-center justify-between text-[#E3E3E3]"
                            >
                              <span>{rank}</span>
                              <span className="text-xs text-[#9AA0A6] font-mono">{faction.list.length - rankIdx}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.section>

              {/* Documents Section */}
              <motion.section
                id="documents"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={containerVariants}
                className="scroll-mt-36"
              >
                <div className="bg-[#1E1F20] rounded-3xl p-6 md:p-10 shadow-sm border border-[#282A2C]">
                  <div className="mb-8">
                     <span className="text-sm font-medium text-[#8AB4F8] mb-2 block">Раздел {String(ruleSections.length + 2).padStart(2, "0")}</span>
                     <h2 className="text-2xl md:text-3xl font-medium text-[#E3E3E3] mb-2">Формат документов</h2>
                     <p className="text-base text-[#9AA0A6]">Стандартизированные бланки делопроизводства.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    {documents.map((doc, idx) => (
                      <motion.div 
                        key={idx} 
                        variants={itemVariants}
                        className="bg-[#282A2C] rounded-2xl overflow-hidden"
                      >
                        <div className="px-6 py-4 border-b border-[#444746]">
                          <h3 className="text-lg font-medium text-[#E3E3E3]">
                            {doc.title}
                          </h3>
                        </div>
                        <div className="p-6 bg-[#131314]/50">
                          <pre className="font-mono text-sm whitespace-pre-wrap text-[#9AA0A6] leading-relaxed">
                            {doc.content}
                          </pre>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.section>

            </div>
          </div>

          {/* Footer */}
          <footer className="w-full py-8 text-center text-sm text-[#9AA0A6]">
            Балканский Конфликт · v1.0 · 2026
          </footer>
        </main>
      </div>
    </div>
  );
}
