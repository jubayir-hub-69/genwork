"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { CONTRACT_ADDRESS } from "./constants";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const genlayerClient = createClient({ chain: studionet });

const CATEGORIES = ["Web3", "AI", "Design", "Writing", "Other"];

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
  const [jobCategory, setJobCategory] = useState(CATEGORIES[0]); 
  const [filterCategory, setFilterCategory] = useState("All"); 
  const [searchQuery, setSearchQuery] = useState(""); 
  
  const [jobs, setJobs] = useState<any[]>([]);
  const [clearedJobs, setClearedJobs] = useState<string[]>([]);
  const [workInputs, setWorkInputs] = useState<Record<string, string>>({});
  const [appealReasons, setAppealReasons] = useState<Record<string, string>>({});
  
  const [chatInputs, setChatInputs] = useState<Record<string, string>>({});
  const [expandedChat, setExpandedChat] = useState<Record<string, boolean>>({});

  const [history, setHistory] = useState<{ hash: string; action: string; time: string }[]>([]);

  // Profile States
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [globalProfiles, setGlobalProfiles] = useState<Record<string, any>>({}); 
  
  // Profile Edit States
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempName, setTempName] = useState("");
  const [tempAvatar, setTempAvatar] = useState("");

  const [aboutSubTab, setAboutSubTab] = useState("genwork");

  const showToast = (message: string, tx: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToast({ message, tx, type });
    toastTimeout.current = setTimeout(() => setToast(null), 3000); 
  };

  useEffect(() => {
    const savedHistory = localStorage.getItem(`genwork_tx_history_${CONTRACT_ADDRESS}`);
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    
    const savedCleared = localStorage.getItem(`genwork_cleared_jobs_${CONTRACT_ADDRESS}`);
    if (savedCleared) setClearedJobs(JSON.parse(savedCleared));
  }, []);

  const saveToHistory = (hash: string, action: string) => {
    const newRecord = { hash, action, time: new Date().toLocaleString() };
    const updatedHistory = [newRecord, ...history];
    setHistory(updatedHistory);
    localStorage.setItem(`genwork_tx_history_${CONTRACT_ADDRESS}`, JSON.stringify(updatedHistory));
  };

  const fetchJobsAndProfiles = useCallback(async () => {
    try {
      // Fetch Jobs
      const jobsData = await genlayerClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: "get_all_jobs",
        args: [],
      });
      if (jobsData) {
        const parsedJobs = typeof jobsData === "string" ? JSON.parse(jobsData) : jobsData;
        setJobs(Array.isArray(parsedJobs) ? parsedJobs : []);
      }

      // Fetch Profiles
      const profilesData = await genlayerClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: "get_profiles",
        args: [],
      });
      if (profilesData) {
        setGlobalProfiles(typeof profilesData === "string" ? JSON.parse(profilesData) : profilesData);
      }
    } catch (error: any) {
      console.error("Error fetching data:", error);
    }
  }, []);

  useEffect(() => {
    fetchJobsAndProfiles();
  }, [fetchJobsAndProfiles]);

  const openProfileModal = (addr: string) => {
    if (!addr) return;
    const formattedAddr = addr.toLowerCase();
    setSelectedProfile(addr);
    setTempName(globalProfiles[formattedAddr]?.nickname || "");
    setTempAvatar(globalProfiles[formattedAddr]?.avatar || "");
    setIsEditingProfile(false);
  };

  const saveProfileData = async () => {
    if (!address) return showToast("Wallet not connected", "", "error");
    
    try {
      setLoadingAction("save-profile");
      showToast("Saving profile to Blockchain...", "", "info");
      
      const tx = await sendGenLayerTransaction("update_profile", [address, tempName, tempAvatar]);
      showToast("Profile globally updated!", tx, "success");
      
      setIsEditingProfile(false);
      setTimeout(() => fetchJobsAndProfiles(), 3000);
    } catch(err: any) {
      showToast(err.message || "Failed to save profile", "", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const clearHistoryAndLocks = () => {
    setHistory([]);
    setClearedJobs([]);
    localStorage.removeItem(`genwork_tx_history_${CONTRACT_ADDRESS}`);
    localStorage.removeItem(`genwork_cleared_jobs_${CONTRACT_ADDRESS}`);
    showToast("Records & Hidden Jobs cleared successfully!", "", 'success');
  };

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
      const tx = await sendGenLayerTransaction("post_job", [jobDesc, jobPrice.toString(), jobCategory, address]);
      saveToHistory(tx, `Posted Job [${jobCategory}] for ${jobPrice} GEN`);
      setJobDesc("");
      setJobPrice("");
      setJobCategory(CATEGORIES[0]);
      showToast("Job Posted! Waiting for confirmation...", tx, "success");
      setTimeout(() => fetchJobsAndProfiles(), 3000);
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
      setTimeout(() => fetchJobsAndProfiles(), 3000);
    } catch (error: any) {
      showToast(error.message || "Transaction failed", "", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSendMessage = async (jobId: string) => {
    if (loadingAction) return;
    const message = chatInputs[jobId];
    if (!message || message.trim() === "") return showToast("Please type a message", "", "error");
    if (!address) return showToast("Connect wallet first", "", "error");

    try {
      setLoadingAction(`chat-${jobId}`);
      const tx = await sendGenLayerTransaction("send_message", [jobId, message, address]);
      setChatInputs((prev) => ({ ...prev, [jobId]: "" }));
      showToast("Message sent to blockchain!", tx, "info");
      setTimeout(() => fetchJobsAndProfiles(), 3000);
    } catch (error: any) {
      showToast(error.message || "Message failed to send", "", "error");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleApproveWork = async (job: any) => {
    if (loadingAction) return;
    if (!address) return showToast("Connect wallet first", "", "error");
    
    try {
      setLoadingAction(`approve-${job.id}`);
      showToast("Confirming approval on GenLayer...", "", "info");
      const tx = await sendGenLayerTransaction("approve_work", [job.id, address]);
      saveToHistory(tx, `Approved Job #${job.id}`);
      showToast("Job Completed! Now processing payment...", tx, "success");
      
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
      
      setTimeout(() => fetchJobsAndProfiles(), 3000);
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
      setTimeout(() => fetchJobsAndProfiles(), 3000);
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
      setTimeout(() => fetchJobsAndProfiles(), 3000);
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
      setTimeout(() => fetchJobsAndProfiles(), 3000);
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
    localStorage.setItem(`genwork_cleared_jobs_${CONTRACT_ADDRESS}`, JSON.stringify(newCleared));
    showToast("Completed/Cancelled jobs cleared from view!", "", "success");
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setIsMenuOpen(false);
  };

  const getProfileNick = (addr: string) => globalProfiles[addr.toLowerCase()]?.nickname || "";
  const getProfileAvatar = (addr: string) => globalProfiles[addr.toLowerCase()]?.avatar || "";

  const displayAddr = (addr: string) => {
    if (!addr) return "";
    const short = `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
    const nick = getProfileNick(addr);
    return nick ? `${nick} (${short})` : short;
  };

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

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      setJobPrice(val);
    }
  };

  const totalJobsCount = jobs.length;
  const totalGenPaid = jobs.filter(j => j.status === "COMPLETED").reduce((acc, curr) => acc + parseFloat(curr.price || "0"), 0).toFixed(2);
  const evaluatedJobs = jobs.filter(j => ["AI_APPROVED", "COMPLETED", "AI_REJECTED"].includes(j.status)).length;
  const approvedJobs = jobs.filter(j => ["AI_APPROVED", "COMPLETED"].includes(j.status)).length;
  const aiApprovalRate = evaluatedJobs > 0 ? Math.round((approvedJobs / evaluatedJobs) * 100) : 0;

  const visibleJobs = jobs.filter(j => 
    !clearedJobs.includes(j.id) && 
    (filterCategory === "All" || j.category === filterCategory) &&
    (j.desc.toLowerCase().includes(searchQuery.toLowerCase()) || 
     (j.work_data && j.work_data.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const getProfileStats = (addr: string) => {
    const posted = jobs.filter(j => j.client?.toLowerCase() === addr.toLowerCase());
    const worked = jobs.filter(j => j.freelancer?.toLowerCase() === addr.toLowerCase() && j.status === "COMPLETED");
    const earned = worked.reduce((acc, curr) => acc + parseFloat(curr.price || "0"), 0).toFixed(2);
    return { posted: posted.length, worked: worked.length, earned };
  };

  return (
    <main className="min-h-screen text-slate-200 font-sans selection:bg-blue-500/30 w-full overflow-x-hidden relative">
      <AnimatedBackground />

      {selectedProfile && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={() => setSelectedProfile(null)}>
          <div className="bg-[#0B1426]/95 border border-white/10 p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center relative animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedProfile(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>
            
            <div className="w-24 h-24 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-full mx-auto mb-4 flex items-center justify-center border-4 border-[#0B1426] shadow-lg overflow-hidden relative">
              {getProfileAvatar(selectedProfile) && !isEditingProfile ? (
                <img 
                  src={getProfileAvatar(selectedProfile)} 
                  alt="Profile" 
                  className="w-full h-full object-cover absolute inset-0 z-10" 
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : null}
              <span className="text-3xl font-bold text-white z-0">👤</span>
            </div>
            
            {!isEditingProfile ? (
              <>
                <h3 className="text-2xl font-extrabold text-white mb-1">{getProfileNick(selectedProfile) || "GenWork Profile"}</h3>
                <p className="text-xs font-mono text-slate-400 mb-4 bg-black/30 py-1.5 px-2 rounded-lg border border-white/5 break-all">{selectedProfile}</p>
                <div className="mb-6">
                  {address && selectedProfile.toLowerCase() === address.toLowerCase() && (
                    <button onClick={() => setIsEditingProfile(true)} className="bg-white/10 hover:bg-white/20 text-white text-sm font-bold py-2 px-4 rounded-full transition-colors border border-white/10">
                      ✏️ Edit Profile Settings
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="mb-6 space-y-3 animate-in fade-in">
                <input 
                  type="text" 
                  placeholder="Enter Nickname..." 
                  maxLength={20}
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white text-center text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
                />
                <input 
                  type="text" 
                  placeholder="Direct Image Link (e.g., ends in .jpg or .png)" 
                  value={tempAvatar}
                  onChange={(e) => setTempAvatar(e.target.value)}
                  className="w-full p-3 bg-black/50 border border-white/10 rounded-xl text-white text-center text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
                />
                <button onClick={saveProfileData} disabled={loadingAction !== null} className={`w-full font-bold py-3 rounded-xl transition-colors shadow-lg ${loadingAction === 'save-profile' ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
                  {loadingAction === 'save-profile' ? "Saving to Blockchain..." : "💾 Save Profile"}
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-left">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                <p className="text-xs text-slate-400 font-bold uppercase mb-1">Jobs Posted</p>
                <p className="text-2xl font-extrabold text-blue-400">{getProfileStats(selectedProfile).posted}</p>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                <p className="text-xs text-slate-400 font-bold uppercase mb-1">Completed</p>
                <p className="text-2xl font-extrabold text-emerald-400">{getProfileStats(selectedProfile).worked}</p>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 col-span-2 text-center">
                <p className="text-xs text-slate-400 font-bold uppercase mb-1">Total Earned</p>
                <p className="text-3xl font-extrabold text-purple-400 drop-shadow-md">{getProfileStats(selectedProfile).earned} GEN</p>
              </div>
            </div>
          </div>
        </div>
      )}

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
            <h1 className="text-2xl font-extrabold tracking-wide text-white drop-shadow-md">GenWork</h1>
          </div>
          
          <div className="flex items-center gap-4 md:gap-8">
            {isConnected && (
              <div className="hidden md:flex items-center gap-6 bg-white/5 px-6 py-2 rounded-full border border-white/10 shadow-inner">
                <button onClick={() => handleTabChange("post")} className={`font-bold transition-all hover:scale-105 ${activeTab === "post" ? "text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" : "text-slate-400 hover:text-white"}`}>Dashboard</button>
                <button onClick={() => handleTabChange("board")} className={`font-bold transition-all hover:scale-105 ${activeTab === "board" ? "text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" : "text-slate-400 hover:text-white"}`}>Job Board</button>
                <button onClick={() => handleTabChange("history")} className={`font-bold transition-all hover:scale-105 ${activeTab === "history" ? "text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" : "text-slate-400 hover:text-white"}`}>History</button>
                <button onClick={() => handleTabChange("about")} className={`font-bold transition-all hover:scale-105 ${activeTab === "about" ? "text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" : "text-slate-400 hover:text-white"}`}>About</button>
              </div>
            )}
            
            {isConnected && (
              <button 
                onClick={() => openProfileModal(address as string)}
                className="hidden md:flex items-center gap-2 bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-blue-300 px-4 py-2 rounded-full font-bold text-sm border border-blue-500/30 hover:bg-blue-600/30 transition-all shadow-md"
              >
                👤 My Profile
              </button>
            )}

            <div className="hidden md:block">
              <ConnectButton showBalance={false} />
            </div>
            {isConnected && (
              <button onClick={() => setIsMenuOpen(true)} className="p-2 border border-slate-700/50 rounded-full bg-slate-800/50 hover:bg-slate-700 block md:hidden focus:outline-none backdrop-blur-md">
                <svg className="w-6 h-6 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
              </button>
            )}
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
            {isConnected && (
              <button 
                onClick={() => {openProfileModal(address as string); setIsMenuOpen(false);}}
                className="p-4 rounded-xl text-left font-semibold border border-purple-500/30 bg-purple-600/10 text-purple-300 hover:bg-purple-600/20 transition-all flex items-center gap-2 mb-2"
              >
                👤 My Profile
              </button>
            )}
            <button onClick={() => handleTabChange("post")} className={`p-4 rounded-xl text-left font-semibold border transition-all ${activeTab === "post" ? "bg-blue-600/20 border-blue-500/50 text-white shadow-lg" : "border-transparent text-slate-400 hover:bg-white/5"}`}>Dashboard</button>
            <button onClick={() => handleTabChange("board")} className={`p-4 rounded-xl text-left font-semibold border transition-all ${activeTab === "board" ? "bg-blue-600/20 border-blue-500/50 text-white shadow-lg" : "border-transparent text-slate-400 hover:bg-white/5"}`}>Job Board</button>
            <button onClick={() => handleTabChange("history")} className={`p-4 rounded-xl text-left font-semibold border transition-all ${activeTab === "history" ? "bg-blue-600/20 border-blue-500/50 text-white shadow-lg" : "border-transparent text-slate-400 hover:bg-white/5"}`}>History</button>
            <button onClick={() => handleTabChange("about")} className={`p-4 rounded-xl text-left font-semibold border transition-all ${activeTab === "about" ? "bg-blue-600/20 border-blue-500/50 text-white shadow-lg" : "border-transparent text-slate-400 hover:bg-white/5"}`}>About</button>
          </div>
          <div className="mt-auto pt-8 border-t border-white/10 block md:hidden">
            <ConnectButton showBalance={false} />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 md:p-8 mt-4 w-full relative z-10">
        {!isConnected ? (
          <div className="animate-in fade-in zoom-in duration-700">
            <div className="text-center p-12 bg-[#0B1426]/70 backdrop-blur-xl rounded-[3rem] border border-white/10 shadow-2xl mt-4 max-w-4xl mx-auto">
              <div className="inline-block mb-4 px-4 py-1.5 rounded-full bg-blue-900/30 border border-blue-500/30 text-blue-400 font-bold text-sm tracking-widest uppercase">
                The Adjudication Layer for the Agentic Economy
              </div>
              <h2 className="text-5xl md:text-7xl font-extrabold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 drop-shadow-lg pb-2">
                Welcome to GenWork
              </h2>
              <p className="text-slate-300 text-lg md:text-xl mb-12 max-w-2xl mx-auto leading-relaxed">
                A decentralized Web3 job marketplace powered by <strong>GenLayer AI</strong>. No middlemen, no disputes—just pure AI evaluation and secure payments.
              </p>
              
              <h3 className="text-2xl font-bold text-white mb-8 border-b border-white/10 pb-4 inline-block">How GenWork Works</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-14">
                <div className="bg-white/5 p-6 rounded-3xl border border-white/10 flex flex-col items-center text-center hover:bg-white/10 transition-colors">
                  <div className="w-14 h-14 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 mb-4 border border-blue-500/30 text-2xl font-bold">1</div>
                  <h4 className="text-white font-bold mb-2">Post a Job</h4>
                  <p className="text-sm text-slate-400">Describe the task in natural language and set the GEN reward.</p>
                </div>
                <div className="bg-white/5 p-6 rounded-3xl border border-white/10 flex flex-col items-center text-center hover:bg-white/10 transition-colors">
                  <div className="w-14 h-14 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-400 mb-4 border border-purple-500/30 text-2xl font-bold">2</div>
                  <h4 className="text-white font-bold mb-2">Submit Work</h4>
                  <p className="text-sm text-slate-400">Freelancers submit their work URL or text directly to the contract.</p>
                </div>
                <div className="bg-white/5 p-6 rounded-3xl border border-white/10 flex flex-col items-center text-center hover:bg-white/10 transition-colors">
                  <div className="w-14 h-14 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-400 mb-4 border border-amber-500/30 text-2xl font-bold">3</div>
                  <h4 className="text-white font-bold mb-2">AI Evaluates</h4>
                  <p className="text-sm text-slate-400">GenLayer AI automatically checks the work against the criteria.</p>
                </div>
                <div className="bg-white/5 p-6 rounded-3xl border border-white/10 flex flex-col items-center text-center hover:bg-white/10 transition-colors">
                  <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 mb-4 border border-emerald-500/30 text-2xl font-bold">4</div>
                  <h4 className="text-white font-bold mb-2">Get Paid</h4>
                  <p className="text-sm text-slate-400">If approved, client confirms and funds are securely transferred.</p>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center gap-4">
                <p className="text-slate-400 font-medium">Connect your wallet to enter the platform</p>
                <div className="transform scale-110">
                  <ConnectButton />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-4xl mx-auto">
            
            {/* STATS DASHBOARD */}
            {activeTab !== "post" && activeTab !== "about" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-[#0B1426]/60 backdrop-blur-xl p-5 rounded-3xl border border-white/5 shadow-lg flex flex-col justify-center">
                  <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1">Total GEN Paid</span>
                  <span className="text-3xl font-extrabold text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">{totalGenPaid} GEN</span>
                </div>
                <div className="bg-[#0B1426]/60 backdrop-blur-xl p-5 rounded-3xl border border-white/5 shadow-lg flex flex-col justify-center">
                  <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1">Total Jobs Listed</span>
                  <span className="text-3xl font-extrabold text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.3)]">{totalJobsCount} Jobs</span>
                </div>
                <div className="bg-[#0B1426]/60 backdrop-blur-xl p-5 rounded-3xl border border-white/5 shadow-lg flex flex-col justify-center">
                  <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1">AI Approval Rate</span>
                  <span className="text-3xl font-extrabold text-purple-400 drop-shadow-[0_0_10px_rgba(192,132,252,0.3)]">{aiApprovalRate}%</span>
                </div>
              </div>
            )}

            {/* ABOUT TAB */}
            {activeTab === "about" && (
              <div className="bg-[#0B1426]/80 backdrop-blur-xl p-8 md:p-10 rounded-3xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] w-full">
                <div className="flex gap-4 mb-8 border-b border-white/10 pb-4">
                  <button 
                    onClick={() => setAboutSubTab("genwork")}
                    className={`text-xl font-extrabold transition-colors ${aboutSubTab === "genwork" ? "text-blue-400" : "text-slate-500 hover:text-slate-300"}`}
                  >
                    About GenWork
                  </button>
                  <button 
                    onClick={() => setAboutSubTab("genlayer")}
                    className={`text-xl font-extrabold transition-colors ${aboutSubTab === "genlayer" ? "text-emerald-400" : "text-slate-500 hover:text-slate-300"}`}
                  >
                    About GenLayer
                  </button>
                </div>

                {aboutSubTab === "genwork" && (
                  <div className="space-y-6 animate-in fade-in">
                    <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                      <h3 className="text-2xl font-bold text-white mb-4">What is GenWork?</h3>
                      <p className="text-slate-300 leading-relaxed mb-4">
                        GenWork is a revolutionary decentralized AI-powered Web3 job marketplace built natively on the GenLayer blockchain. It completely eliminates human middlemen and traditional escrow agents.
                      </p>
                      <p className="text-slate-300 leading-relaxed mb-4">
                        Instead of relying on a centralized company to resolve disputes or approve work, GenWork utilizes GenLayer's <strong>Optimistic Democracy</strong> and LLM validators. When a freelancer submits their work, the blockchain's AI directly evaluates the submission against the client's criteria and makes an unbiased, instant decision to approve or reject the work.
                      </p>
                    </div>

                    <div className="bg-black/30 p-6 rounded-2xl border border-white/10">
                      <h3 className="text-lg font-bold text-purple-400 mb-4 uppercase tracking-widest">Build & Contact</h3>
                      <p className="text-white font-bold mb-2">BUILD BY JUBAYIR69</p>
                      <div className="space-y-3 mt-4">
                        <a href="https://github.com/jubayir-hub-69" target="_blank" rel="noreferrer" className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors">
                          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                          github.com/jubayir-hub-69
                        </a>
                        <p className="flex items-center gap-3 text-slate-300">
                          <span className="text-xl">✈️</span> Telegram: JUBAYIR69
                        </p>
                        <a href="https://discordapp.com/users/775330417414635530" target="_blank" rel="noreferrer" className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors">
                          <svg className="w-5 h-5 fill-current" viewBox="0 0 127.14 96.36"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.31,60,73.31,53s5-12.74,11.43-12.74S96.1,46,96,53,91.08,65.69,84.69,65.69Z"/></svg>
                          discordapp.com/users/775330417414635530
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {aboutSubTab === "genlayer" && (
                  <div className="space-y-6 animate-in fade-in">
                    <div className="bg-emerald-900/20 p-6 rounded-2xl border border-emerald-500/30">
                      <h3 className="text-lg font-bold text-emerald-400 mb-4 uppercase tracking-widest">Information</h3>
                      <div className="space-y-3">
                        <a href="https://docs.genlayer.com/" target="_blank" rel="noreferrer" className="block text-slate-300 hover:text-white hover:underline">📚 Docs: docs.genlayer.com</a>
                        <a href="https://www.genlayer.com/blog" target="_blank" rel="noreferrer" className="block text-slate-300 hover:text-white hover:underline">📰 Blog: genlayer.com/blog</a>
                        <a href="https://chatgpt.com/g/g-ix5a9SoHm-deepthought-genlayer" target="_blank" rel="noreferrer" className="block text-slate-300 hover:text-white hover:underline">🤖 Genlayer GPT: DeepThought GenLayer</a>
                      </div>
                    </div>

                    <div className="bg-blue-900/20 p-6 rounded-2xl border border-blue-500/30">
                      <h3 className="text-lg font-bold text-blue-400 mb-4 uppercase tracking-widest">Build on GenLayer</h3>
                      <div className="space-y-3">
                        <a href="https://github.com/yeagerai/genlayer-simulator" target="_blank" rel="noreferrer" className="block text-slate-300 hover:text-white hover:underline">⚙️ Github: yeagerai/genlayer-simulator</a>
                        <a href="https://portal.genlayer.foundation/#/builders" target="_blank" rel="noreferrer" className="block text-slate-300 hover:text-white hover:underline">🏗️ GenLayer Builders: portal.genlayer.foundation</a>
                        <a href="https://studio.genlayer.com/contracts" target="_blank" rel="noreferrer" className="block text-slate-300 hover:text-white hover:underline">💻 Studio: studio.genlayer.com</a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "post" && (
              <div className="bg-[#0B1426]/80 backdrop-blur-xl p-8 md:p-10 rounded-3xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)] w-full">
                <h2 className="text-3xl font-extrabold text-white mb-8">Post a New Job</h2>
                <div className="space-y-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-slate-400 px-1">Job Category</label>
                    <select 
                      className="w-full p-4 bg-[#060c18]/80 border border-white/10 rounded-2xl text-white focus:outline-none focus:border-blue-500 shadow-inner appearance-none cursor-pointer"
                      value={jobCategory}
                      onChange={(e) => setJobCategory(e.target.value)}
                    >
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  
                  <textarea className="w-full p-5 bg-[#060c18]/80 border border-white/10 rounded-2xl text-white focus:outline-none focus:border-blue-500 resize-none transition-colors shadow-inner" rows={4} value={jobDesc} onChange={(e) => setJobDesc(e.target.value)} placeholder="Describe what needs to be done..."></textarea>
                  <div className="flex items-center bg-[#060c18]/80 border border-white/10 rounded-2xl overflow-hidden focus-within:border-blue-500 transition-colors shadow-inner">
                    <span className="px-5 text-slate-400 font-bold bg-white/5 border-r border-white/10 py-4 whitespace-nowrap">Price (GEN)</span>
                    <input type="text" className="w-full p-4 bg-transparent text-white focus:outline-none" value={jobPrice} onChange={handlePriceChange} placeholder="e.g. 5.5" />
                  </div>
                  <button onClick={handlePostJob} disabled={loadingAction !== null} className={`w-full py-4 rounded-2xl font-bold transition-all duration-300 text-lg ${loadingAction === "post" ? "bg-slate-700/50 text-slate-400 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:shadow-[0_0_30px_rgba(37,99,235,0.6)] hover:-translate-y-1"}`}>
                    {loadingAction === "post" ? "Processing..." : "Post Job to GenWork"}
                  </button>
                </div>
              </div>
            )}

            {activeTab === "board" && (
              <div className="w-full">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                  <h2 className="text-3xl font-extrabold text-white drop-shadow-lg">Job Board</h2>
                  
                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto flex-1 md:justify-end">
                    <div className="relative w-full md:w-48">
                      <input 
                        type="text" 
                        placeholder="Search jobs..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#0B1426]/80 text-white px-4 py-2.5 rounded-full text-sm font-bold border border-white/10 shadow-lg outline-none placeholder:text-slate-500 focus:border-blue-500 transition-colors"
                      />
                    </div>

                    <select 
                      className="bg-[#0B1426]/80 text-white px-4 py-2.5 rounded-full text-sm font-bold border border-white/10 shadow-lg outline-none cursor-pointer flex-1 md:flex-none"
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                    >
                      <option value="All">All Categories</option>
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>

                    <button onClick={handleClearCompleted} className="bg-emerald-950/40 text-emerald-400 px-4 py-2.5 rounded-full text-sm font-bold hover:bg-emerald-900/60 border border-emerald-900/50 transition-all shadow-lg hover:scale-105 active:scale-95 backdrop-blur-md flex items-center justify-center gap-2 flex-1 md:flex-none">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Clear Completed
                    </button>
                    <button onClick={() => fetchJobsAndProfiles()} className="bg-white/10 text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-white/20 border border-white/10 transition-all shadow-lg hover:scale-105 active:scale-95 backdrop-blur-md flex-1 md:flex-none">↻ Refresh</button>
                  </div>
                </div>
                <div className="grid gap-6 w-full">
                  {visibleJobs.length === 0 ? (
                    <div className="text-center p-12 bg-[#0B1426]/70 backdrop-blur-xl rounded-3xl border border-white/10 text-slate-400 shadow-xl">No active jobs found. Try adjusting filters or search.</div>
                  ) : (
                    visibleJobs.map((job) => {
                      const isRejectedMsg = job.ai_decision && job.ai_decision.toLowerCase().includes("reject");
                      const isUrl = job.work_data && job.work_data.startsWith("http");
                      const jobMessages = job.messages || [];

                      return (
                        <div key={job.id} className={`bg-[#0B1426]/80 backdrop-blur-xl p-6 md:p-8 rounded-3xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.4)] flex flex-col md:flex-row justify-between items-start md:items-center hover:border-white/20 transition-all w-full overflow-hidden relative group`}>
                          
                          <div className="mb-6 md:mb-0 flex-1 pr-4 min-w-0 w-full z-10">
                            <div className="flex flex-wrap items-center gap-3 mb-4">
                              <span className="bg-blue-900/40 text-blue-300 text-xs font-extrabold px-3 py-1.5 rounded-lg border border-blue-500/30 whitespace-nowrap shadow-sm">JOB #{job.id}</span>
                              <span className="bg-purple-900/40 text-purple-300 text-xs font-extrabold px-3 py-1.5 rounded-lg border border-purple-500/30 whitespace-nowrap shadow-sm">💰 {job.price} GEN</span>
                              {job.category && (
                                <span className="bg-slate-800 text-slate-300 text-xs font-extrabold px-3 py-1.5 rounded-lg border border-slate-600 whitespace-nowrap shadow-sm">🏷️ {job.category}</span>
                              )}
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
                                  <span onClick={() => openProfileModal(job.client)} className="font-mono bg-white/5 hover:bg-blue-500/20 px-2 py-1 rounded text-slate-300 hover:text-blue-300 border border-white/5 cursor-pointer transition-colors" title="View Profile">{displayAddr(job.client)}</span>
                                </p>
                              )}
                              {job.freelancer && (
                                <p className="text-xs text-slate-400 flex items-center justify-between">
                                  <span className="font-semibold text-slate-500">Freelancer</span> 
                                  <span onClick={() => openProfileModal(job.freelancer)} className="font-mono bg-white/5 hover:bg-blue-500/20 px-2 py-1 rounded text-slate-300 hover:text-blue-300 border border-white/5 cursor-pointer transition-colors" title="View Profile">{displayAddr(job.freelancer)}</span>
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
                                
                                {["AI_APPROVED", "AI_REJECTED"].includes(job.status) && (
                                  <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2 text-xs font-bold text-slate-400">
                                    <span className="flex h-2 w-2 relative">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                    </span>
                                    🛡️ GenLayer Consensus: AI Validated (Optimistic)
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="mt-4">
                              <button 
                                onClick={() => setExpandedChat(prev => ({...prev, [job.id]: !prev[job.id]}))}
                                className="text-sm font-bold text-slate-400 hover:text-white flex items-center gap-2 transition-colors bg-white/5 px-3 py-1.5 rounded-lg border border-white/5"
                              >
                                💬 Discussion ({jobMessages.length}) {expandedChat[job.id] ? "▲" : "▼"}
                              </button>

                              {expandedChat[job.id] && (
                                <div className="mt-3 bg-black/40 border border-white/10 rounded-2xl p-4 shadow-inner animate-in slide-in-from-top-2">
                                  <div className="max-h-48 overflow-y-auto pr-2 space-y-3 mb-3 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                                    {jobMessages.length === 0 ? (
                                      <p className="text-xs text-slate-500 text-center italic">No messages yet. Be the first to start the discussion!</p>
                                    ) : (
                                      jobMessages.map((msg: any, i: number) => {
                                        const isMe = address && msg.sender.toLowerCase() === address.toLowerCase();
                                        const isClient = msg.sender.toLowerCase() === job.client.toLowerCase();
                                        const isFreelancer = job.freelancer && msg.sender.toLowerCase() === job.freelancer.toLowerCase();
                                        const msgAvatar = getProfileAvatar(msg.sender);
                                        
                                        return (
                                          <div key={i} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center cursor-pointer relative" onClick={() => openProfileModal(msg.sender)}>
                                              {msgAvatar ? (
                                                <img src={msgAvatar} alt="av" className="w-full h-full object-cover absolute inset-0 z-10" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                              ) : null}
                                              <span className="text-[10px] z-0">👤</span>
                                            </div>
                                            <div className={`p-3 rounded-2xl max-w-[85%] ${isMe ? 'bg-blue-600/20 border-blue-500/30' : 'bg-slate-800/60 border-slate-700/50'} border`}>
                                              <div className="flex justify-between items-center mb-1 gap-4">
                                                <span className="text-[10px] font-bold text-slate-400 cursor-pointer hover:text-blue-300 transition-colors" onClick={() => openProfileModal(msg.sender)}>
                                                  {displayAddr(msg.sender)}
                                                </span>
                                                <div className="flex gap-1">
                                                  {isClient && <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 rounded font-bold uppercase border border-emerald-500/20">Client</span>}
                                                  {isFreelancer && <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 rounded font-bold uppercase border border-purple-500/20">Worker</span>}
                                                </div>
                                              </div>
                                              <p className="text-sm text-slate-200 whitespace-pre-wrap">{msg.text}</p>
                                            </div>
                                          </div>
                                        )
                                      })
                                    )}
                                  </div>
                                  
                                  <div className="flex gap-2">
                                    <input 
                                      type="text" 
                                      placeholder="Type your message..." 
                                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                      value={chatInputs[job.id] || ""}
                                      onChange={(e) => setChatInputs(prev => ({...prev, [job.id]: e.target.value}))}
                                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(job.id)}
                                    />
                                    <button 
                                      onClick={() => handleSendMessage(job.id)}
                                      disabled={loadingAction !== null}
                                      className={`px-4 py-2 rounded-xl font-bold text-sm transition-colors ${loadingAction === 'chat-'+job.id ? 'bg-slate-700 text-slate-500' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
                                    >
                                      {loadingAction === 'chat-'+job.id ? "..." : "Send"}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                          </div>

                          <div className="w-full md:w-auto flex flex-col gap-3 md:min-w-[280px] shrink-0 z-10 mt-6 md:mt-0">
                            
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

                            {job.status === "OPEN" && !isMyJob(job) && (
                              <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Looking for a freelancer on GenWork! 🚀\n\nTask: ${job.desc}\nCategory: ${job.category}\nReward: 💰 ${job.price} GEN\n\nConnect wallet and apply now! #GenLayer #Web3 #GenWork`)}`} 
                                 target="_blank" rel="noreferrer" 
                                 className="flex items-center justify-center gap-2 bg-black hover:bg-slate-900 text-white py-3 px-4 rounded-xl font-bold border border-white/10 transition-all hover:border-white/30">
                                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 22.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                                Share on X
                              </a>
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
