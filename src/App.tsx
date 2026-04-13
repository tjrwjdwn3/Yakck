import React, { useState, useRef } from "react";
import { Camera, Upload, Pill, Search, RefreshCw, Info, ExternalLink, ChevronRight, AlertCircle, X, CheckCircle2, Factory, Stethoscope, ClipboardList, ShieldAlert, Type as TypeIcon, Image as ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { analyzePillImage, PillAnalysis, getDrugDetail, DrugDetail } from "@/lib/gemini";

export default function App() {
  const [images, setImages] = useState<string[]>([]);
  const [manualMarkings, setManualMarkings] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<PillAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("camera");
  
  const [selectedDrug, setSelectedDrug] = useState<DrugDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    try {
      // Try with environment camera first
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setError(null);
    } catch (err: any) {
      console.error("Camera error (environment):", err);
      try {
        // Fallback to any available camera
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ 
          video: true 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
        }
        setError(null);
      } catch (fallbackErr: any) {
        console.error("Camera error (fallback):", fallbackErr);
        if (fallbackErr.name === "NotAllowedError" || fallbackErr.name === "PermissionDeniedError") {
          setError("카메라 권한이 거부되었습니다. 브라우저 주소창 옆의 자물쇠 아이콘을 클릭하여 카메라 권한을 '허용'으로 변경하거나, 앱을 '새 탭에서 열기'로 실행해 주세요.");
        } else {
          setError("카메라를 시작할 수 없습니다. 카메라가 연결되어 있는지 확인해 주세요.");
        }
      }
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg");
        setImages(prev => [...prev, dataUrl]);
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          setImages(prev => [...prev, dataUrl]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleAnalyze = async (isAdditionalSearch = false) => {
    if (images.length === 0) return;
    setIsAnalyzing(true);
    setError(null);
    stopCamera();
    try {
      const result = await analyzePillImage(images, isAdditionalSearch ? manualMarkings : undefined);
      setAnalysis(result);
    } catch (err) {
      console.error("Analysis error:", err);
      setError("이미지 분석 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDrugClick = async (drugName: string) => {
    setIsLoadingDetail(true);
    try {
      const detail = await getDrugDetail(drugName);
      setSelectedDrug(detail);
    } catch (err) {
      console.error("Detail error:", err);
      setError("상세 정보를 가져오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const reset = () => {
    setImages([]);
    setManualMarkings("");
    setAnalysis(null);
    setError(null);
    setSelectedDrug(null);
    if (activeTab === "camera") {
      startCamera();
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 selection:bg-cyan-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/50">
        <div className="max-w-lg mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-cyan-600 rounded-2xl flex items-center justify-center shadow-xl shadow-cyan-200/50 rotate-3">
              <Pill className="text-white w-7 h-7 -rotate-3" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">약찾자</h1>
              <p className="text-[10px] uppercase tracking-widest font-bold text-cyan-600/60">Pill Identifier AI</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={reset} className="rounded-2xl hover:bg-slate-100 transition-all active:scale-90">
            <RefreshCw className="w-5 h-5 text-slate-400" />
          </Button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8 pb-32">
        <AnimatePresence mode="wait">
          {!analysis ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">무슨 약인가요?</h2>
                <p className="text-slate-500 text-lg">사진을 찍거나 업로드하여 약을 식별하세요.</p>
              </div>

              <Tabs value={activeTab} onValueChange={(v) => {
                setActiveTab(v);
                if (v === "camera") startCamera();
                else stopCamera();
              }} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-slate-200/50 p-1.5 rounded-2xl">
                  <TabsTrigger value="camera" className="rounded-xl py-3 data-[state=active]:bg-white data-[state=active]:shadow-md transition-all">
                    <Camera className="w-4 h-4 mr-2" /> 카메라
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="rounded-xl py-3 data-[state=active]:bg-white data-[state=active]:shadow-md transition-all">
                    <Upload className="w-4 h-4 mr-2" /> 갤러리
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="camera" className="mt-8 focus-visible:outline-none">
                  <div className="relative aspect-[4/5] bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-slate-200 border-[8px] border-white group">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-64 h-64 border-2 border-dashed border-white/20 rounded-full animate-[pulse_4s_infinite]" />
                      <div className="absolute w-full h-[1px] bg-cyan-500/30 top-1/2 -translate-y-1/2" />
                      <div className="absolute h-full w-[1px] bg-cyan-500/30 left-1/2 -translate-x-1/2" />
                    </div>
                    <div className="absolute bottom-10 left-0 right-0 flex justify-center">
                      <button 
                        onClick={capturePhoto}
                        className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-md p-1.5 shadow-2xl active:scale-90 transition-all hover:bg-white/30"
                      >
                        <div className="w-full h-full rounded-full border-[6px] border-white flex items-center justify-center">
                          <div className="w-14 h-14 rounded-full bg-white" />
                        </div>
                      </button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="upload" className="mt-8 focus-visible:outline-none">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-[4/5] border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-6 bg-white hover:bg-slate-50 transition-all cursor-pointer group shadow-sm"
                  >
                    <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center group-hover:bg-cyan-50 transition-all group-hover:scale-110 group-hover:rotate-6">
                      <Upload className="w-10 h-10 text-slate-300 group-hover:text-cyan-600" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="font-bold text-xl text-slate-800">사진 라이브러리</p>
                      <p className="text-slate-400">여러 장의 사진을 선택할 수 있습니다</p>
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      accept="image/*" 
                      multiple
                      className="hidden" 
                    />
                  </div>
                </TabsContent>
              </Tabs>

              {/* Image Preview List */}
              <AnimatePresence>
                {images.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-6"
                  >
                    <div className="flex items-end justify-between px-1">
                      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-cyan-600" /> 촬영된 사진 <span className="text-cyan-600">{images.length}</span>
                      </h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">앞/뒷면 모두 촬영 권장</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {images.map((img, i) => (
                        <motion.div 
                          key={i} 
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="relative aspect-square rounded-2xl overflow-hidden border-2 border-white shadow-md group"
                        >
                          <img src={img} className="w-full h-full object-cover" />
                          <button 
                            onClick={() => removeImage(i)}
                            className="absolute top-2 right-2 bg-black/40 backdrop-blur-md text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                    <Button 
                      onClick={() => handleAnalyze(false)} 
                      disabled={isAnalyzing}
                      className="w-full bg-cyan-600 hover:bg-cyan-700 text-white rounded-2xl h-16 text-lg font-bold shadow-xl shadow-cyan-200/50 transition-all active:scale-[0.98]"
                    >
                      {isAnalyzing ? (
                        <span className="flex items-center gap-3">
                          <RefreshCw className="w-5 h-5 animate-spin" /> 인공지능 분석 중...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          의약품 분석 시작 <ChevronRight className="w-5 h-5" />
                        </span>
                      )}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="space-y-8"
            >
              {error && (
                <Card className="border-none bg-red-50/50 rounded-3xl overflow-hidden">
                  <CardContent className="p-6 flex items-start gap-4">
                    <div className="w-10 h-10 bg-red-100 rounded-2xl flex items-center justify-center shrink-0">
                      <AlertCircle className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <p className="font-bold text-red-900">분석 오류</p>
                      <p className="text-sm text-red-700/80 leading-relaxed">{error}</p>
                      <Button variant="link" onClick={reset} className="p-0 h-auto text-red-600 text-xs mt-2 font-bold">다시 시도하기</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {analysis && (
                <div className="space-y-8">
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">분석 결과</h2>
                    <p className="text-slate-500 text-lg">가장 가능성 높은 의약품들입니다.</p>
                  </div>

                  {/* Visual Features Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "모양", value: analysis.shape, icon: Pill },
                      { label: "색상", value: analysis.color, icon: ImageIcon },
                      { label: "식별표시", value: analysis.markings, icon: TypeIcon },
                      { label: "제형", value: analysis.formulation, icon: Info },
                    ].map((item, i) => (
                      <Card key={i} className="border-none shadow-sm bg-white rounded-3xl p-5 space-y-3">
                        <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                          <item.icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">{item.label}</p>
                          <p className="font-bold text-slate-800 truncate">{item.value}</p>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Manual Marking Input */}
                  <Card className="border-none bg-cyan-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-cyan-200">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                          <TypeIcon className="w-5 h-5" /> 직접 입력하기
                        </h3>
                        <p className="text-cyan-100 text-sm leading-relaxed">
                          약에 적힌 문구(예: TY, 500)를 직접 입력하면 더 정확한 결과를 얻을 수 있습니다.
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <input 
                          type="text" 
                          value={manualMarkings}
                          onChange={(e) => setManualMarkings(e.target.value)}
                          placeholder="문구 입력..."
                          className="flex-1 bg-white/10 border border-white/20 rounded-2xl px-5 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
                        />
                        <Button 
                          onClick={() => handleAnalyze(true)}
                          disabled={isAnalyzing || !manualMarkings}
                          className="bg-white text-cyan-600 hover:bg-cyan-50 rounded-2xl px-6 font-bold h-auto shadow-lg"
                        >
                          검색
                        </Button>
                      </div>
                    </div>
                  </Card>

                  {/* Possible Drugs List */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-xl font-bold text-slate-900">의약품 후보</h3>
                      <Badge className="bg-cyan-100 text-cyan-700 border-none px-3 py-1 font-bold text-[10px]">약학정보원 우선</Badge>
                    </div>
                    
                    <div className="space-y-3">
                      {analysis.possibleNames.map((name, i) => (
                        <motion.div
                          key={name}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1 }}
                        >
                          <button 
                            onClick={() => handleDrugClick(name)}
                            className="w-full text-left bg-white border border-slate-100 rounded-3xl p-6 flex items-center justify-between group hover:border-cyan-200 hover:shadow-xl hover:shadow-cyan-100/20 transition-all active:scale-[0.98]"
                          >
                            <div className="flex items-center gap-5">
                              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:bg-cyan-600 group-hover:text-white transition-all group-hover:rotate-6">
                                <Pill className="w-7 h-7" />
                              </div>
                              <div>
                                <p className="text-lg font-bold text-slate-900 group-hover:text-cyan-700 transition-colors">{name}</p>
                                <p className="text-sm text-slate-400">약학정보원 등록 의약품</p>
                              </div>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-cyan-50 group-hover:text-cyan-600 transition-all">
                              <ChevronRight className="w-6 h-6" />
                            </div>
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <Button onClick={reset} variant="outline" className="w-full border-slate-200 text-slate-600 rounded-2xl h-16 text-lg font-bold hover:bg-slate-50 transition-all">
                    처음으로 돌아가기
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Drug Detail Dialog */}
      <Dialog open={!!selectedDrug} onOpenChange={(open) => !open && setSelectedDrug(null)}>
        <DialogContent className="max-w-4xl w-[98vw] h-[95vh] rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col bg-white">
          {selectedDrug && (
            <>
              {/* Fixed Header */}
              <div className="bg-cyan-600 p-10 text-white shrink-0 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <Badge className="bg-white/20 text-white border-none hover:bg-white/30 text-xs py-1.5 px-4 rounded-full backdrop-blur-md font-bold tracking-wider">KPTIC OFFICIAL DATA</Badge>
                    <button onClick={() => setSelectedDrug(null)} className="text-white/60 hover:text-white transition-all hover:rotate-90">
                      <X className="w-10 h-10" />
                    </button>
                  </div>
                  <h2 className="text-4xl font-black mb-3 tracking-tight">{selectedDrug.name}</h2>
                  <p className="text-cyan-100 text-lg flex items-center gap-2 font-medium">
                    <Factory className="w-5 h-5" /> {selectedDrug.manufacturer}
                  </p>
                </div>
              </div>
              
              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto px-10 py-8 bg-white custom-scrollbar">
                <div className="space-y-12 pb-12">
                  <section className="space-y-6">
                    <h3 className="text-xs font-black text-slate-300 uppercase tracking-[0.3em] flex items-center gap-3">
                      <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full" /> 외형 설명
                    </h3>
                    <p className="text-xl text-slate-700 leading-relaxed font-medium italic bg-slate-50 p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                      "{selectedDrug.appearance}"
                    </p>
                  </section>

                  <section className="space-y-6">
                    <h3 className="text-xs font-black text-slate-300 uppercase tracking-[0.3em] flex items-center gap-3">
                      <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full" /> 효능 및 효과
                    </h3>
                    <div className="text-xl text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                      {selectedDrug.efficacy}
                    </div>
                  </section>

                  <section className="space-y-6">
                    <h3 className="text-xs font-black text-slate-300 uppercase tracking-[0.3em] flex items-center gap-3">
                      <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full" /> 용법 및 용량
                    </h3>
                    <div className="text-xl text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                      {selectedDrug.usage}
                    </div>
                  </section>

                  <section className="space-y-6">
                    <h3 className="text-xs font-black text-red-400 uppercase tracking-[0.3em] flex items-center gap-3">
                      <div className="w-1.5 h-1.5 bg-red-400 rounded-full" /> 주의사항
                    </h3>
                    <div className="text-xl text-slate-700 leading-relaxed bg-red-50/30 p-10 rounded-[2.5rem] border border-red-100 shadow-sm whitespace-pre-wrap font-medium">
                      {selectedDrug.precautions}
                    </div>
                  </section>
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="p-10 bg-slate-50 border-t border-slate-100 grid grid-cols-2 gap-6 shrink-0">
                <Button 
                  variant="outline" 
                  className="bg-white border-slate-200 text-slate-700 h-20 text-xl font-bold rounded-3xl hover:bg-slate-100 transition-all"
                  onClick={() => window.open(`https://www.health.kr/searchDrug/search_detail.asp?itemName=${selectedDrug.name}`, "_blank")}
                >
                  약학정보원 검색 <ExternalLink className="w-6 h-6 ml-3" />
                </Button>
                <Button 
                  className="bg-cyan-600 hover:bg-cyan-700 text-white h-20 text-xl font-bold rounded-3xl shadow-2xl shadow-cyan-200 transition-all active:scale-95"
                  onClick={() => setSelectedDrug(null)}
                >
                  확인
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Footer Disclaimer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/70 backdrop-blur-xl border-t border-slate-100 p-6 z-40">
        <div className="max-w-lg mx-auto flex items-start gap-3 text-[11px] text-slate-400 leading-relaxed">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-slate-300" />
          <p>
            본 서비스의 분석 결과는 참고용이며, 정확한 복약 지도는 반드시 의사 또는 약사와 상담하십시오. 
            <span className="font-bold text-slate-500"> 약학정보원(KPTIC)</span> 및 식약처(MFDS)의 공공데이터를 기반으로 AI가 분석합니다.
          </p>
        </div>
      </footer>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
