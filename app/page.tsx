"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";

type GameState = "entry" | "playing" | "paused" | "completed";

interface Card {
  id: number;
  fruit: string;
  isFlipped: boolean;
  isMatched: boolean;
}

const FRUITS = [
  { name: "apple", icon: "/images/fruits/apple.png", fallback: "🍎" },
  { name: "banana", icon: "/images/fruits/banana.png", fallback: "🍌" },
  { name: "orange", icon: "/images/fruits/orange.png", fallback: "🍊" },
  { name: "strawberry", icon: "/images/fruits/strawberry.png", fallback: "🍓" },
  { name: "grapes", icon: "/images/fruits/grapes.png", fallback: "🍇" },
  { name: "watermelon", icon: "/images/fruits/watermelon.png", fallback: "🍉" },
  { name: "pineapple", icon: "/images/fruits/pineapple.png", fallback: "🍍" },
  { name: "kiwi", icon: "/images/fruits/kiwi.png", fallback: "🥝" },
];

export default function Home() {
  const [username, setUsername] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [topRecords, setTopRecords] = useState<{name: string, finishTime: string}[]>([]);
  const [showRecordsModal, setShowRecordsModal] = useState(false);
  
  // --- 구글 스프레드시트 연동 설정 ---
  // 최종 반영된 개선된 통합 웹 앱 URL입니다.
  const GAS_URL = "https://script.google.com/macros/s/AKfycbxqp8rekgWqLBLItKSkCzClIsZOq2iVZPo7mGdoWAf8NSzmmeWcm8G7aLa2pEW1pwLE/exec"; 

  const saveGameResult = useCallback(async (name: string, time: string) => {
    if (!GAS_URL) {
      console.warn("GAS_URL이 설정되지 않았습니다.");
      return;
    }
    
    setIsSaving(true);
    setSaveStatus("saving");
    
    try {
      // GAS 웹 앱은 리다이렉션을 사용하므로 mode: 'no-cors'가 가장 간단한 연동 방법입니다.
      await fetch(GAS_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name,
          finishTime: time, // '01:23' 형태의 기록 시간
        }),
      });
      console.log("성공: 결과가 스프레드시트에 전송되었습니다.");
      setSaveStatus("success");
    } catch (error) {
      console.error("실패: 결과 전송 중 오류가 발생했습니다.", error);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
      // 저장 후 최신 기록 다시 불러오기
      fetchTopRecords();
    }
  }, []);

  const fetchTopRecords = useCallback(async () => {
    if (!GAS_URL) return;
    try {
      const response = await fetch(GAS_URL);
      const data = await response.json();
      if (Array.isArray(data)) {
        setTopRecords(data);
      }
    } catch (error) {
      console.error("실패: TOP 3 기록을 불러오는데 실패했습니다.", error);
    }
  }, []);

  const [gameState, setGameState] = useState<GameState>("entry");
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [moves, setMoves] = useState(0);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize and Shuffle Cards
  const initializeCards = useCallback(() => {
    const shuffledFruits = [...FRUITS, ...FRUITS]
      .sort(() => Math.random() - 0.5)
      .map((fruit, index) => ({
        id: index,
        fruit: fruit.name,
        isFlipped: false,
        isMatched: false,
      }));
    setCards(shuffledFruits);
    setFlippedCards([]);
    setElapsedTime(0);
    setMoves(0);
  }, []);

  // Timer Logic
  useEffect(() => {
    if (gameState === "playing") {
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState]);

  // 게임 완료 시 자동 저장 트리거
  useEffect(() => {
    if (gameState === "completed") {
      saveGameResult(username, formatTime(elapsedTime));
      fetchTopRecords(); // 완료 시 기록 불러오기 시작
    }
  }, [gameState, username, elapsedTime, saveGameResult, fetchTopRecords]);

  const handleStartGame = () => {
    if (!username.trim()) return;
    initializeCards();
    setGameState("playing");
  };

  const handleStop = () => {
    setGameState("paused");
  };

  const handleResume = () => {
    setGameState("playing");
  };

  const handleReset = () => {
    initializeCards();
    setGameState("playing");
    setSaveStatus("idle");
  };

  const handleHome = () => {
    setGameState("entry");
    setSaveStatus("idle");
  };

  const handleCardClick = (id: number) => {
    if (gameState !== "playing" || flippedCards.length === 2) return;
    
    const card = cards.find((c) => c.id === id);
    if (!card || card.isFlipped || card.isMatched) return;

    const newCards = cards.map((c) =>
      c.id === id ? { ...c, isFlipped: true } : c
    );
    setCards(newCards);

    const newFlipped = [...flippedCards, id];
    setFlippedCards(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(prev => prev + 1);
      const [firstId, secondId] = newFlipped;
      const firstCard = cards.find((c) => c.id === firstId)!;
      const secondCard = newCards.find((c) => c.id === secondId)!;

      if (firstCard.fruit === secondCard.fruit) {
        // Match found
        setTimeout(() => {
          // Refined check
          setCards(prev => {
            const nextCards = prev.map(c => 
              c.id === firstId || c.id === secondId ? { ...c, isMatched: true } : c
            );
            if (nextCards.every(c => c.isMatched)) {
              setGameState("completed");
            }
            return nextCards;
          });
          setFlippedCards([]);
        }, 500);
      } else {
        // No match
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c) =>
              c.id === firstId || c.id === secondId
                ? { ...c, isFlipped: false }
                : c
            )
          );
          setFlippedCards([]);
        }, 1000);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/30">
      {/* Header */}
      <nav className="flex justify-between items-center px-12 py-6 border-b border-white/5">
        <div className="text-xl font-black tracking-tighter text-white">
          ANTIGRAVITY
        </div>
        <div className="flex gap-8 text-sm font-bold tracking-widest text-zinc-500">
          <button className="text-secondary border-b-2 border-secondary pb-1">미션</button>
          <button className="hover:text-white transition-colors">아카이브</button>
          <button className="hover:text-white transition-colors">보이드 맵</button>
        </div>
        <div className="flex items-center gap-6 text-zinc-400">
           <button className="hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
           </button>
           <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden border border-white/10">
              <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-900" />
           </div>
        </div>
      </nav>

      <main className="flex-1 flex items-center justify-center p-8">
        {gameState === "entry" ? (
          <div className="max-w-2xl w-full mission-card relative overflow-hidden animate-fadeIn py-16 px-12">
            {/* Absolute Background Hex */}
            <div className="absolute top-8 right-8 text-secondary/10">
              <svg className="w-32 h-32" viewBox="0 0 100 100" fill="currentColor">
                <path d="M50 0L93.3 25V75L50 100L6.7 75V25L50 0z" />
              </svg>
            </div>

            <div className="flex flex-col gap-8 relative z-10">
              <div>
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 text-secondary text-[10px] font-black tracking-widest uppercase mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                  시스템 온라인
                </span>
                <h1 className="text-6xl font-bold leading-tight mb-4">
                  안티그래비티<br />
                  <span className="text-primary glow-purple">카드 게임</span>
                </h1>
                <p className="text-zinc-500 text-lg max-w-md leading-relaxed">
                  무중력 공간에서 과일 매트릭스를 복구하세요. 짝을 맞춰 시스템을 안정시키고 데이터 붕괴를 막으세요.
                </p>
              </div>

              <div className="flex flex-col gap-6 max-w-md mt-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black tracking-widest text-zinc-600 uppercase ml-1">요원 이름 입력</label>
                  <div className="relative">
                    <input
                      type="text"
                      className="cyber-input text-lg font-mono"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-700">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 3c1.223 0 2.39.22 3.47.621m2.91 3.447l.09.054M20.312 17c.148-.594.227-1.214.227-1.85a10.05 10.05 0 00-2.018-6.006m-7.162 11.723a10.039 10.039 0 002.583-1.077M4.772 11.231C4.92 10.637 5 10.017 5 9.382a10.05 10.05 0 012.018-6.006m7.162 11.723s.995-1.129 1.638-3.323" /></svg>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <button
                    onClick={handleStartGame}
                    disabled={!username.trim()}
                    className="cyber-button cyber-button-purple flex-1 py-5 text-lg"
                  >
                    미션 시작
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                  </button>
                  <div className="text-zinc-700 font-bold text-xs uppercase tracking-widest">혹은</div>
                  <button 
                    onClick={() => {
                      setShowRecordsModal(true);
                      fetchTopRecords();
                    }}
                    className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    기록 검토
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-end mt-12 border-t border-white/5 pt-8">
                <div>
                  <div className="text-[10px] font-black tracking-widest text-zinc-600 uppercase mb-1">중력 레벨</div>
                  <div className="text-sm font-bold text-white">0.00 G</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black tracking-widest text-zinc-600 uppercase mb-1">상태</div>
                  <div className="text-sm font-bold text-secondary glow-cyan">입력 대기 중</div>
                </div>
              </div>
            </div>

            {/* Records Modal in Entry Screen */}
            {showRecordsModal && (
              <div className="fixed inset-0 bg-background/90 backdrop-blur-xl flex items-center justify-center z-50 p-4 animate-fadeIn">
                <div className="max-w-md w-full mission-card p-12 text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-secondary to-transparent" />
                  <div className="text-secondary mb-4 font-black tracking-[0.3em] uppercase text-xs">본부 데이터베이스</div>
                  <h2 className="text-4xl font-bold mb-8">최우수 요원 기록</h2>
                  
                  <div className="mb-10 p-6 bg-white/5 rounded-2xl border border-white/5 relative overflow-hidden text-left">
                    <div className="flex flex-col gap-4">
                      {topRecords.length > 0 ? (
                        topRecords.map((record, index) => (
                          <div key={index} className="flex justify-between items-center animate-fadeIn" style={{ animationDelay: `${index * 100}ms` }}>
                            <div className="flex items-center gap-4">
                              <div className={`w-6 h-6 flex items-center justify-center rounded text-[10px] font-black ${
                                index === 0 ? "bg-secondary text-background glow-cyan" : 
                                index === 1 ? "bg-primary text-white" : 
                                "bg-zinc-800 text-zinc-400"
                              }`}>
                                0{index + 1}
                              </div>
                              <span className="font-bold text-zinc-300 tracking-tight">{record.name}</span>
                            </div>
                            <span className="font-mono text-secondary text-sm">{record.finishTime}</span>
                          </div>
                        ))
                      ) : (
                        <div className="flex flex-col items-center gap-2 py-4">
                          <div className="w-6 h-6 border-2 border-secondary/20 border-t-secondary rounded-full animate-spin" />
                          <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">데이터 동기화 중...</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button 
                    onClick={() => setShowRecordsModal(false)}
                    className="cyber-button cyber-button-outline w-full py-4 text-xs font-black tracking-widest uppercase"
                  >
                    데이터베이스 연결 해제
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex gap-12 w-full max-w-6xl animate-fadeIn">
            {/* Sidebar */}
            <div className="w-64 flex flex-col gap-6">
              <div className="mission-card flex flex-col gap-2">
                <div className="text-[10px] font-black tracking-widest text-zinc-600 uppercase">경과 시간</div>
                <div className="text-5xl font-mono font-bold text-secondary glow-cyan">{formatTime(elapsedTime)}</div>
              </div>
              
              <div className="mission-card flex flex-col gap-2">
                <div className="text-[10px] font-black tracking-widest text-zinc-600 uppercase">기록된 이동</div>
                <div className="text-5xl font-mono font-bold text-primary glow-purple">{moves}</div>
              </div>

              <div className="mt-auto flex flex-col gap-4 pt-12">
                <button 
                   onClick={gameState === "playing" ? handleStop : handleResume}
                   className="cyber-button cyber-button-outline py-4"
                >
                  <span className={gameState === "playing" ? "w-2 h-2 bg-red-500 rounded-sm" : "w-0 h-0 border-l-[6px] border-l-green-500 border-y-[4px] border-y-transparent ml-1"} />
                  {gameState === "playing" ? "중단" : "재개"}
                </button>
                <button 
                  onClick={handleReset}
                  className="cyber-button cyber-button-outline py-4"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  초기화
                </button>
                <button onClick={handleHome} className="text-center text-[10px] font-black tracking-widest text-zinc-600 hover:text-white transition-colors uppercase mt-4">
                  미션 포기
                </button>
              </div>
            </div>

            {/* Game Board */}
            <div className="flex-1">
              <div className={`grid grid-cols-4 gap-6 aspect-square max-w-[600px] mx-auto ${gameState === "paused" ? "opacity-30 blur-md" : ""}`}>
                {cards.map((card) => (
                  <div
                    key={card.id}
                    onClick={() => handleCardClick(card.id)}
                    className={`card-outer aspect-square cursor-pointer group ${card.isFlipped || card.isMatched ? "card-flipped" : ""}`}
                  >
                    <div className="card-inner w-full h-full">
                      <div className="card-front">
                        <div className="chip-icon" />
                      </div>
                      <div className={`card-back ${card.isMatched ? "border-primary/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]" : ""}`}>
                        <div className="relative w-full h-full">
                          <Image
                            src={FRUITS.find(f => f.name === card.fruit)!.icon}
                            alt={card.fruit}
                            fill
                            className="object-contain"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {gameState === "paused" && (
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center items-center pointer-events-none">
                   <div className="mission-card py-8 px-12 pointer-events-auto">
                      <h2 className="text-3xl font-bold mb-6 text-center">시스템 일시 정지</h2>
                      <button onClick={handleResume} className="cyber-button cyber-button-purple w-full">
                         미션 재개
                      </button>
                   </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Completion Modal */}
      {gameState === "completed" && (
        <div className="fixed inset-0 bg-background/90 backdrop-blur-xl flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="max-w-md w-full mission-card p-12 text-center relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
             <div className="text-secondary mb-4 font-black tracking-[0.3em] uppercase text-xs">미션 완료</div>
             <h2 className="text-5xl font-bold mb-8">안정화 완료</h2>
             
             <div className="flex flex-col gap-6 mb-12">
                <div className="flex justify-between items-center border-b border-white/5 pb-4">
                   <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">시간</span>
                   <span className="text-3xl font-mono font-bold text-secondary glow-cyan">{formatTime(elapsedTime)}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/5 pb-4">
                   <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">이동 횟수</span>
                   <span className="text-3xl font-mono font-bold text-primary glow-purple">{moves}</span>
                </div>
             </div>

             {/* Saving Status UI */}
             <div className="mb-8 flex flex-col items-center justify-center gap-2 h-6">
                {saveStatus === "saving" && (
                   <div className="flex items-center gap-2 text-primary animate-pulse">
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      <span className="text-[10px] font-black tracking-widest uppercase">결과 기록 중...</span>
                   </div>
                )}
                {saveStatus === "success" && (
                   <div className="flex items-center gap-2 text-secondary animate-fadeIn">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      <span className="text-[10px] font-black tracking-widest uppercase">기록 완료</span>
                   </div>
                )}
                {saveStatus === "error" && (
                   <div className="flex items-center gap-2 text-red-500 animate-fadeIn">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span className="text-[10px] font-black tracking-widest uppercase">기록 실패 (GAS_URL 확인 필)</span>
                   </div>
                )}
             </div>

             {/* TOP 3 leaderboard */}
             <div className="mb-10 p-6 bg-white/5 rounded-2xl border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 text-secondary/5 -mr-4 -mt-4">
                  <svg viewBox="0 0 100 100" fill="currentColor"><path d="M50 0L93.3 25V75L50 100L6.7 75V25L50 0z" /></svg>
                </div>
                <div className="text-[10px] font-black tracking-widest text-zinc-600 uppercase mb-5 text-left flex items-center gap-2">
                   <span className="w-1 h-1 bg-secondary rounded-full" />
                   명예의 전당 TOP 3
                </div>
                <div className="flex flex-col gap-4">
                   {topRecords.length > 0 ? (
                      topRecords.map((record, index) => (
                         <div key={index} className="flex justify-between items-center animate-fadeIn" style={{ animationDelay: `${index * 100}ms` }}>
                            <div className="flex items-center gap-4">
                               <div className={`w-6 h-6 flex items-center justify-center rounded text-[10px] font-black ${
                                  index === 0 ? "bg-secondary text-background glow-cyan" : 
                                  index === 1 ? "bg-primary text-white" : 
                                  "bg-zinc-800 text-zinc-400"
                               }`}>
                                  0{index + 1}
                               </div>
                               <span className="font-bold text-zinc-300 tracking-tight">{record.name}</span>
                            </div>
                            <span className="font-mono text-secondary text-sm">{record.finishTime}</span>
                         </div>
                      ))
                   ) : (
                      <div className="flex flex-col items-center gap-2 py-2">
                         <div className="w-4 h-4 border-2 border-secondary/20 border-t-secondary rounded-full animate-spin" />
                         <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">기록 분석 중...</span>
                      </div>
                   )}
                </div>
             </div>

             <div className="flex flex-col gap-4">
                <button onClick={handleReset} className="cyber-button cyber-button-purple py-4">
                   새 미션
                </button>
                <button onClick={handleHome} className="cyber-button cyber-button-outline py-4">
                   본부로 귀환
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
