"use client";

import { useState, useEffect, useCallback } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { CONTRACT_ADDRESS } from "./constants";

import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const BRADBURY_NETWORK = {
  chainId: "0x107D",
  chainName: "GenLayer Testnet Bradbury",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: ["https://rpc-bradbury.genlayer.com"],
  blockExplorerUrls: ["https://explorer-bradbury.genlayer.com"],
};

const genlayerClient = createClient({ chain: testnetBradbury });

export default function Home() {
  const { address, isConnected } = useAccount();
  
  // নতুন লোডিং স্টেট: এখন নির্দিষ্ট জবের বাটন ট্র্যাক করবে
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState("post");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; tx: string } | null>(null);

  const [jobDesc, setJobDesc] = useState("");
  const [jobs, setJobs] = useState<any[]>([]);
  const [inputUrls, setInputUrls] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<{ hash: string; action: string; time: string }[]>([]);

  const showToast = (message: string, tx: string) => {
    setToast({ message, tx });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const saved = localStorage.getItem("genwork_tx_history");
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const saveToHistory = (hash: string, action: string) => {
    const newRecord = { hash, action, time: new Date().toLocaleString() };
    const updatedHistory = [newRecord, ...history];
    setHistory(updatedHistory);
    localStorage.setItem("genwork_tx_history", JSON.stringify(updatedHistory));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("genwork_tx_history");
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
    } catch (error) {
      console.error("Error fetching jobs:", error);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const switchToGenLayerNetwork = async () => {
    const provider = (window as any).ethereum;
    if (!provider) throw new Error("No crypto wallet found");
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BRADBURY_NETWORK.chainId }],
      });
    } catch (error: any) {
      if (error.code === 4902) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [BRADBURY_NETWORK],
        });
      } else {
        throw error;
      }
    }
  };

  const sendGenLayerTransaction = async (functionName: string, args: any[]) => {
    if (!address) throw new Error("Wallet not connected");
    await switchToGenLayerNetwork();
    const client = createClient({
      chain: testnetBradbury,
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
    if (!jobDesc) return alert("Fill job description");
    if (!address) return alert("Connect wallet first");
    try {
      setLoadingAction("post");
      const tx = await sendGenLayerTransaction("post_job", [jobDesc, address]);
      
      saveToHistory(tx, `Posted Job: ${jobDesc.substring(0, 20)}...`);
      setJobDesc("");
      showToast("Job Posted Successfully!", tx);
      setTimeout(() => fetchJobs(), 5000);
    } catch (error) {
      console.error(error);
      alert("Transaction failed.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSubmitWork = async (jobId: string) => {
    const url = inputUrls[jobId];
    if (!url) return alert("Paste URL first");
    if (!address) return alert("Connect wallet first");
    try {
      setLoadingAction(`submit-${jobId}`);
      const tx = await sendGenLayerTransaction("submit_work", [jobId, url, address]);
      
      saveToHistory(tx, `Submitted Work for Job #${jobId}`);
      showToast("Work Submitted Successfully!", tx);
      setTimeout(() => fetchJobs(), 5000);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleApproveWork = async (jobId: string) => {
    if (!address) return alert("Connect wallet first");
    try {
      setLoadingAction(`approve-${jobId}`);
      const tx = await sendGenLayerTransaction("approve_work", [jobId, address]);
      
      saveToHistory(tx, `Approved Work for Job #${jobId}`);
      showToast("Work Approved & Payment Released!", tx);
      setTimeout(() => fetchJobs(), 5000);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setIsMenuOpen(false);
  };

  const shortAddr = (addr: string) =>
    addr ? `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}` : "";

  const isMyJob = (job: any) =>
    address && job.client?.toLowerCase() === address.toLowerCase();

  return (
    <main className="min-h-screen bg-[#020817] text-slate-200 font-sans selection:bg-blue-500/30">

      {toast && (
        <div className="fixed top-6 right-6 z-[100] bg-green-600/95 backdrop-blur text-white px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-right-10 flex items-center gap-4 border border-green-500/50">
          <span className="font-medium">{toast.message}</span>
          <a
            href={`https://explorer-bradbury.genlayer.com/tx/${toast.tx}`}
            target="_blank"
            rel="noreferrer"
            className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition text-sm font-bold"
          >
            View
          </a>
        </div>
      )}

      <nav className="border-b border-slate-800/60 bg-[#020817]/90 backdrop-blur-md sticky top-0 z-40 transition-all duration-300">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleTabChange("post")}>
            <svg viewBox="0 0 100 100" className="w-10 h-10 text-white fill-current transform transition-transform duration-300 hover:scale-105">
              <path d="M50 15 L25 70 L45 58 L50 65 L55 58 L75 70 Z" fill="currentColor" />
              <polygon points="50,69 62,81 50,93 38,81" fill="currentColor" />
            </svg>
            <h1 className="text-2xl font-extrabold tracking-wide text-white">Genwork</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:block">
              <ConnectButton showBalance={false} />
            </div>
            <button
              onClick={() => setIsMenuOpen(true)}
              className="p-2 border border-slate-700 rounded-full bg-slate-800/50 hover:bg-slate-700 transition-all duration-300 focus:outline-none"
            >
              <svg className="w-6 h-6 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
              </svg>
            </button>
          </div>
        </div>
      </nav>

      <div className={`fixed inset-0 z-50 transform transition-transform duration-300 ease-in-out ${isMenuOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}></div>
        <div className="absolute right-0 top-0 h-full w-72 bg-[#0a1122] border-l border-slate-800 shadow-2xl flex flex-col p-6 transition-all duration-300">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-xl font-bold text-white">Menu</h2>
            <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-slate-800/50 hover:bg-slate-700 rounded-full transition">
              <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <button onClick={() => handleTabChange("post")} className={`p-4 rounded-xl text-left font-semibold transition-all duration-300 border ${activeTab === "post" ? "bg-slate-800 border-slate-600 text-white shadow-lg" : "bg-transparent border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-white"}`}>Dashboard</button>
            <button onClick={() => handleTabChange("board")} className={`p-4 rounded-xl text-left font-semibold transition-all duration-300 border ${activeTab === "board" ? "bg-slate-800 border-slate-600 text-white shadow-lg" : "bg-transparent border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-white"}`}>Job Board</button>
            <button onClick={() => handleTabChange("history")} className={`p-4 rounded-xl text-left font-semibold transition-all duration-300 border ${activeTab === "history" ? "bg-slate-800 border-slate-600 text-white shadow-lg" : "bg-transparent border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-white"}`}>History</button>
          </div>
          <div className="mt-auto pt-8 border-t border-slate-800 block md:hidden">
            <ConnectButton showBalance={false} />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 md:p-8 mt-4 transition-all duration-500 ease-in-out">

        {!isConnected ? (
          <div className="text-center p-12 bg-[#0B1426] rounded-3xl border border-slate-800/80 shadow-xl mt-10">
            <h2 className="text-3xl font-bold mb-4 text-white">Welcome to Genwork</h2>
            <p className="text-slate-400 text-lg">Connect your wallet to experience the fastest blockchain job platform.</p>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

            {activeTab === "post" && (
              <div className="bg-[#0B1426] p-8 md:p-10 rounded-3xl border border-slate-800/80 shadow-xl">
                <h2 className="text-3xl font-extrabold text-white mb-8">Dashboard</h2>
                <div className="space-y-6">
                  <textarea
                    className="w-full p-5 bg-[#060c18] border border-slate-700 rounded-2xl text-white focus:outline-none focus:border-blue-500 transition-colors resize-none placeholder-slate-500"
                    rows={5}
                    value={jobDesc}
                    onChange={(e) => setJobDesc(e.target.value)}
                    placeholder="Describe what needs to be done..."
                  ></textarea>
                  <button
                    onClick={handlePostJob}
                    disabled={loadingAction !== null}
                    className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:scale-[1.01] active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingAction === "post" ? "Processing Transaction..." : "Post Job to GenLayer"}
                  </button>
                </div>
              </div>
            )}

            {activeTab === "board" && (
              <div>
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-extrabold text-white">Job Board</h2>
                  <button onClick={() => fetchJobs()} className="bg-slate-800 text-white px-5 py-2.5 rounded-full text-sm hover:bg-slate-700 transition-all duration-300 border border-slate-700 hover:scale-105 active:scale-95 shadow-lg">
                    ↻ Refresh
                  </button>
                </div>

                <div className="grid gap-6">
                  {jobs.length === 0 ? (
                    <div className="text-center p-12 bg-[#0B1426] rounded-3xl border border-slate-800/80 text-slate-400 shadow-xl">No jobs available right now.</div>
                  ) : (
                    jobs.map((job) => (
                      <div key={job.id} className="bg-[#0B1426] p-6 rounded-3xl border border-slate-800/80 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center hover:border-slate-600 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                        <div className="mb-4 md:mb-0 flex-1 pr-4">
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="bg-blue-900/40 text-blue-300 text-xs font-bold px-3 py-1 rounded-full border border-blue-800/50">
                              Job #{job.id}
                            </span>
                            {isMyJob(job) && (
                              <span className="bg-green-900/40 text-green-400 text-xs font-bold px-3 py-1 rounded-full border border-green-800/50">
                                🔒 Your Job
                              </span>
                            )}
                          </div>
                          <h3 className="text-xl font-bold text-white mb-2">{job.desc}</h3>
                          <p className="text-sm text-slate-400">
                            Status:{" "}
                            <span className={`font-bold ml-1 ${job.status === "COMPLETED" ? "text-green-400" : job.status === "SUBMITTED" ? "text-amber-400" : "text-blue-400"}`}>
                              {job.status}
                            </span>
                          </p>
                          {job.client && (
                            <p className="text-xs text-slate-500 mt-1">
                              Client: <span className="font-mono text-slate-400">{shortAddr(job.client)}</span>
                            </p>
                          )}
                          {job.freelancer && (
                            <p className="text-xs text-slate-500 mt-1">
                              Freelancer: <span className="font-mono text-slate-400">{shortAddr(job.freelancer)}</span>
                            </p>
                          )}
                          {job.url && (
                            <p className="text-sm text-slate-400 mt-2">
                              Work Link:{" "}
                              <a href={job.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline transition">
                                {job.url}
                              </a>
                            </p>
                          )}
                        </div>

                        <div className="w-full md:w-auto flex flex-col gap-3 min-w-[260px]">
                          {job.status === "OPEN" && (
                            <>
                              <input
                                type="text"
                                placeholder="Paste Work URL here..."
                                className="p-3 bg-[#060c18] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-colors"
                                value={inputUrls[job.id] || ""}
                                onChange={(e) => setInputUrls((prev) => ({ ...prev, [job.id]: e.target.value }))}
                              />
                              <button
                                onClick={() => handleSubmitWork(job.id)}
                                disabled={loadingAction !== null}
                                className="bg-slate-200 text-slate-900 py-3 rounded-xl font-bold hover:bg-white hover:scale-[1.02] active:scale-95 transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {loadingAction === `submit-${job.id}` ? "Processing..." : "Submit Work"}
                              </button>
                            </>
                          )}
                          {job.status === "SUBMITTED" && (
                            <button
                              onClick={() => handleApproveWork(job.id)}
                              disabled={loadingAction !== null}
                              className="bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-500 hover:shadow-[0_0_15px_rgba(37,99,235,0.4)] hover:scale-[1.02] active:scale-95 transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {loadingAction === `approve-${job.id}` ? "Approving..." : "Approve & Pay"}
                            </button>
                          )}
                          {job.status === "COMPLETED" && (
                            <div className="bg-green-900/20 text-green-400 py-3 rounded-xl font-bold text-center border border-green-800/50 shadow-inner">
                              Payment Released ✓
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === "history" && (
              <div>
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-extrabold text-white">Transaction History</h2>
                  {history.length > 0 && (
                    <button onClick={clearHistory} className="bg-red-900/30 text-red-400 px-5 py-2.5 rounded-full text-sm hover:bg-red-900/50 transition-all duration-300 border border-red-800/50 hover:scale-105 active:scale-95">
                      Clear History
                    </button>
                  )}
                </div>
                
                <div className="bg-[#0B1426] rounded-3xl border border-slate-800/80 shadow-xl overflow-hidden">
                  {history.length === 0 ? (
                    <div className="text-center p-12 text-slate-500">No transactions found in this session.</div>
                  ) : (
                    <div className="divide-y divide-slate-800/60">
                      {history.map((record, idx) => (
                        <div key={idx} className="p-5 md:p-6 flex flex-col md:flex-row justify-between md:items-center hover:bg-[#0f1b33] transition-colors duration-300 group">
                          <div className="mb-3 md:mb-0">
                            <h4 className="font-bold text-lg text-slate-200">{record.action}</h4>
                            <p className="text-sm text-slate-500 mt-1">{record.time}</p>
                          </div>
                          <a href={`https://explorer-bradbury.genlayer.com/tx/${record.hash}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-slate-800/50 px-4 py-2 rounded-xl text-blue-400 hover:text-white hover:bg-blue-600 transition-all duration-300 text-sm font-mono border border-slate-700 group-hover:border-blue-500">
                            View on Explorer
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
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
