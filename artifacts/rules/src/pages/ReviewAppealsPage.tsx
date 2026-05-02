import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Scale, ArrowLeft, CheckCircle2, XCircle, HelpCircle, MessageSquare, AlertTriangle, Send, Loader2, Shield, Gavel, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAppealsForReview,
  submitVerdict,
  getVerdicts,
  getCurrentUser,
  type Appeal,
  type Verdict,
  setBaseUrl,
} from "@workspace/api-client-react";

const API_URL = import.meta.env.VITE_API_URL || "https://retrime.korsetov2009.workers.dev";
setBaseUrl(API_URL);

const verdictConfig = {
  guilty: { 
    label: "Виновен", 
    color: "#F87171", 
    bg: "rgba(248, 113, 113, 0.1)",
    border: "rgba(248, 113, 113, 0.3)",
    gradient: "from-red-500/20 to-red-600/5",
    icon: XCircle 
  },
  not_guilty: { 
    label: "Не виновен", 
    color: "#4ADE80", 
    bg: "rgba(74, 222, 128, 0.1)",
    border: "rgba(74, 222, 128, 0.3)",
    gradient: "from-green-500/20 to-green-600/5",
    icon: CheckCircle2 
  },
  insufficient_evidence: { 
    label: "Недостаточно доказательств", 
    color: "#FBBF24", 
    bg: "rgba(251, 191, 36, 0.1)",
    border: "rgba(251, 191, 36, 0.3)",
    gradient: "from-yellow-500/20 to-yellow-600/5",
    icon: HelpCircle 
  },
};

function getAuthToken(): string | null {
  const local = localStorage.getItem("auth_token");
  if (local) return local;
  const match = document.cookie.match(/(?:^|; )auth_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

const slideIn = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 }
};

