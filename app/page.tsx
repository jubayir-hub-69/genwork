"use client";

import { useState, useEffect, useCallback } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { CONTRACT_ADDRESS } from "./constants";

// GenLayer SDK Imports
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

// Bradbury official info
const BRADBURY_NETWORK = {
  chainId: "0x107D",
  chainName: "GenLayer Testnet Bradbury",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: ["https://rpc-bradbury.genlayer.com"],
  blockExplorerUrls: ["https://explorer-bradbury.genlayer.com"],
};

const genlayerClient = createClient({
  chain: testnetBradbury,
});

export default function Home() {
  const { address, isConnected } = useAccount();
  const [isPending, setIsPending] = useState(false);
  const [activeTab, setActiveTab] = useState("board"); // 'board', 'post', 'history'

  const [jobDesc, setJobDesc] = useState("");
  const [txHash, setTxHash] = useState("");
  const [jobs, setJobs] = useState<any[]>([]);
  const [inputUrls, setInputUrls] = useState<Record<string, string>>({});
  
  // History State
  const [history, setHistory] = useState<{hash: string, action: string, time: string}[]>([]);

  // Load History from Local Storage on start
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
    try {
      setIsPending(true);
      setTxHash("");
      const tx = await sendGenLayerTransaction("post_job", [jobDesc]);
      setTxHash(tx);
      saveToHistory(tx, `Posted Job: ${jobDesc.substring(0, 15)}...`);
      setJobDesc("");
      setTimeout(() => fetchJobs(), 5000);
    } catch (error) {
      console.error(error);
      alert("Transaction failed.");
    } finally {
      setIsPending(false);
    }
  };

  const handleSubmitWork = async (jobId: string) => {
    const url = inputUrls[jobId];
    if (!url) return alert("Paste URL first");
    try {
      setIsPending(true);
      setTxHash("");
      const tx = await sendGenLayerTransaction("submit_work", [jobId, url]);
      setTxHash(tx);
      saveToHistory(tx, `Submitted Work for Job #${jobId}`);
      setTimeout(() => fetchJobs(), 5000);
    } catch (error) {
      console.error(error);
    } finally {
      setIsPending(false);
    }
  };

  const handleApproveWork = async (jobId: string) => {
    try {
      setIsPending(true);
      setTxHash("");
      const tx = await sendGenLayerTransaction("approve_work", [jobId]);
      setTxHash(tx);
      saveToHistory(tx, `Approved Work for Job #${jobId}`);
      setTimeout(() => fetchJobs(), 5000);
    } catch (error) {
      console.error(error);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white font-sans">
      {/* Top Navigation Bar */}
      <nav className="border-b border-gray-800 bg-[#0a0a0a] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            {/* GenLayer Style Logo Icon */}
            <div className="w-8 h-8 flex items-center justify-center border-2 border-white rounded-sm transform rotate-45">
              <div className="w-3 h-3 bg-white transform -rotate-45"></div>
            </div>
            <h1 className="text-2xl font-extrabold tracking-wider ml-2">GENWORK</h1>
          </div>
          
          <div className="flex items-center gap-4 bg-gray-900 p-1 rounded-xl border border-gray-800">
            <button onClick={() => setActiveTab("board")} className={`px-6 py-2 rounded-lg font-semibold transition ${activeTab === "board" ? "bg-white text-black" : "text-gray-400 hover:text-white"}`}>Job Board</button>
            <button onClick={() => setActiveTab("post")} className={`px-6 py-2 rounded-lg font-semibold transition ${activeTab === "post" ? "bg-white text-black" : "text-gray-400 hover:text-white"}`}>Post Job</button>
            <button onClick={() => setActiveTab("history")} className={`px-6 py-2 rounded-lg font-semibold transition ${activeTab === "history" ? "bg-white text-black" : "text-gray-400 hover:text-white"}`}>History</button>
          </div>
          
          <div><ConnectButton /></div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="max-w-4xl mx-auto p-8 mt-6">
        
        {!isConnected ? (
          <div className="text-center p-12 bg-[#111] rounded-2xl border border-gray-800">
            <h2 className="text-2xl font-bold mb-4 text-gray-300">Welcome to Genwork</h2>
            <p className="text-gray-500">Please connect your wallet to view and interact with jobs.</p>
          </div>
        ) : (
          <>
            {/* TX Success Alert */}
            {txHash && (
              <div className="mb-8 p-4 bg-green-900/30 border border-green-500/50 rounded-xl flex justify-between items-center">
                <span className="text-green-400 font-medium">Transaction Successful!</span>
                <a href={`https://explorer-bradbury.genlayer.com/tx/${txHash}`} target="_blank" rel="noreferrer" className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-green-700 transition">View Explorer</a>
              </div>
            )}

            {/* TAB: JOB BOARD */}
            {activeTab === "board" && (
              <div className="animate-fade-in">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-bold">Live Job Board</h2>
                  <button onClick={() => fetchJobs()} className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition border border-gray-700">↻ Refresh</button>
                </div>
                
                <div className="grid gap-6">
                  {jobs.length === 0 ? (
                    <div className="text-center p-10 bg-[#111] rounded-2xl border border-gray-800 text-gray-500">No jobs available right now.</div>
                  ) : (
                    jobs.map((job) => (
                      <div key={job.id} className="bg-[#111] p-6 rounded-2xl border border-gray-800 flex flex-col md:flex-row justify-between items-start md:items-center hover:border-gray-600 transition">
                        <div className="mb-4 md:mb-0">
                          <span className="bg-gray-800 text-gray-300 text-xs font-bold px-3 py-1 rounded-full mb-3 inline-block border border-gray-700">Job #{job.id}</span>
                          <h3 className="text-xl font-semibold mb-2">{job.desc}</h3>
                          <p className="text-sm">
                            Status: <span className={`font-bold ${job.status === "COMPLETED" ? "text-green-400" : job.status === "SUBMITTED" ? "text-yellow-400" : "text-blue-400"}`}>{job.status}</span>
                          </p>
                          {job.url && <p className="text-sm text-gray-400 mt-2">Link: <a href={job.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline break-all">{job.url}</a></p>}
                        </div>
                        
                        <div className="w-full md:w-auto flex flex-col gap-2 min-w-[250px]">
                          {job.status === "OPEN" && (
                            <>
                              <input type="text" placeholder="Paste Work URL here..." className="p-2.5 bg-black border border-gray-700 rounded-lg text-white focus:outline-none focus:border-white" value={inputUrls[job.id] || ""} onChange={(e) => setInputUrls((prev) => ({ ...prev, [job.id]: e.target.value }))} />
                              <button onClick={() => handleSubmitWork(job.id)} disabled={isPending} className="bg-white text-black py-2.5 rounded-lg font-bold hover:bg-gray-200 transition">{isPending ? "Processing..." : "Submit Work"}</button>
                            </>
                          )}
                          {job.status === "SUBMITTED" && (
                            <button onClick={() => handleApproveWork(job.id)} disabled={isPending} className="bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition">Approve & Pay</button>
                          )}
                          {job.status === "COMPLETED" && (
                            <span className="bg-green-900/30 text-green-400 py-3 rounded-lg font-bold text-center border border-green-800">Payment Completed ✓</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB: POST JOB */}
            {activeTab === "post" && (
              <div className="bg-[#111] p-8 rounded-2xl border border-gray-800 animate-fade-in">
                <h2 className="text-3xl font-bold mb-6">Create a New Job</h2>
                <div className="space-y-4">
                  <textarea 
                    className="w-full p-4 bg-black border border-gray-700 rounded-xl text-white focus:outline-none focus:border-white transition" 
                    rows={4} 
                    value={jobDesc} 
                    onChange={(e) => setJobDesc(e.target.value)} 
                    placeholder="Describe what needs to be done..."
                  ></textarea>
                  <button 
                    onClick={handlePostJob} 
                    disabled={isPending} 
                    className="w-full bg-white text-black py-3.5 rounded-xl font-bold text-lg hover:bg-gray-200 transition"
                  >
                    {isPending ? "Processing Transaction..." : "Post Job to Blockchain"}
                  </button>
                </div>
              </div>
            )}

            {/* TAB: HISTORY */}
            {activeTab === "history" && (
              <div className="animate-fade-in">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-bold">Transaction History</h2>
                  {history.length > 0 && (
                    <button onClick={clearHistory} className="bg-red-900/50 text-red-400 px-4 py-2 rounded-lg text-sm hover:bg-red-900 transition border border-red-800">Clear History</button>
                  )}
                </div>
                
                <div className="bg-[#111] rounded-2xl border border-gray-800 overflow-hidden">
                  {history.length === 0 ? (
                    <div className="text-center p-10 text-gray-500">No transactions found in this session.</div>
                  ) : (
                    <div className="divide-y divide-gray-800">
                      {history.map((record, idx) => (
                        <div key={idx} className="p-4 md:p-6 flex flex-col md:flex-row justify-between md:items-center hover:bg-[#1a1a1a] transition">
                          <div className="mb-2 md:mb-0">
                            <h4 className="font-semibold text-lg">{record.action}</h4>
                            <p className="text-xs text-gray-500 mt-1">{record.time}</p>
                          </div>
                          <a href={`https://explorer-bradbury.genlayer.com/tx/${record.hash}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-sm font-mono truncate max-w-[200px] md:max-w-[300px]">
                            {record.hash.substring(0, 15)}...{record.hash.substring(record.hash.length - 10)}
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
