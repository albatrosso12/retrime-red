import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Scale, ArrowLeft, CheckCircle2, XCircle, HelpCircle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAppealsForReview, submitVerdict, getVerdicts, getCurrentUser, type Appeal, type Verdict } from "@workspace/api-client-react";

const categories = [
  "Жалоба на игрока",
  "Жалоба на администратора",
  "Предложение",
  "Вопрос",
  "Обжалование бана",
  "Другое",
  "Аппеляция на наказание",
];

const verdictLabels: Record<string, { label: string; color: string; icon: any }> = {
  guilty: { label: "Виновен", color: "bg-red-500", icon: XCircle },
  not_guilty: { label: "Не виновен", color: "bg-green-500", icon: CheckCircle2 },
  insufficient_evidence: { label: "Недостаточно доказательств", color: "bg-yellow-500", icon: HelpCircle },
};

export default function ReviewAppealsPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
  const [verdict, setVerdict] = useState("guilty");
  const [reason, setReason] = useState("");

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      navigate('/');
      return;
    }
    getCurrentUser()
      .then((user) => {
        if (!user || !user.id) {
          localStorage.removeItem('auth_token');
          navigate('/');
        }
      })
      .catch((err) => {
        if (err?.status === 401) {
          localStorage.removeItem('auth_token');
          navigate('/');
        }
      });
  }, [navigate]);

  const { data: appeals = [], isLoading, error } = useQuery({
    queryKey: ["appealsForReview"],
    queryFn: getAppealsForReview,
    enabled: !!localStorage.getItem('auth_token'),
    retry: (failureCount, error: any) => {
      if (error?.status === 401) {
        localStorage.removeItem('auth_token');
        window.location.href = '/';
        return false;
      }
      return failureCount < 3;
    },
  });

  const { data: verdicts = [] } = useQuery({
    queryKey: ["verdicts", selectedAppeal?.id],
    queryFn: () => selectedAppeal ? getVerdicts(selectedAppeal.id) : Promise.resolve([]),
    enabled: !!selectedAppeal && !!localStorage.getItem('auth_token'),
    retry: (failureCount, error: any) => {
      if (error?.status === 401) {
        localStorage.removeItem('auth_token');
        window.location.href = '/';
        return false;
      }
      return failureCount < 3;
    },
  });

  const submitVerdictMutation = useMutation({
    mutationFn: (data: { appealId: number; verdict: string; reason: string }) =>
      submitVerdict(data.appealId, { verdict: data.verdict as any, reason: data.reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appealsForReview"] });
      queryClient.invalidateQueries({ queryKey: ["verdicts", selectedAppeal?.id] });
      setReason("");
    },
  });

  const handleSubmitVerdict = () => {
    if (!selectedAppeal) return;
    submitVerdictMutation.mutate({
      appealId: selectedAppeal.id,
      verdict,
      reason,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#131314] text-[#E3E3E3] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8AB4F8]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#131314] text-[#E3E3E3]">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="rounded-full text-[#E3E3E3] hover:bg-[#282A2C]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Scale className="h-8 w-8 text-[#8AB4F8]" />
          <h1 className="text-3xl font-bold">Рассмотрение жалоб</h1>
        </motion.div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-200 p-4 rounded-lg mb-6">
            Ошибка загрузки жалоб
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Appeals List */}
          <div className="lg:col-span-1 space-y-3">
            <h2 className="text-xl font-semibold mb-4">Ожидают рассмотрения</h2>
            {appeals.length === 0 ? (
              <Card className="bg-[#1E1F20] border-[#282A2C]">
                <CardContent className="p-6 text-center text-[#9AA0A6]">
                  Нет жалоб для рассмотрения
                </CardContent>
              </Card>
            ) : (
              appeals.map((appeal: Appeal) => (
                <motion.div
                  key={appeal.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setSelectedAppeal(appeal)}
                >
                  <Card
                    className={`bg-[#1E1F20] border-[#282A2C] cursor-pointer hover:border-[#8AB4F8] transition-colors ${
                      selectedAppeal?.id === appeal.id ? "border-[#8AB4F8]" : ""
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-[#E3E3E3]">{appeal.title}</h3>
                        <Badge variant="outline" className="text-xs">
                          {appeal.verdictsCount || 0}/5
                        </Badge>
                      </div>
                      <p className="text-sm text-[#9AA0A6] mb-2">
                        {appeal.nickname} • {appeal.faction}
                      </p>
                      <Badge className="bg-[#282A2C] text-[#9AA0A6]">
                        {appeal.category}
                      </Badge>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>

          {/* Appeal Details & Verdict */}
          <div className="lg:col-span-2">
            {selectedAppeal ? (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <Card className="bg-[#1E1F20] border-[#282A2C]">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{selectedAppeal.title}</span>
                      <Badge className="bg-[#282A2C] text-[#9AA0A6]">
                        {selectedAppeal.category}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-[#9AA0A6]">Никнейм:</span>
                        <p className="text-[#E3E3E3]">{selectedAppeal.nickname}</p>
                      </div>
                      <div>
                        <span className="text-[#9AA0A6]">Фракция:</span>
                        <p className="text-[#E3E3E3]">{selectedAppeal.faction}</p>
                      </div>
                      {selectedAppeal.contact && (
                        <div className="col-span-2">
                          <span className="text-[#9AA0A6]">Контакт:</span>
                          <p className="text-[#E3E3E3]">{selectedAppeal.contact}</p>
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="text-[#9AA0A6]">Сообщение:</span>
                      <p className="text-[#E3E3E3] mt-1 whitespace-pre-wrap">{selectedAppeal.message}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Current Verdicts */}
                {verdicts.length > 0 && (
                  <Card className="bg-[#1E1F20] border-[#282A2C]">
                    <CardHeader>
                      <CardTitle>Текущие вердикты ({verdicts.length}/5)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {verdicts.map((v: Verdict, idx: number) => {
                        const VerdictIcon = verdictLabels[v.verdict]?.icon || HelpCircle;
                        return (
                          <div key={idx} className="flex items-start gap-3 p-3 bg-[#282A2C] rounded-lg">
                            <VerdictIcon className={`h-5 w-5 mt-0.5 ${
                              v.verdict === 'guilty' ? 'text-red-500' : 
                              v.verdict === 'not_guilty' ? 'text-green-500' : 'text-yellow-500'
                            }`} />
                            <div className="flex-1">
                              <p className="font-medium">{verdictLabels[v.verdict]?.label || v.verdict}</p>
                              {v.reason && <p className="text-sm text-[#9AA0A6] mt-1">{v.reason}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                {/* Submit Verdict */}
                <Card className="bg-[#1E1F20] border-[#282A2C]">
                  <CardHeader>
                    <CardTitle>Вынести вердикт</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <RadioGroup value={verdict} onValueChange={setVerdict}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="guilty" id="guilty" />
                        <Label htmlFor="guilty" className="flex items-center gap-2 cursor-pointer">
                          <XCircle className="h-4 w-4 text-red-500" />
                          Виновен
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="not_guilty" id="not_guilty" />
                        <Label htmlFor="not_guilty" className="flex items-center gap-2 cursor-pointer">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          Не виновен
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="insufficient_evidence" id="insufficient" />
                        <Label htmlFor="insufficient" className="flex items-center gap-2 cursor-pointer">
                          <HelpCircle className="h-4 w-4 text-yellow-500" />
                          Недостаточно доказательств
                        </Label>
                      </div>
                    </RadioGroup>

                    <div>
                      <Label htmlFor="reason">Причина (необязательно)</Label>
                      <Textarea
                        id="reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Опишите причину вердикта..."
                        className="mt-1 bg-[#282A2C] border-[#3C4043] text-[#E3E3E3] placeholder:text-[#9AA0A6]"
                      />
                    </div>

                    <Button
                      onClick={handleSubmitVerdict}
                      disabled={submitVerdictMutation.isPending}
                      className="w-full bg-[#8AB4F8] hover:bg-[#7AA4E8] text-[#131314]"
                    >
                      {submitVerdictMutation.isPending ? "Отправка..." : "Отправить вердикт"}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <div className="flex items-center justify-center h-64 text-[#9AA0A6]">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Выберите жалобу для рассмотрения</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