export default function ReviewAppealsPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
  const [verdict, setVerdict] = useState("guilty");
  const [reason, setReason] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setAuthError("Требуется авторизация");
      return;
    }

    getCurrentUser()
      .then((user) => {
        if (!user || !user.id) {
          localStorage.removeItem("auth_token");
          setAuthError("Требуется авторизация");
        }
      })
      .catch((err: any) => {
        if (err?.status === 401 || err?.status === 403) {
          localStorage.removeItem("auth_token");
          setAuthError(err?.message || "Требуется авторизация");
        }
      });
  }, [navigate]);

  const { data: appeals = [], isLoading, error } = useQuery({
    queryKey: ["appealsForReview"],
    queryFn: () => getAppealsForReview({ status: "pending" }),
    enabled: !!getAuthToken(),
    retry: (failureCount, err: any) => {
      if (err?.status === 401 || err?.status === 403) {
        localStorage.removeItem("auth_token");
        navigate("/");
        return false;
      }
      return failureCount < 3;
    },
  });

  const { data: verdicts = [] } = useQuery({
    queryKey: ["verdicts", selectedAppeal?.id],
    queryFn: async () => {
      if (!selectedAppeal) return [];
      const v = await getVerdicts(selectedAppeal.id);
      
      const token = getAuthToken();
      if (token) {
        try {
          const user = await getCurrentUser();
          const myVotes = v.filter((vv: Verdict) => vv.username === user.username);
          setHasVoted(myVotes.length > 0);
        } catch {
          setHasVoted(false);
        }
      }
      
      return v;
    },
    enabled: !!selectedAppeal && !!getAuthToken(),
  });

  const submitVerdictMutation = useMutation({
    mutationFn: (data: { appealId: number; verdict: string; reason: string }) =>
      submitVerdict(data.appealId, { verdict: data.verdict as any, reason: data.reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appealsForReview"] });
      queryClient.invalidateQueries({ queryKey: ["verdicts", selectedAppeal?.id] });
      setReason("");
      setHasVoted(true);
    },
  });

  const handleSubmitVerdict = () => {
    if (!selectedAppeal || hasVoted) return;
    submitVerdictMutation.mutate({
      appealId: selectedAppeal.id,
      verdict,
      reason,
    });
  };

  if (authError) {
    return (
      <div className="min-h-screen bg-[#0D0D0F] text-[#E8EAED] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#8AB4F8]/5 via-transparent to-[#6B9DFC]/5" />
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative z-10 text-center max-w-md bg-[#1A1A1D]/80 backdrop-blur-xl rounded-3xl p-10 border border-[#2D2D30] shadow-2xl shadow-[#8AB4F8]/10"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30 flex items-center justify-center">
            <AlertTriangle className="h-10 w-10 text-yellow-500" />
          </div>
          <h2 className="text-2xl font-semibold mb-3 text-white">Требуется авторизация</h2>
          <p className="text-[#9AA0A6] mb-8 text-lg">{authError}</p>
          <Button 
            onClick={() => navigate("/")} 
            className="bg-gradient-to-r from-[#8AB4F8] to-[#6B9DFC] hover:from-[#7AA4E8] hover:to-[#5B8DEE] text-[#0D0D0F] font-semibold px-8 py-3 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-[#8AB4F8]/25"
          >
            На главную
          </Button>
        </motion.div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0D0D0F] text-[#E8EAED] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl border-2 border-[#8AB4F8]/30 border-t-[#8AB4F8] animate-spin" />
          <p className="text-[#6B7280]">Загрузка обращений...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D0F] text-[#E8EAED]">
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#8AB4F8]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#6B9DFC]/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0D0D0F]/80 backdrop-blur-xl border-b border-[#2D2D30]">
        <div className="container mx-auto px-6 py-4 max-w-7xl">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-5"
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="rounded-xl hover:bg-[#1A1A1D] hover:border border-[#2D2D30] text-[#6B7280] hover:text-white transition-all duration-200"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#8AB4F8] to-[#5B8DEE] flex items-center justify-center shadow-lg shadow-[#8AB4F8]/20">
                <Scale className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-white tracking-tight">Рассмотрение жалоб</h1>
                <p className="text-sm text-[#6B7280]">Оцените обращения игроков сервера</p>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1A1A1D] border border-[#2D2D30]">
                <UserCheck className="h-4 w-4 text-[#8AB4F8]" />
                <span className="text-sm text-[#9AA0A6]">{appeals.length} ожидают</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 max-w-7xl relative z-10">
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 mb-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400"
          >
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <span>{(error as any)?.message || "Ошибка загрузки"}</span>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Appeals List */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-lg font-medium text-white">Ожидают решения</h2>
              <Badge className="bg-[#1A1A1D] text-[#8AB4F8] border border-[#2D2D30] px-3 py-1">
                {appeals.length}
              </Badge>
            </div>
            
            {appeals.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-[#1A1A1D]/50 rounded-2xl p-12 border border-[#2D2D30] text-center"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#8AB4F8]/10 flex items-center justify-center">
                  <MessageSquare className="h-8 w-8 text-[#8AB4F8]/50" />
                </div>
                <p className="text-[#6B7280] text-lg">Нет активных обращений</p>
                <p className="text-[#4B5563] text-sm mt-2">Все жалобы были рассмотрены</p>
              </motion.div>
            ) : (
              <div className="space-y-3">
                {appeals.map((appeal: Appeal, idx: number) => (
                  <motion.div
                    key={appeal.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <button
                      onClick={() => {
                        setSelectedAppeal(appeal);
                        setHasVoted(false);
                      }}
                      className={`w-full text-left p-4 rounded-2xl transition-all duration-200 group ${
                        selectedAppeal?.id === appeal.id 
                          ? "bg-[#8AB4F8]/10 border-2 border-[#8AB4F8]/30 shadow-lg shadow-[#8AB4F8]/10" 
                          : "bg-[#1A1A1D]/50 hover:bg-[#1F1F23] border-2 border-transparent hover:border-[#2D2D30]"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-medium text-white group-hover:text-[#8AB4F8] transition-colors line-clamp-1">
                          {appeal.title}
                        </h3>
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                          (appeal.verdictsCount || 0) >= 5 
                            ? "bg-green-500/20 text-green-400" 
                            : "bg-[#2D2D30] text-[#6B7280]"
                        }`}>
                          <Gavel className="h-3 w-3" />
                          {appeal.verdictsCount || 0}/5
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[#9AA0A6] text-sm">{appeal.nickname}</span>
                        <span className="text-[#4B5563]">•</span>
                        <span className="text-[#6B7280] text-sm">{appeal.faction || "—"}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-1 rounded-md bg-[#2D2D30] text-[#9AA0A6] text-xs">
                          {appeal.category}
                        </span>
                        {(appeal.verdictsCount || 0) >= 5 && (
                          <span className="px-2.5 py-1 rounded-md bg-green-500/20 text-green-400 text-xs">
                            На проверке
                          </span>
                        )}
                      </div>
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Appeal Details */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              {selectedAppeal ? (
                <motion.div
                  key={selectedAppeal.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-5"
                >
                  {/* Main Appeal Card */}
                  <div className="bg-[#1A1A1D] rounded-2xl border border-[#2D2D30] overflow-hidden">
                    <div className="bg-gradient-to-r from-[#8AB4F8]/10 via-transparent to-transparent px-6 py-5 border-b border-[#2D2D30]">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xl text-white font-semibold tracking-tight">
                          {selectedAppeal.title}
                        </CardTitle>
                        <Badge className="bg-[#2D2D30] text-[#9AA0A6] border-0 px-3 py-1.5">
                          {selectedAppeal.category}
                        </Badge>
                      </div>
                    </div>
                    
                    <CardContent className="p-6 space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gradient-to-br from-[#2D2D30] to-[#1F1F23] rounded-xl p-4">
                          <p className="text-xs text-[#6B7280] mb-1.5 uppercase tracking-wider">Никнейм</p>
                          <p className="text-white font-medium text-lg">{selectedAppeal.nickname}</p>
                        </div>
                        <div className="bg-gradient-to-br from-[#2D2D30] to-[#1F1F23] rounded-xl p-4">
                          <p className="text-xs text-[#6B7280] mb-1.5 uppercase tracking-wider">Фракция</p>
                          <p className="text-white font-medium text-lg">{selectedAppeal.faction || "—"}</p>
                        </div>
                      </div>
                      
                      {selectedAppeal.contact && (
                        <div className="bg-gradient-to-br from-[#2D2D30] to-[#1F1F23] rounded-xl p-4">
                          <p className="text-xs text-[#6B7280] mb-1.5 uppercase tracking-wider">Контакт</p>
                          <p className="text-white font-medium">{selectedAppeal.contact}</p>
                        </div>
                      )}
                      
                      <div className="bg-[#151518] rounded-xl p-5 border border-[#2D2D30]">
                        <p className="text-xs text-[#6B7280] mb-3 uppercase tracking-wider">Обращение</p>
                        <p className="text-[#E8EAED] whitespace-pre-wrap leading-relaxed">{selectedAppeal.message}</p>
                      </div>
                    </CardContent>
                  </div>

                  {/* Verdicts */}
                  {verdicts.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                    >
                      <Card className="bg-[#1A1A1D] border-[#2D2D30]">
                        <CardHeader className="px-6 py-4 border-b border-[#2D2D30]">
                          <CardTitle className="text-base text-white flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#8AB4F8]/10 flex items-center justify-center">
                              <MessageSquare className="h-4 w-4 text-[#8AB4F8]" />
                            </div>
                            Поступившие вердикты
                            <Badge className="ml-auto bg-[#2D2D30] text-[#8AB4F8] border-0">
                              {verdicts.length}/5
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                          {verdicts.map((v: Verdict, idx: number) => {
                            const config = verdictConfig[v.verdict] || verdictConfig.insufficient_evidence;
                            const Icon = config.icon;
                            return (
                              <motion.div 
                                key={idx} 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="flex items-start gap-4 p-4 rounded-xl"
                                style={{ backgroundColor: config.bg, border: `1px solid ${config.border}` }}
                              >
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: config.bg }}>
                                  <Icon className="h-5 w-5" style={{ color: config.color }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold" style={{ color: config.color }}>{config.label}</span>
                                    <span className="text-[#4B5563]">•</span>
                                    <span className="text-[#6B7280] text-sm">{v.username}</span>
                                  </div>
                                  {v.reason && (
                                    <p className="text-[#9AA0A6] text-sm line-clamp-2">{v.reason}</p>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {/* Submit Verdict */}
                  {hasVoted ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-gradient-to-br from-green-500/10 to-green-600/5 rounded-2xl border border-green-500/20 p-8 text-center"
                    >
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-green-500/20 flex items-center justify-center">
                        <CheckCircle2 className="h-8 w-8 text-green-500" />
                      </div>
                      <p className="text-white font-semibold text-lg">Ваш вердикт учтён</p>
                      <p className="text-[#6B7280] mt-2">Спасибо за участие в модерации</p>
                    </motion.div>
                  ) : (selectedAppeal.verdictsCount || 0) >= 5 ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-gradient-to-br from-[#8AB4F8]/10 to-[#6B9DFC]/5 rounded-2xl border border-[#8AB4F8]/20 p-8 text-center"
                    >
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#8AB4F8]/20 flex items-center justify-center">
                        <Shield className="h-8 w-8 text-[#8AB4F8]" />
                      </div>
                      <p className="text-white font-semibold text-lg">Ожидается решение</p>
                      <p className="text-[#6B7280] mt-2">5 вердиктов уже собрано. Обращение передаётся администрации</p>
                    </motion.div>
                  ) : (
                    <Card className="bg-[#1A1A1D] border-[#2D2D30]">
                      <CardHeader className="px-6 py-5 border-b border-[#2D2D30]">
                        <CardTitle className="text-base text-white flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#8AB4F8]/10 flex items-center justify-center">
                            <Send className="h-4 w-4 text-[#8AB4F8]" />
                          </div>
                          Вынести вердикт
                        </CardTitle>
                        <CardDescription className="text-[#6B7280] mt-2">
                          Ваше решение повлияет на итоговое решение по обращению
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-6 space-y-5">
                        <RadioGroup value={verdict} onValueChange={setVerdict} className="space-y-3">
                          {Object.entries(verdictConfig).map(([key, config]) => {
                            const Icon = config.icon;
                            return (
                              <label 
                                key={key}
                                className={`flex items-center p-4 rounded-xl cursor-pointer transition-all duration-200 border-2 ${
                                  verdict === key 
                                    ? "border-[#8AB4F8]/50 bg-[#8AB4F8]/5" 
                                    : "border-[#2D2D30] hover:border-[#3D3D40]"
                                }`}
                              >
                                <RadioGroupItem 
                                  value={key} 
                                  className="sr-only" 
                                />
                                <div 
                                  className="w-10 h-10 rounded-lg flex items-center justify-center mr-4"
                                  style={{ backgroundColor: config.bg }}
                                >
                                  <Icon className="h-5 w-5" style={{ color: config.color }} />
                                </div>
                                <span className="font-medium" style={{ color: config.color }}>{config.label}</span>
                              </label>
                            );
                          })}
                        </RadioGroup>

                        <div>
                          <Label className="text-[#6B7280] text-sm mb-2 block">Обоснование (необязательно)</Label>
                          <Textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Опишите причину вашего решения..."
                            className="bg-[#151518] border-[#2D2D30] text-[#E8EAED] placeholder:text-[#4B5563] focus:border-[#8AB4F8] focus:ring-[#8AB4F8]/20 min-h-[120px] rounded-xl"
                          />
                        </div>

                        <Button
                          onClick={handleSubmitVerdict}
                          disabled={submitVerdictMutation.isPending}
                          className="w-full bg-gradient-to-r from-[#8AB4F8] to-[#6B9DFC] hover:from-[#7AA4E8] hover:to-[#5B8DEE] text-[#0D0D0F] font-semibold h-12 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-[#8AB4F8]/25"
                        >
                          {submitVerdictMutation.isPending ? (
                            <>
                              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                              Отправка...
                            </>
                          ) : (
                            <>
                              <Send className="h-5 w-5 mr-2" />
                              Отправить вердикт
                            </>
                          )}
                        </Button>

                        {submitVerdictMutation.isError && (
                          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                            Ошибка: {(submitVerdictMutation.error as any)?.message}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center h-full min-h-[500px]"
                >
                  <div className="text-center">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-[#1A1A1D] to-[#151518] border border-[#2D2D30] flex items-center justify-center">
                      <Gavel className="h-12 w-12 text-[#4B5563]" />
                    </div>
                    <p className="text-[#6B7280] text-xl mb-2">Выберите обращение</p>
                    <p className="text-[#4B5563]">Нажмите на жалобу из списка для рассмотрения</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}