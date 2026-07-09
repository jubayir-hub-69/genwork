"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { CONTRACT_ADDRESS } from "./constants";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const genlayerClient = createClient({ chain: studionet });

const toWeiHex = (eth: string) => {
  const [whole, fraction = ""] = eth.split(".");
  const paddedFraction = fraction.padEnd(18, "0").slice(0, 18);
  const weiString = whole + paddedFraction;
  return "0x" + BigInt(weiString).toString(16);
};

// -------------------------------------------------------------
// 🌌 Animated Background Component
// -------------------------------------------------------------
const AnimatedBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w: number, h: number, dpr: number, cx: number, cy: number, bgGradient: CanvasGradient;
    let nodes: any[] = [];
    let pulses: any[] = [];
    let rings: any[] = [];
    let nextPulseAt = 1100;
    let startTime: number | null = null;
    let animId: number;

    const COLORS = {
      accent: [17, 15, 255],
      lilac: [188, 162, 255],
      grey: [202, 202, 202],
      white: [255, 255, 255],
      indigo: [40, 43, 93]
    };

    const rgba = (c: number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const lerpColor = (c1: number[], c2: number[], t: number) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
    const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const dist = (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x1 - x2, y1 - y2);

    const mouse = { x: 0, y: 0, active: false };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cx = w / 2;
      cy = h / 2;

      const radius = Math.max(w, h) * 0.75;
      bgGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      bgGradient.addColorStop(0, "#0d0d16");
      bgGradient.addColorStop(0.45, "#08080b");
      bgGradient.addColorStop(1, "#000000");

      initNodes();
    };

    const initNodes = () => {
      const area = w * h;
      const count = Math.max(46, Math.min(130, Math.round(area / 15500)));
      nodes = [];
      for (let i = 0; i < count; i++) {
        const depth = 0.45 + Math.random() * 0.65;
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.18 * depth,
          vy: (Math.random() - 0.5) * 0.18 * depth,
          r: (1.1 + Math.random() * 1.6) * depth,
          depth: depth,
          baseAlpha: 0.42 + 0.5 * depth,
          boost: 0,
          rx: 0, ry: 0
        });
      }
    };

    const spawnConsensusEvent = (now: number) => {
      if (nodes.length < 6) return;
      const k = 3 + Math.floor(Math.random() * 3);
      const chosen: number[] = [];
      let tries = 0;
      while (chosen.length < k && tries < 60) {
        tries++;
        const idx = Math.floor(Math.random() * nodes.length);
        if (chosen.indexOf(idx) !== -1) continue;
        const n = nodes[idx];
        const d = dist(n.x, n.y, cx, cy);
        if (d > Math.min(w, h) * 0.16 && d < Math.max(w, h) * 0.62) chosen.push(idx);
      }
      for (let i = 0; i < chosen.length; i++) {
        const idx2 = chosen[i];
        const node = nodes[idx2];
        const delay = i * 130;
        pulses.push({
          nodeIdx: idx2,
          x0: node.x, y0: node.y,
          start: now + delay,
          activateStart: now + delay - 260,
          duration: 900 + Math.random() * 260,
          color: Math.random() < 0.5 ? COLORS.accent : COLORS.lilac,
          arrived: false
        });
      }
    };

    const drawFrame = (now: number) => {
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx; n.y += n.vy;
        if (n.x < -30) n.x = w + 30; else if (n.x > w + 30) n.x = -30;
        if (n.y < -30) n.y = h + 30; else if (n.y > h + 30) n.y = -30;
        
        n.rx = n.x; n.ry = n.y;
        if (mouse.active) {
          const dx = n.x - mouse.x;
          const dy = n.y - mouse.y;
          const d0 = Math.hypot(dx, dy);
          const influence = 150;
          if (d0 < influence && d0 > 0.01) {
            const f = (1 - d0 / influence) * 16;
            n.rx += (dx / d0) * f;
            n.ry += (dy / d0) * f;
          }
        }
        n.boost *= 0.92;
      }

      for (let p1 = 0; p1 < pulses.length; p1++) {
        const pl = pulses[p1];
        if (now >= pl.activateStart && now < pl.start) {
          const ramp = (now - pl.activateStart) / (pl.start - pl.activateStart);
          nodes[pl.nodeIdx].boost = Math.max(nodes[pl.nodeIdx].boost, ramp);
        } else if (now >= pl.start && !pl.arrived) {
          nodes[pl.nodeIdx].boost = 1;
        }
      }

      const maxDist = Math.min(190, Math.max(110, Math.min(w, h) * 0.14));
      ctx.lineWidth = 1;
      for (let a = 0; a < nodes.length; a++) {
        for (let b = a + 1; b < nodes.length; b++) {
          const na = nodes[a], nb = nodes[b];
          const d1 = dist(na.rx, na.ry, nb.rx, nb.ry);
          if (d1 < maxDist) {
            const alpha = (1 - d1 / maxDist) * 0.68 * Math.min(na.depth, nb.depth);
            if (alpha < 0.01) continue;
            const boostMix = Math.max(na.boost, nb.boost);
            const col = boostMix > 0.05 ? lerpColor(COLORS.indigo, COLORS.lilac, boostMix) : lerpColor(COLORS.indigo, COLORS.accent, 0.2);
            ctx.strokeStyle = rgba(col, alpha * (0.55 + 0.7 * boostMix));
            ctx.beginPath();
            ctx.moveTo(na.rx, na.ry);
            ctx.lineTo(nb.rx, nb.ry);
            ctx.stroke();
          }
        }
      }

      for (let ni = 0; ni < nodes.length; ni++) {
        const nn = nodes[ni];
        const nalpha = Math.min(1, nn.baseAlpha + nn.boost * 0.6);
        const ncol = nn.boost > 0.05 ? lerpColor(COLORS.grey, COLORS.white, nn.boost) : COLORS.grey;
        ctx.beginPath();
        ctx.fillStyle = rgba(ncol, nalpha);
        ctx.arc(nn.rx, nn.ry, nn.r * (1 + nn.boost * 0.8), 0, Math.PI * 2);
        ctx.fill();
      }

      for (let pi = pulses.length - 1; pi >= 0; pi--) {
        const p = pulses[pi];
        if (now < p.start) continue;
        const t2 = Math.min(1, (now - p.start) / p.duration);
        const eased = easeInOutCubic(t2);
        const tail = 5;
        for (let s = tail; s >= 0; s--) {
          const tt = Math.max(0, eased - s * 0.045);
          const x = lerp(p.x0, cx, tt);
          const y = lerp(p.y0, cy, tt);
          const a2 = (1 - s / tail) * 0.9;
          ctx.beginPath();
          ctx.fillStyle = rgba(p.color, a2 * 0.85);
          ctx.arc(x, y, Math.max(0.6, 2.6 * (1 - s / (tail + 2))), 0, Math.PI * 2);
          ctx.fill();
        }
        if (t2 >= 1 && !p.arrived) {
          p.arrived = true;
          rings.push({ start: now, duration: 700, color: p.color });
        }
        if (t2 >= 1) pulses.splice(pi, 1);
      }

      for (let ri = rings.length - 1; ri >= 0; ri--) {
        const rg = rings[ri];
        const t3 = (now - rg.start) / rg.duration;
        if (t3 >= 1) { rings.splice(ri, 1); continue; }
        const radius2 = lerp(4, 92, t3);
        const ralpha = (1 - t3) * 0.55;
        ctx.beginPath();
        ctx.strokeStyle = rgba(rg.color, ralpha);
        ctx.lineWidth = 1.4;
        ctx.arc(cx, cy, radius2, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    const step = (now: number) => {
      if (!startTime) startTime = now;
      const t = now - startTime;
      if (t > nextPulseAt) {
        spawnConsensusEvent(now);
        nextPulseAt = t + 2600 + Math.random() * 2200;
      }
      drawFrame(now);
      animId = requestAnimationFrame(step);
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    };
    
    const handlePointerLeave = () => {
      mouse.active = false;
    };

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerleave", handlePointerLeave);
    
    resize();
    animId = requestAnimationFrame(step);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      cancelAnimationFrame(animId);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full z-[-1] pointer-events-auto" />;
};
// -------------------------------------------------------------

export default function Home() {
  const { address, isConnected } = useAccount();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState("post");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const [toast, setToast] = useState<{ message: string; tx: string; type: 'success'|'error'|'info' } | null>(null);
  const toastTimeout = useRef<NodeJS.Timeout | null>(null);

  const [jobDesc, setJobDesc] = useState("");
  const [jobPrice, setJobPrice] = useState("");
  const [jobs, setJobs] = useState<any[]>([]);
  const [clearedJobs, setClearedJobs] = useState<string[]>([]);
  const [workInputs, setWorkInputs] = useState<Record<string, string>>({});
  const [appealReasons, setAppealReasons] = useState<Record<string, string>>({});
  
  const [history, setHistory] = useState<{ hash: string; action: string; time: string }[]>([]);

  const showToast = (message: string, tx: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToast({ message, tx, type });
    toastTimeout.current = setTimeout(() => setToast(null), 3000); 
  };

  useEffect(() => {
    const savedHistory = localStorage.getItem("genwork_tx_history");
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    
    const savedCleared = localStorage.getItem("genwork_cleared_jobs");
    if (savedCleared) setClearedJobs(JSON.parse(savedCleared));
  }, []);

  const saveToHistory = (hash: string, action: string) => {
    const newRecord = { hash, action, time: new Date().toLocaleString() };
    const updatedHistory = [newRecord, ...history];
    setHistory(updatedHistory);
    localStorage.setItem("genwork_tx_history", JSON.stringify(updatedHistory));
  };

  const clearHistoryAndLocks = () => {
    setHistory([]);
    localStorage.removeItem("genwork_tx_history");
    showToast("History cleared successfully!", "", 'success');
  };

  const fetchJobs = useCallback(async () => {
    try {
      const data = await genlayerClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: "get_all_jobs",
        args: [],
      });
      if (data) {
        const parsedJobs = typeof data === "string" ? JSON.parse(data) : data;
        setJobs(Array.isArray(parsedJobs) ? parsedJobs : []);
      }
    } catch (error: any) {
      console.error("Error fetching jobs:", error);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const sendGenLayerTransaction = async (functionName: string, args: any[]) => {
    if (!address) throw new Error("Wallet not connected");
    const client = createClient({
      chain: studionet,
      account: address as `0x${string}`,
    });
    const hash = await client.writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      functionName: functionName,
      args: args,
      value: BigInt(0),
    });
    return hash;
  };

  const handlePostJob = async () => {
    if (loadingAction) return;
    if (!jobDesc || !jobPrice) return showToast("Please fill all fields", "", "error");
    if (isNaN(Number(jobPrice)) || Number(jobPrice) <= 0) return showToast("Enter a valid price", "", "error");
    if (!address) return showToast("Connect wallet first", "", "error");
    
    try {
      setLoadingAction("post");
      const tx = await sendGenLayerTransaction("post_job", [jobDesc, jobPrice.toString(), address]);
      saveToHistory(tx, `Posted Job for ${jobPrice} GEN`);
      setJobDesc("");
      setJobPrice("");
      showToast("Job Posted! Waiting for confirmation...", tx, "success");
      setTimeout(() => fetchJobs(), 3000);
    } catch (error: any) {
      showToast(error.message || "Transaction failed", "", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSubmitWork = async (jobId: string) => {
    if (loadingAction) return;
    const workData = workInputs[jobId];
    if (!workData) return showToast("Please paste URL or type text first", "", "error");
    if (!address) return showToast("Connect wallet first", "", "error");
    
    try {
      setLoadingAction(`submit-${jobId}`);
      const tx = await sendGenLayerTransaction("submit_work", [jobId, workData, address]);
      saveToHistory(tx, `Submitted Work for AI Eval`);
      showToast("Work Submitted! Processing via AI...", tx, "info");
      setTimeout(() => fetchJobs(), 3000);
    } catch (error: any) {
      showToast(error.message || "Transaction failed", "", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleApproveWork = async (job: any) => {
    if (loadingAction) return;
    if (!address) return showToast("Connect wallet first", "", "error");
    
    try {
      setLoadingAction(`approve-${job.id}`);
      
      // Step 1: Call GenLayer Contract First (To fix double payment bug)
      showToast("Confirming approval on GenLayer...", "", "info");
      const tx = await sendGenLayerTransaction("approve_work", [job.id, address]);
      saveToHistory(tx, `Approved Job #${job.id}`);
      showToast("Job Completed! Now processing payment...", tx, "success");
      
      // Step 2: Pay via MetaMask
      const provider = (window as any).ethereum;
      const hexValue = toWeiHex(job.price);
      
      try {
        const paymentTx = await provider.request({
          method: 'eth_sendTransaction',
          params: [{ from: address, to: job.freelancer, value: hexValue }],
        });
        saveToHistory(paymentTx, `Paid ${job.price} GEN`);
        showToast("Payment sent successfully!", paymentTx, "success");
      } catch (err) {
        showToast("Job Approved, but Wallet Payment was cancelled. Please send manually.", "", "error");
      }
      
      setTimeout(() => fetchJobs(), 3000);
    } catch (error: any) {
      showToast(error.message || "Approval transaction failed", "", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRejectWork = async (jobId: string) => {
    if (loadingAction) return;
    if (!address) return showToast("Connect wallet first", "", "error");
    
    try {
      setLoadingAction(`reject-${jobId}`);
      const tx = await sendGenLayerTransaction("reject_work", [jobId, address]);
      saveToHistory(tx, `Rejected Job #${jobId}`);
      showToast("Reject transaction processing...", tx, "error");
      setTimeout(() => fetchJobs(), 3000);
    } catch (error: any) {
      showToast(error.message || "Transaction failed", "", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAppeal = async (jobId: string) => {
    if (loadingAction) return;
    const reason = appealReasons[jobId];
    if (!reason) return showToast("Please enter appeal reason", "", "error");
    if (!address) return showToast("Connect wallet first", "", "error");
    
    try {
      setLoadingAction(`appeal-${jobId}`);
      const tx = await sendGenLayerTransaction("appeal_decision", [jobId, reason]);
      saveToHistory(tx, `Appealed Job #${jobId}`);
      showToast("Appeal submitted successfully!", tx, "info");
      setTimeout(() => fetchJobs(), 3000);
    } catch (error: any) {
      showToast(error.message || "Transaction failed", "", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    if (loadingAction) return;
    if (!address) return showToast("Connect wallet first", "", "error");
    
    try {
      setLoadingAction(`cancel-${jobId}`);
      const tx = await sendGenLayerTransaction("cancel_job", [jobId, address]);
      saveToHistory(tx, `Cancelled Job #${jobId}`);
      showToast("Job Cancelled!", tx, "info");
      setTimeout(() => fetchJobs(), 3000);
    } catch (error: any) {
      showToast(error.message || "Transaction failed", "", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleClearCompleted = () => {
    const completedIds = jobs.filter(j => j.status === "COMPLETED" || j.status === "CANCELLED").map(j => j.id);
    if (completedIds.length === 0) return showToast("No completed or cancelled jobs to clear.", "", "info");
    
    const newCleared = [...new Set([...clearedJobs, ...completedIds])];
    setClearedJobs(newCleared);
    localStorage.setItem("genwork_cleared_jobs", JSON.stringify(newCleared));
    showToast("Completed/Cancelled jobs cleared from view!", "", "success");
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setIsMenuOpen(false);
  };

  const shortAddr = (addr: string) =>
    addr ? `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}` : "";

  const isMyJob = (job: any) =>
    address && job.client?.toLowerCase() === address.toLowerCase();

  const getStatusStyle = (status: string) => {
    switch(status) {
      case "COMPLETED": return "bg-gradient-to-r from-green-500/20 to-emerald-600/20 text-green-400 border-green-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]";
      case "AI_APPROVED": return "bg-gradient-to-r from-emerald-500/20 to-teal-600/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(52,211,153,0.2)]";
      case "AI_REJECTED": return "bg-gradient-to-r from-rose-500/20 to-red-600/20 text-rose-400 border-rose-500/30 shadow-[0_0_10px_rgba(225,29,72,0.2)]";
      case "OPEN": return "bg-gradient-to-r from-blue-500/20 to-indigo-600/20 text-blue-400 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]";
      case "CANCELLED": return "bg-gradient-to-r from-slate-500/20 to-gray-600/20 text-slate-400 border-slate-500/30 shadow-[0_0_10px_rgba(148,163,184,0.2)]";
      default: return "bg-gradient-to-r from-amber-500/20 to-orange-600/20 text-amber-400 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]";
    }
  };

  const visibleJobs = jobs.filter(j => !clearedJobs.includes(j.id));

  // Handler for Price Input to prevent Scientific Notation
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Regex allows empty string or numbers with maximum one decimal point, blocking 'e', '+', '-'
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      setJobPrice(val);
    }
  };

  return (
    <main className="min-h-screen text-slate-200 font-sans selection:bg-blue-500/30 w-full overflow-x-hidden relative">
      <AnimatedBackground />

      {toast && (
        <div className={`fixed top-6 right-6 z-[100] px-6 py-4 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] flex items-center gap-4 border backdrop-blur-xl transition-all duration-300 animate-in slide-in-from-top-8 fade-in zoom-in-95
          ${toast.type === 'success' ? 'bg-emerald-900/80 border-emerald-500/50 text-emerald-50' : 
            toast.type === 'error' ? 'bg-rose-900/80 border-rose-500/50 text-rose-50' : 
            'bg-blue-900/80 border-blue-500/50 text-blue-50'}
        `}>
          <div className="flex flex-col">
            <span className="font-bold text-[15px]">{toast.message}</span>
          </div>
          {toast.tx && (
            <a href={`https://explorer-studio.genlayer.com/tx/${toast.tx}`} target="_blank" rel="noreferrer" 
               className="ml-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors border border-white/5">
              View TX
            </a>
          )}
        </div>
      )}

      <nav className="border-b border-white/5 bg-[#020817]/60 backdrop-blur-xl sticky top-0 z-40 transition-all duration-300">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleTabChange("post")}>
            <svg viewBox="0 0 100 100" className="w-10 h-10 text-white fill-current transform transition-transform duration-300 hover:scale-105 hover:rotate-3">
              <path d="M50 15 L25 70 L45 58 L50 65 L55 58 L75 70 Z" fill="currentColor" />
              <polygon points="50,69 62,81 50,93 38,81" fill="currentColor" />
            </svg>
            <h1 className="text-2xl font-extrabold tracking-wide text-white drop-shadow-md">TrustWork</h1>
          </div>
          
          <div className="flex items-center gap-4 md:gap-8">
            <div className="hidden md:flex items-center gap-6 bg-white/5 px-6 py-2 rounded-full border border-white/10 shadow-inner">
              <button onClick={() => handleTabChange("post")} className={`font-bold transition-all hover:scale-105 ${activeTab === "post" ? "text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" : "text-slate-400 hover:text-white"}`}>Dashboard</button>
              <button onClick={() => handleTabChange("board")} className={`font-bold transition-all hover:scale-105 ${activeTab === "board" ? "text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" : "text-slate-400 hover:text-white"}`}>Job Board</button>
              <button onClick={() => handleTabChange("history")} className={`font-bold transition-all hover:scale-105 ${activeTab === "history" ? "text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" : "text-slate-400 hover:text-white"}`}>History</button>
            </div>
            <div className="hidden md:block">
              <ConnectButton showBalance={false} />
            </div>
            <button onClick={() => setIsMenuOpen(true)} className="p-2 border border-slate-700/50 rounded-full bg-slate-800/50 hover:bg-slate-700 block md:hidden focus:outline-none backdrop-blur-md">
              <svg className="w-6 h-6 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
          </div>
        </div>
      </nav>

      <div className={`fixed inset-0 z-50 transform transition-transform duration-300 ease-in-out ${isMenuOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}></div>
        <div className="absolute right-0 top-0 h-full w-72 bg-[#0a1122]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl flex flex-col p-6">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-xl font-bold text-white">Menu</h2>
            <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-white/5 rounded-full focus:outline-none hover:bg-white/10 transition-colors">
              <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <button onClick={() => handleTabChange("post")} className={`p-4 rounded-xl text-left font-semibold border transition-all ${activeTab === "post" ? "bg-blue-600/20 border-blue-500/50 text-white shadow-lg" : "border-transparent text-slate-400 hover:bg-white/5"}`}>Dashboard</button>
            <button onClick={() => handleTabChange("board")} className={`p-4 rounded-xl text-left font-semibold border transition-all ${activeTab === "board" ? "bg-blue-600/20 border-blue-500/50 text-white shadow-lg" : "border-transparent text-slate-400 hover:bg-white/5"}`}>Job Board</button>
            <button onClick={() => handleTabChange("history")} className={`p-4 rounded-xl text-left font-semibold border transition-all ${activeTab === "history" ? "bg-blue-600/20 border-blue-500/50 text-white shadow-lg" : "border-transparent text-slate-400 hover:bg-white/5"}`}>History</button>
          </div>
          <div className="mt-auto pt-8 border-t border-white/10 block md:hidden">
            <ConnectButton showBalance={false} />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 md:p-8 mt-4 w-full relative z-10">
        {!isConnected ? (
          <div className="text-center p-12 bg-[#0B1426]/70 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl mt-10">
            <h2 className="text-4xl font-extrabold mb-4 text-white drop-shadow-lg">Welcome to TrustWork</h2>
            <p className="text-slate-400 text-lg mb-8">AI-powered decentralized job platform on GenLayer.</p>
            <div className="flex justify-center">
              <ConnectButton />
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
            {activeTab === "post" && (
              <div className="bg-[#0B1426]/80 backdrop-blur-xl p-8 md:p-10 rounded-3xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] w-full">
                <h2 className="text-3xl font-extrabold text-white mb-8">Post a New Job</h2>
                <div className="space-y-6">
                  <textarea className="w-full p-5 bg-[#060c18]/80 border border-white/10 rounded-2xl text-white focus:outline-none focus:border-blue-500 resize-none transition-colors shadow-inner" rows={4} value={jobDesc} onChange={(e) => setJobDesc(e.target.value)} placeholder="Describe what needs to be done..."></textarea>
                  <div className="flex items-center bg-[#060c18]/80 border border-white/10 rounded-2xl overflow-hidden focus-within:border-blue-500 transition-colors shadow-inner">
                    <span className="px-5 text-slate-400 font-bold bg-white/5 border-r border-white/10 py-4 whitespace-nowrap">Price (GEN)</span>
                    <input type="text" className="w-full p-4 bg-transparent text-white focus:outline-none" value={jobPrice} onChange={handlePriceChange} placeholder="e.g. 5.5" />
                  </div>
                  <button onClick={handlePostJob} disabled={loadingAction !== null} className={`w-full py-4 rounded-2xl font-bold transition-all duration-300 text-lg ${loadingAction === "post" ? "bg-slate-700/50 text-slate-400 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] hover:-translate-y-1"}`}>
                    {loadingAction === "post" ? "Processing..." : "Post Job to GenLayer"}
                  </button>
                </div>
              </div>
            )}

            {activeTab === "board" && (
              <div className="w-full">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                  <h2 className="text-3xl font-extrabold text-white drop-shadow-lg">Job Board</h2>
                  <div className="flex items-center gap-3">
                    <button onClick={handleClearCompleted} className="bg-emerald-950/40 text-emerald-400 px-4 py-2.5 rounded-full text-sm font-bold hover:bg-emerald-900/60 border border-emerald-900/50 transition-all shadow-lg hover:scale-105 active:scale-95 backdrop-blur-md flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Clear Completed
                    </button>
                    <button onClick={() => fetchJobs()} className="bg-white/10 text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-white/20 border border-white/10 transition-all shadow-lg hover:scale-105 active:scale-95 backdrop-blur-md">↻ Refresh</button>
                  </div>
                </div>
                <div className="grid gap-6 w-full">
                  {visibleJobs.length === 0 ? (
                    <div className="text-center p-12 bg-[#0B1426]/70 backdrop-blur-xl rounded-3xl border border-white/10 text-slate-400 shadow-xl">No active jobs to display right now.</div>
                  ) : (
                    visibleJobs.map((job) => {
                      const isRejectedMsg = job.ai_decision && job.ai_decision.toLowerCase().includes("reject");
                      const isUrl = job.work_data && job.work_data.startsWith("http");

                      return (
                        <div key={job.id} className={`bg-[#0B1426]/80 backdrop-blur-xl p-6 md:p-8 rounded-3xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.4)] flex flex-col md:flex-row justify-between items-start md:items-center hover:border-white/20 transition-all w-full overflow-hidden relative group`}>
                          
                          <div className="mb-6 md:mb-0 flex-1 pr-4 min-w-0 w-full z-10">
                            <div className="flex flex-wrap items-center gap-3 mb-4">
                              <span className="bg-blue-900/40 text-blue-300 text-xs font-extrabold px-3 py-1.5 rounded-lg border border-blue-500/30 whitespace-nowrap shadow-sm">JOB #{job.id}</span>
                              <span className="bg-purple-900/40 text-purple-300 text-xs font-extrabold px-3 py-1.5 rounded-lg border border-purple-500/30 whitespace-nowrap shadow-sm">💰 {job.price} GEN</span>
                              
                              {isMyJob(job) && (
                                <span className="bg-emerald-900/60 text-emerald-400 text-xs font-extrabold px-3 py-1.5 rounded-lg border border-emerald-500/40 whitespace-nowrap shadow-[0_0_10px_rgba(52,211,153,0.2)] flex items-center gap-1 animate-in zoom-in">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"></path></svg>
                                  Your Job
                                </span>
                              )}
                            </div>
                            
                            <h3 className="text-2xl font-extrabold text-white mb-3 break-words whitespace-normal leading-snug">{job.desc}</h3>
                            
                            <div className="flex flex-col gap-2 mb-4 bg-black/20 p-4 rounded-2xl border border-white/5">
                              {job.client && (
                                <p className="text-xs text-slate-400 flex items-center justify-between">
                                  <span className="font-semibold text-slate-500">Client</span> 
                                  <span className="font-mono bg-white/5 px-2 py-1 rounded text-slate-300 border border-white/5">{shortAddr(job.client)}</span>
                                </p>
                              )}
                              {job.freelancer && (
                                <p className="text-xs text-slate-400 flex items-center justify-between">
                                  <span className="font-semibold text-slate-500">Freelancer</span> 
                                  <span className="font-mono bg-white/5 px-2 py-1 rounded text-slate-300 border border-white/5">{shortAddr(job.freelancer)}</span>
                                </p>
                              )}
                              {job.work_data && (
                                <div className="text-xs text-slate-400 flex flex-col gap-1 mt-2">
                                  <span className="font-semibold text-slate-500">Submitted Work:</span> 
                                  {isUrl ? (
                                    <a href={job.work_data} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline truncate max-w-full block bg-black/30 p-2 rounded-lg border border-white/5 mt-1">
                                      {job.work_data}
                                    </a>
                                  ) : (
                                    <div className="bg-black/30 p-3 rounded-lg border border-white/5 text-slate-300 max-h-32 overflow-y-auto whitespace-pre-wrap mt-1">
                                      {job.work_data}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold text-slate-300">Status:</span>
                              <span className={`px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-widest border ${getStatusStyle(job.status)} flex items-center gap-1.5`}>
                                {job.status !== "COMPLETED" && job.status !== "CANCELLED" && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                                )}
                                {job.status.replace('_', ' ')}
                              </span>
                            </div>
                            
                            {(job.status !== "OPEN" && job.ai_decision) && (
                              <div className={`mt-4 p-4 rounded-xl border max-w-full ${isRejectedMsg ? 'bg-rose-950/40 border-rose-900/50' : 'bg-slate-900/60 border-slate-700/50 shadow-inner'}`}>
                                <p className={`text-sm break-words leading-relaxed ${isRejectedMsg ? 'text-rose-300 font-medium' : 'text-slate-300'}`}>🤖 {job.ai_decision}</p>
                              </div>
                            )}
                          </div>

                          <div className="w-full md:w-auto flex flex-col gap-3 md:min-w-[280px] shrink-0 z-10">
                            
                            {job.status === "OPEN" && (
                              isMyJob(job) ? (
                                <div className="flex flex-col gap-3 w-full">
                                  <div className="bg-white/5 text-slate-400 py-4 rounded-2xl font-bold text-center border border-white/10 shadow-inner flex flex-col items-center justify-center gap-2 h-[100px]">
                                    <svg className="w-6 h-6 text-slate-500 animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    Waiting for Work...
                                  </div>
                                  <button onClick={() => handleCancelJob(job.id)} disabled={loadingAction !== null} className={`py-3 rounded-xl font-bold border transition-all w-full ${loadingAction === 'cancel-'+job.id ? 'bg-transparent text-slate-600 border-slate-700 cursor-not-allowed' : 'bg-transparent text-rose-400 border-rose-900/50 hover:bg-rose-950/50 shadow-sm'}`}>
                                    {loadingAction === `cancel-${job.id}` ? "Cancelling..." : "Cancel Job"}
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <textarea 
                                    placeholder="Paste URL OR Type text here..." 
                                    className="p-4 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500 w-full shadow-inner transition-colors resize-y min-h-[100px]" 
                                    value={workInputs[job.id] || ""} 
                                    onChange={(e) => setWorkInputs((prev) => ({ ...prev, [job.id]: e.target.value }))} 
                                  />
                                  <button onClick={() => handleSubmitWork(job.id)} disabled={loadingAction !== null} className={`py-4 rounded-xl font-extrabold transition-all w-full text-[15px] ${loadingAction === 'submit-'+job.id ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-white text-black hover:bg-gray-200 hover:scale-[1.02] shadow-[0_0_15px_rgba(255,255,255,0.2)]'}`}>
                                    {loadingAction === `submit-${job.id}` ? "Sending to AI..." : "Submit to AI Evaluator"}
                                  </button>
                                </>
                              )
                            )}

                            {["SUBMITTED", "AI_APPROVED", "APPEALED"].includes(job.status) && (
                              isMyJob(job) ? (
                                <div className="flex flex-col gap-3 w-full">
                                  <button onClick={() => handleApproveWork(job)} disabled={loadingAction !== null} className={`py-4 rounded-xl font-extrabold transition-all w-full text-[15px] ${loadingAction === 'approve-'+job.id ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-[0_0_20px_rgba(5,150,105,0.4)] hover:-translate-y-1'}`}>
                                    {loadingAction === `approve-${job.id}` ? "Processing..." : `Approve & Pay ${job.price} GEN`}
                                  </button>
                                  <button onClick={() => handleRejectWork(job.id)} disabled={loadingAction !== null} className={`py-3 rounded-xl font-bold border transition-all w-full ${loadingAction === 'reject-'+job.id ? 'bg-transparent text-slate-600 border-slate-700 cursor-not-allowed' : 'bg-transparent text-rose-400 border-rose-900/50 hover:bg-rose-950/50'}`}>
                                    {loadingAction === `reject-${job.id}` ? "Rejecting..." : "Manual Reject"}
                                  </button>
                                </div>
                              ) : (
                                <div className="bg-amber-950/40 text-amber-400 py-5 px-4 rounded-2xl font-bold text-center border border-amber-700/50 flex flex-col items-center justify-center gap-2 shadow-[0_0_20px_rgba(217,119,6,0.15)]">
                                  <svg className="w-8 h-8 animate-pulse text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                  <span className="text-[15px]">Awaiting Client Approval</span>
                                  <span className="text-xs font-medium text-amber-500/70 bg-amber-950/50 px-3 py-1 rounded-full mt-1 border border-amber-900/50">Reward Locked: {job.price} GEN</span>
                                </div>
                              )
                            )}

                            {job.status === "AI_REJECTED" && (
                              isMyJob(job) ? (
                                <button onClick={() => handleRejectWork(job.id)} disabled={loadingAction !== null} className={`py-4 rounded-xl font-extrabold transition-all w-full text-[15px] ${loadingAction === 'reject-'+job.id ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-rose-600 text-white hover:bg-rose-500 shadow-[0_0_20px_rgba(225,29,72,0.4)] hover:-translate-y-1'}`}>
                                  {loadingAction === `reject-${job.id}` ? "Processing..." : "Confirm Reject & Re-open"}
                                </button>
                              ) : (
                                <>
                                  <input type="text" placeholder="Reason for appeal..." className="p-4 bg-black/40 border border-rose-900/50 rounded-xl text-white focus:outline-none focus:border-rose-500 w-full shadow-inner" value={appealReasons[job.id] || ""} onChange={(e) => setAppealReasons((prev) => ({ ...prev, [job.id]: e.target.value }))} />
                                  <button onClick={() => handleAppeal(job.id)} disabled={loadingAction !== null} className={`py-4 rounded-xl font-extrabold transition-all w-full text-[15px] ${loadingAction === 'appeal-'+job.id ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-rose-600 text-white hover:bg-rose-500 shadow-[0_0_20px_rgba(225,29,72,0.3)] hover:-translate-y-1'}`}>
                                    {loadingAction === `appeal-${job.id}` ? "Submitting..." : "Submit Appeal to AI"}
                                  </button>
                                </>
                              )
                            )}

                            {job.status === "COMPLETED" && (
                              <div className="bg-emerald-950/40 text-emerald-400 py-6 px-4 rounded-2xl font-bold text-center border border-emerald-800/50 flex flex-col items-center justify-center gap-2 shadow-[0_0_30px_rgba(16,185,129,0.15)] relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-600/10 to-transparent"></div>
                                <svg className="w-10 h-10 text-emerald-500 mb-1 drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                <span className="text-lg relative z-10">Payment Delivered</span>
                                <span className="text-sm text-emerald-300/80 font-medium relative z-10">{job.price} GEN Sent to Wallet</span>
                              </div>
                            )}

                            {job.status === "CANCELLED" && (
                              <div className="bg-slate-900/60 text-slate-400 py-6 px-4 rounded-2xl font-bold text-center border border-slate-700/50 flex flex-col items-center justify-center gap-2 shadow-inner relative overflow-hidden">
                                <svg className="w-10 h-10 text-slate-500 mb-1 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                <span className="text-lg">Job Cancelled</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {activeTab === "history" && (
              <div className="w-full">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-extrabold text-white drop-shadow-lg">Transaction History</h2>
                  <button onClick={clearHistoryAndLocks} className="bg-rose-950/50 text-rose-400 px-5 py-2.5 rounded-full text-sm font-bold hover:bg-rose-900/60 border border-rose-900/50 transition-all hover:scale-105 active:scale-95 backdrop-blur-md">
                    Clear Records
                  </button>
                </div>
                <div className="bg-[#0B1426]/80 backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.5)] w-full">
                  {history.length === 0 ? (
                    <div className="text-center p-12 text-slate-500 font-medium">No transactions recorded yet.</div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {history.map((record, idx) => (
                        <div key={idx} className="p-6 flex justify-between items-center hover:bg-white/[0.02] transition-colors group">
                          <div>
                            <h4 className="font-extrabold text-slate-200 text-lg group-hover:text-blue-400 transition-colors">{record.action}</h4>
                            <p className="text-sm text-slate-500 font-medium mt-1">{record.time}</p>
                          </div>
                          <a href={`https://explorer-studio.genlayer.com/tx/${record.hash}`} target="_blank" rel="noreferrer" className="text-white hover:text-blue-400 text-sm font-bold bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl border border-white/10 transition-all">
                            View on Explorer
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
