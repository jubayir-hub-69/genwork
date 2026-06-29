"use client";

import { useState, useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract } from "wagmi";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./constants";

// GenLayer SDK Imports
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

// Bradbury official info (For manual network addition without Snap)
const BRADBURY_NETWORK = {
  chainId: "0x107D", // 4221 in hex
  chainName: "GenLayer Testnet Bradbury",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: ["https://rpc-bradbury.genlayer.com"],
  blockExplorerUrls: ["https://explorer-bradbury.genlayer.com"],
};

export default function Home() {
  const { address, isConnected } = useAccount();
  const [isPending, setIsPending] = useState(false);

  const [jobDesc, setJobDesc] = useState("");
  const [txHash, setTxHash] = useState("");
  const [jobs, setJobs] = useState<any[]>([]);
  const [inputUrls, setInputUrls] = useState<Record<string, string>>({});

  const { data: jobsData, refetch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "get_all_jobs",
  });

  useEffect(() => {
    if (jobsData) {
      try {
        const parsedJobs = JSON.parse(jobsData as string);
        setJobs(parsedJobs);
      } catch (e) {
        console.error("Error parsing jobs:", e);
      }
    }
  }, [jobsData]);

  // Switch network manually - works on both MetaMask and Rabby without Snaps
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
        // Add network if it doesn't exist in the wallet
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [BRADBURY_NETWORK],
        });
      } else {
        throw error;
      }
    }
  };

  // GenLayer SDK Transaction Function (Without Snap)
  const sendGenLayerTransaction = async (functionName: string, args: any[]) => {
    if (!address) throw new Error("Wallet not connected");

    // Step 1: Switch network manually
    await switchToGenLayerNetwork();

    // Step 2: Create Client
    const client = createClient({
      chain: testnetBradbury,
      account: address as `0x${string}`,
    });

    // Note: client.connect() is intentionally removed to avoid triggering the Snap requirement

    // Step 3: Send Transaction
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
      setJobDesc("");
      setTimeout(() => refetch(), 5000);
    } catch (error) {
      console.error("Transaction Error:", error);
      alert("Transaction failed or rejected by user. Check console.");
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
      setTimeout(() => refetch(), 5000);
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
      setTimeout(() => refetch(), 5000);
    } catch (error) {
      console.error(error);
    } finally {
      setIsPending(false);
    }
  };

  const handleUrlChange = (jobId: string, value: string) => {
    setInputUrls((prev) => ({ ...prev, [jobId]: value }));
  };

  return (
    <main className="min-h-screen p-10 bg-gray-50 text-gray-900">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-end mb-4"><ConnectButton /></div>
        <div className="text-center mb-12">
          <h1 className="text-5xl font-extrabold text-blue-600 mb-3">Genwork</h1>
          <p className="text-gray-600">Dynamic Blockchain Job Board</p>
        </div>

        {!isConnected ? (
          <div className="text-center p-10 bg-white rounded-2xl border shadow-sm">
            <p className="text-xl">Please connect wallet.</p>
          </div>
        ) : (
          <>
            <div className="bg-white p-8 rounded-2xl border mb-10 shadow-sm">
              <h2 className="text-2xl font-bold mb-6">Post a New Job (Client)</h2>
              <textarea 
                className="w-full p-4 border rounded-xl mb-4" 
                rows={3} 
                value={jobDesc} 
                onChange={(e) => setJobDesc(e.target.value)} 
                placeholder="Describe the job..."
              ></textarea>
              <button 
                onClick={handlePostJob} 
                disabled={isPending} 
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition"
              >
                {isPending ? "Processing..." : "Post Job"}
              </button>
            </div>

            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-3xl font-bold">Live Job Board</h2>
              <button onClick={() => refetch()} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 transition">
                Refresh Jobs
              </button>
            </div>
            
            <div className="grid grid-cols-1 gap-6">
              {jobs.length === 0 ? (
                <div className="text-center p-10 bg-white rounded-2xl border text-gray-500 shadow-sm">
                  No jobs posted yet. Be the first to post!
                </div>
              ) : (
                jobs.map((job) => (
                  <div key={job.id} className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center">
                    
                    <div className="mb-4 md:mb-0">
                      <span className="bg-gray-200 text-xs font-bold px-3 py-1 rounded-full mb-2 inline-block">Job #{job.id}</span>
                      <h3 className="text-xl font-semibold mb-2">{job.desc}</h3>
                      <p className="text-sm font-medium">
                        Status: <span className={job.status === "COMPLETED" ? "text-green-600" : job.status === "SUBMITTED" ? "text-yellow-600" : "text-blue-600"}>{job.status}</span>
                      </p>
                      {job.url && <p className="text-sm text-gray-500 mt-1">URL: <a href={job.url} target="_blank" rel="noreferrer" className="text-blue-500 underline">{job.url}</a></p>}
                    </div>
                    
                    <div className="w-full md:w-auto flex flex-col gap-2">
                      {job.status === "OPEN" && (
                        <>
                          <input type="text" placeholder="Paste Work URL" className="p-2 border rounded-lg" value={inputUrls[job.id] || ""} onChange={(e) => handleUrlChange(job.id, e.target.value)} />
                          <button onClick={() => handleSubmitWork(job.id)} disabled={isPending} className="bg-green-600 text-white py-2 px-6 rounded-lg font-bold hover:bg-green-700 transition">Submit Work</button>
                        </>
                      )}
                      
                      {job.status === "SUBMITTED" && (
                        <button onClick={() => handleApproveWork(job.id)} disabled={isPending} className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-700 transition w-full">Approve Work</button>
                      )}
                      
                      {job.status === "COMPLETED" && (
                        <span className="bg-green-100 text-green-800 px-6 py-3 rounded-lg font-bold w-full text-center block border border-green-200">Payment Released</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {txHash && (
          <div className="mt-8 p-6 bg-green-50 border rounded-2xl text-center shadow-sm">
            <h3 className="text-xl font-bold text-green-800 mb-2">Transaction Successful!</h3>
            <a href={`https://explorer-bradbury.genlayer.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="bg-green-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-green-700 transition inline-block">View on Explorer</a>
          </div>
        )}
      </div>
    </main>
  );
}
