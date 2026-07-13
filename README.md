<div align="center">
  
  # 🚀 GenWork
  **The Adjudication Layer for the Agentic Economy.**

  [![Built on GenLayer](https://img.shields.io/badge/Built_on-GenLayer-00ff00?style=for-the-badge&logo=blockchain)](https://genlayer.com/)
  [![Next.js](https://img.shields.io/badge/Next.js-Black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
  [![Python Contracts](https://img.shields.io/badge/Smart_Contracts-Python-blue?style=for-the-badge&logo=python)](https://studio.genlayer.com/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

  <p align="center">
    A decentralized, AI-powered Web3 job marketplace where LLM validators autonomously evaluate work, resolve disputes, and secure payments without human middlemen.
  </p>
</div>

---

## 📖 Overview

**GenWork** redefines the freelance economy by integrating **GenLayer's Optimistic Democracy**. Traditional escrow platforms rely on centralized human mediators to resolve disputes. GenWork replaces this with highly capable AI algorithms running directly on the blockchain. 

When a freelancer submits their work (URL or raw text), the AI evaluates it strictly against the client's original criteria. If approved, the smart contract greenlights the transaction for a secure, one-click payment.

---

## ✨ Key Features

*   🤖 **Strict AI Evaluation:** GenLayer's AI directly reads and validates submissions. It acts as an unbiased QA tester—rejecting lazy inputs and ensuring high-quality deliveries.
*   👤 **Global On-Chain Profiles:** Users can set custom Nicknames and Avatar URLs directly on the blockchain. Profiles display transparent, real-time stats including total jobs posted, jobs completed, and lifetime GEN earnings.
*   💬 **On-Chain Discussion:** A fully decentralized messaging system allows clients and freelancers to communicate securely within the job portal.
*   💳 **Secure One-Click Payments:** Seamless integration with MetaMask via Wagmi. Clients can approve and pay the exact GEN reward with a single transaction.
*   ⚖️ **AI Dispute & Appeal System:** If work is rejected, freelancers can submit an appeal reason, prompting the AI to re-evaluate the context.
*   📊 **Live Transparency Dashboard:** The homepage features a real-time statistical dashboard showing Total GEN Paid, Total Jobs Listed, and the AI Approval Rate.
*   🔍 **Smart Search & Filtering:** Browse the marketplace effortlessly using Categories (Web3, AI, Design, etc.) and a real-time search engine.
*   🚀 **Social Integration:** One-click "Share on X (Twitter)" button to boost job visibility across social media.

---

## ⚙️ How It Works

1. **📝 Post a Job:** The client describes the task in natural language, selects a category, and sets the GEN reward.
2. **📤 Submit Work:** Freelancers complete the task and submit a URL or text proof directly to the smart contract.
3. **🧠 AI Evaluates:** GenLayer AI automatically checks the submission against the original requirements and makes an instant decision (Approve/Reject).
4. **💰 Get Paid:** Upon AI approval, the client confirms the job, and funds are securely transferred to the freelancer's wallet.

---

## 🛠️ Tech Stack

*   **Smart Contracts:** Python (GenLayer SDK)
*   **Frontend Framework:** Next.js (React)
*   **Styling:** Tailwind CSS (with custom Animated Canvas UI)
*   **Web3 Integration:** Wagmi, RainbowKit, `genlayer-js`
*   **Network:** GenLayer StudioNet (`testnetBradbury` ready)

---

## 🚀 Getting Started (Local Development)

### Prerequisites
*   Node.js (v18+)
*   npm, yarn, or pnpm
*   MetaMask Wallet configured with GenLayer Network

### Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/jubayir-hub-69/genwork.git](https://github.com/jubayir-hub-69/genwork.git)
   cd genwork
   
