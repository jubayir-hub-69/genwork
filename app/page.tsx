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

const toWeiHex = (eth: string) => {
  const [whole, fraction = ""] = eth.split(".");
  const paddedFraction = fraction.padEnd(18, "0").slice(0, 18);
  const weiString = whole + paddedFraction;
  return "0x" + BigInt(weiString).toString(16);
};

export default function Home() {
  const { address, isConnected } = useAccount();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState("post");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; tx: string } | null>(null);

  const [jobDesc, setJobDesc] = useState("");
  const [jobPrice, setJobPrice] = useState("");
  const [jobs, setJobs] = useState<any[]>([]);
  const [inputUrls, setInputUrls] = useState<Record<string, string>>({});
  const [appealReasons, setAppealReasons] = useState<Record<string, string>>({});
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
    if (!jobDesc || !jobPrice) return alert("Fill all fields");
    if (isNaN(Number(jobPrice)) || Number(jobPrice) <= 0) return alert("Enter valid price");
    if (!address) return alert("Connect wallet first");
    
    try {
      setLoadingAction("post");
      const tx = await sendGenLayerTransaction("post_job", [jobDesc, jobPrice.toString(), address]);
      saveToHistory(tx, `Posted Job for ${jobPrice} GEN`);
      setJobDesc("");
      setJobPrice("");
      showToast("Job Posted Successfully!", tx);
      setTimeout(() => fetchJobs(), 5000);
    } catch (error) {
      console.error(error);
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
      saveToHistory(tx, `Submitted Work for AI Eval`);
      showToast("Work Submitted to AI Evaluator!", tx);
      setTimeout(() => fetchJobs(), 5000);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleApproveWork = async (job: any) => {
    if (!address) return alert("Connect wallet first");
    try {
      setLoadingAction(`approve-${job.id}`);
      const provider = (window as any).ethereum;
      await switchToGenLayerNetwork();

      showToast("Sending GEN tokens to freelancer...", "");
      const hexValue = toWeiHex(job.price);
      const paymentTx = await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: address, to: job.freelancer, value: hexValue }],
      });

      saveToHistory(paymentTx, `Paid ${job.price} GEN`);
      showToast("Confirming on GenLayer...", paymentTx);

      const tx = await sendGenLayerTransaction("approve_work", [job.id, address]);
      saveToHistory(tx, `Approved Job #${job.id}`);
      showToast("Payment Delivered!", tx);
      setTimeout(() => fetchJobs(), 5000);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRejectWork = async (jobId: string) => {
    if (!address) return alert("Connect wallet first");
    try {
      setLoadingAction(`reject-${jobId}`);
      const tx = await sendGenLayerTransaction("reject_work", [jobId, address]);
      saveToHistory(tx, `Rejected Job #${jobId}`);
      showToast("Job Rejected and Re-opened!", tx);
      setTimeout(() => fetchJobs(), 5000);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAppeal = async (jobId: string) => {
    const reason = appealReasons[jobId];
    if (!reason) return alert("Please enter appeal reason");
    if (!address) return alert("Connect wallet first");
    try {
      setLoadingAction(`appeal-${jobId}`);
      const tx = await sendGenLayerTransaction("appeal_decision", [jobId, reason]);
      saveToHistory(tx, `Appealed Job #${jobId}`);
      showToast("Appeal Submitted Successfully!", tx);
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
        <div className="fixed top-6 right-6 z-[100] bg-green-600/95 backdrop-blur text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-green-500/50">
          <span className="font-medium">{toast.message}</span>
          {toast.tx && (
            <a href={`https://explorer-bradbury.genlayer.com/tx/${toast.tx}`} target="_blank" rel="noreferrer" className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-sm font-bold">
              View
            </a>
          )}
        </div>
      )}

      <nav className="border-b border-slate-800/60 bg-[#020817]/90 backdrop-blur-md sticky top-0 z-40 transition-all duration-300">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleTabChange("post")}>
            <svg viewBox="0 0 100 100" className="w-10 h-10 text-white fill-current transform transition-transform duration-300 hover:scale-105">
              <path d="M50 15 L25 70 L45 58 L50 65 L55 58 L75 70 Z" fill="currentColor" />
              <polygon points="50,69 62,81 50,93 38,81" fill="currentColor" />
            </svg>
            <h1 className="text-2xl font-extrabold tracking-wide text-white">TrustWork</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:block">
              <ConnectButton showBalance={false} />
            </div>
            <button onClick={() => setIsMenuOpen(true)} className="p-2 border border-slate-700 rounded-full bg-slate-800/50 hover:bg-slate-700 block md:hidden">
              <svg className="w-6 h-6 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
          </div>
        </div>
      </nav>

      <div className={`fixed inset-0 z-50 transform transition-transform duration-300 ease-in-out ${isMenuOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}></div>
        <div className="absolute right-0 top-0 h-full w-72 bg-[#0a1122] border-l border-slate-800 shadow-2xl flex flex-col p-6">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-xl font-bold text-white">Menu</h2>
            <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-slate-800/50 rounded-full">
              <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <button onClick={() => handleTabChange("post")} className={`p-4 rounded-xl text-left font-semibold border ${activeTab === "post" ? "bg-slate-800 border-slate-600 text-white shadow-lg" : "border-transparent text-slate-400 hover:bg-slate-800/50"}`}>Dashboard</button>
            <button onClick={() => handleTabChange("board")} className={`p-4 rounded-xl text-left font-semibold border ${activeTab === "board" ? "bg-slate-800 border-slate-600 text-white shadow-lg" : "border-transparent text-slate-400 hover:bg-slate-800/50"}`}>Job Board</button>
            <button onClick={() => handleTabChange("history")} className={`p-4 rounded-xl text-left font-semibold border ${activeTab === "history" ? "bg-slate-800 border-slate-600 text-white shadow-lg" : "border-transparent text-slate-400 hover:bg-slate-800/50"}`}>History</button>
          </div>
          <div className="mt-auto pt-8 border-t border-slate-800 block md:hidden">
            <ConnectButton showBalance={false} />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 md:p-8 mt-4">
        {!isConnected ? (
          <div className="text-center p-12 bg-[#0B1426] rounded-3xl border border-slate-800/80 shadow-xl mt-10">
            <h2 className="text-3xl font-bold mb-4 text-white">Welcome to TrustWork</h2>
            <p className="text-slate-400 text-lg">AI-powered decentralized job platform.</p>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {activeTab === "post" && (
              <div className="bg-[#0B1426] p-8 md:p-10 rounded-3xl border border-slate-800/80 shadow-xl">
                <h2 className="text-3xl font-extrabold text-white mb-8">Post a New Job</h2>
                <div className="space-y-6">
                  <textarea className="w-full p-5 bg-[#060c18] border border-slate-700 rounded-2xl text-white focus:outline-none focus:border-blue-500 resize-none transition-colors" rows={4} value={jobDesc} onChange={(e) => setJobDesc(e.target.value)} placeholder="Describe what needs to be done..."></textarea>
                  <div className="flex items-center bg-[#060c18] border border-slate-700 rounded-2xl overflow-hidden focus-within:border-blue-500 transition-colors">
                    <span className="px-5 text-slate-400 font-bold bg-slate-800/50 border-r border-slate-700 py-4">Price (GEN)</span>
                    <input type="number" step="0.01" className="w-full p-4 bg-transparent text-white focus:outline-none" value={jobPrice} onChange={(e) => setJobPrice(e.target.value)} placeholder="e.g. 5.5" />
                  </div>
                  <button onClick={handlePostJob} disabled={loadingAction !== null} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-500 transition-all duration-300 disabled:opacity-50">
                    {loadingAction === "post" ? "Processing..." : "Post Job to GenLayer"}
                  </button>
                </div>
              </div>
            )}

            {activeTab === "board" && (
              <div>
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-extrabold text-white">Job Board</h2>
                  <button onClick={() => fetchJobs()} className="bg-slate-800 text-white px-5 py-2.5 rounded-full text-sm hover:bg-slate-700 border border-slate-700 transition-all shadow-lg hover:scale-105 active:scale-95">↻ Refresh</button>
                </div>
                <div className="grid gap-6">
                  {jobs.length === 0 ? (
                    <div className="text-center p-12 bg-[#0B1426] rounded-3xl border border-slate-800/80 text-slate-400">No jobs available right now.</div>
                  ) : (
                    jobs.map((job) => (
                      <div key={job.id} className="bg-[#0B1426] p-6 rounded-3xl border border-slate-800/80 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center hover:border-slate-600 transition-all">
                        <div className="mb-4 md:mb-0 flex-1 pr-4">
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="bg-blue-900/40 text-blue-300 text-xs font-bold px-3 py-1 rounded-full border border-blue-800/50">Job #{job.id}</span>
                            <span className="bg-purple-900/40 text-purple-300 text-xs font-bold px-3 py-1 rounded-full border border-purple-800/50">💰 {job.price} GEN</span>
                            {isMyJob(job) && (<span className="bg-green-900/40 text-green-400 text-xs font-bold px-3 py-1 rounded-full border border-green-800/50">🔒 Your Job</span>)}
                          </div>
                          <h3 className="text-xl font-bold text-white mb-2">{job.desc}</h3>
                          
                          <p className="text-sm text-slate-400 flex items-center gap-2">
                            Status: <span className={`font-bold ${job.status === "COMPLETED" ? "text-green-400" : job.status === "AI_APPROVED" ? "text-green-300" : job.status === "AI_REJECTED" ? "text-red-400" : "text-amber-400"}`}>{job.status}</span>
                          </p>
                          
                          {(job.status !== "OPEN" && job.ai_decision) && (
                            <div className="mt-2 p-2 bg-[#060c18] rounded-lg border border-slate-800/60 inline-block">
                              <p className="text-xs text-slate-300">🤖 {job.ai_decision}</p>
                            </div>
                          )}

                          {job.client && (<p className="text-xs text-slate-500 mt-3">Client: <span className="font-mono text-slate-400">{shortAddr(job.client)}</span></p>)}
                          {job.freelancer && (<p className="text-xs text-slate-500 mt-1">Freelancer: <span className="font-mono text-slate-400">{shortAddr(job.freelancer)}</span></p>)}
                          {job.url && (<p className="text-sm text-slate-400 mt-2">Work Link: <a href={job.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">{job.url}</a></p>)}
                        </div>

                        <div className="w-full md:w-auto flex flex-col gap-3 min-w-[260px]">
                          
                          {job.status === "OPEN" && (
                            isMyJob(job) ? (
                              <div className="bg-blue-900/20 text-blue-400 py-3 rounded-xl font-bold text-center border border-blue-800/50">
                                Waiting for Work...
                              </div>
                            ) : (
                              <>
                                <input type="text" placeholder="Paste Work URL here..." className="p-3 bg-[#060c18] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500" value={inputUrls[job.id] || ""} onChange={(e) => setInputUrls((prev) => ({ ...prev, [job.id]: e.target.value }))} />
                                <button onClick={() => handleSubmitWork(job.id)} disabled={loadingAction !== null} className="bg-slate-200 text-slate-900 py-3 rounded-xl font-bold hover:bg-white transition-all disabled:opacity-50">
                                  {loadingAction === `submit-${job.id}` ? "AI is Evaluating..." : "Submit to AI"}
                                </button>
                              </>
                            )
                          )}

                          {["SUBMITTED", "AI_APPROVED", "APPEALED"].includes(job.status) && (
                            isMyJob(job) ? (
                              <div className="flex flex-col gap-2">
                                {job.status === "SUBMITTED" && (
                                  <span className="text-xs text-amber-400 mb-1 text-center">⚠️ Manual Check Needed</span>
                                )}
                                <button onClick={() => handleApproveWork(job)} disabled={loadingAction !== null} className="bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-500 transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] disabled:opacity-50">
                                  {loadingAction === `approve-${job.id}` ? "Sending GEN..." : `Approve & Pay ${job.price} GEN`}
                                </button>
                                <button onClick={() => handleRejectWork(job.id)} disabled={loadingAction !== null} className="bg-red-600/20 text-red-400 border border-red-800/50 py-3 rounded-xl font-bold hover:bg-red-600 hover:text-white transition-all disabled:opacity-50">
                                  {loadingAction === `reject-${job.id}` ? "Rejecting..." : "Reject Work"}
                                </button>
                              </div>
                            ) : (
                              <div className="bg-amber-900/20 text-amber-400 py-3 px-2 rounded-xl font-bold text-center border border-amber-800/50 flex flex-col">
                                <span>Work Submitted 🚀</span>
                                <span className="text-xs mt-1">Waiting for {job.price} GEN Payment</span>
                              </div>
                            )
                          )}

                          {job.status === "AI_REJECTED" && (
                            isMyJob(job) ? (
                              <div className="flex flex-col gap-2">
                                <span className="text-xs text-red-400 text-center">🤖 AI Rejected this work.</span>
                                <button onClick={() => handleRejectWork(job.id)} disabled={loadingAction !== null} className="bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-500 transition-all disabled:opacity-50">
                                  {loadingAction === `reject-${job.id}` ? "Processing..." : "Confirm Reject & Re-open"}
                                </button>
                              </div>
                            ) : (
                              <>
                                <input type="text" placeholder="Reason for appeal..." className="p-3 bg-[#060c18] border border-red-900/50 rounded-xl text-white focus:outline-none focus:border-red-500" value={appealReasons[job.id] || ""} onChange={(e) => setAppealReasons((prev) => ({ ...prev, [job.id]: e.target.value }))} />
                                <button onClick={() => handleAppeal(job.id)} disabled={loadingAction !== null} className="bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-500 transition-all disabled:opacity-50">
                                  {loadingAction === `appeal-${job.id}` ? "Submitting..." : "Submit Appeal"}
                                </button>
                              </>
                            )
                          )}

                          {job.status === "COMPLETED" && (
                            <div className="bg-green-900/20 text-green-400 py-3 rounded-xl font-bold text-center border border-green-800/50 flex flex-col shadow-inner">
                              <span>Payment Delivered ✓</span>
                              <span className="text-xs mt-1 text-green-500">{job.price} GEN Sent</span>
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
                </div>
                <div className="bg-[#0B1426] rounded-3xl border border-slate-800/80 overflow-hidden shadow-xl">
                  {history.length === 0 ? (
                    <div className="text-center p-12 text-slate-500">No transactions yet.</div>
                  ) : (
                    <div className="divide-y divide-slate-800/60">
                      {history.map((record, idx) => (
                        <div key={idx} className="p-5 flex justify-between items-center hover:bg-[#0f1b33] transition-colors">
                          <div>
                            <h4 className="font-bold text-slate-200">{record.action}</h4>
                            <p className="text-sm text-slate-500">{record.time}</p>
                          </div>
                          <a href={`https://explorer-bradbury.genlayer.com/tx/${record.hash}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-white text-sm font-bold bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700">
                            View
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
