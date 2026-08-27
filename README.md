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

Each job is bound to client-authored acceptance criteria. Freelancers submit an authenticated evidence envelope (sender-bound, content-hashed, `https`/`ipfs` allowlisted — not a bare URL or unauthenticated text). GenLayer AI scores the deliverable against those criteria. **AI approval does not pay.** Escrow stays locked in a client challenge window; the client may accept, submit counter-evidence, or let anyone finalize after the deadline.

---

## ✨ Key Features

*   📋 **Explicit Acceptance Criteria:** Clients attach 1–8 pass/fail rules at job creation. The contract, not just the prompt, requires every criterion id to pass.
*   🔐 **Authenticated Evidence:** Submissions are `genwork.evidence.v1` envelopes: tx-sender attestation, SHA-256 of UTF-8 bytes, `https:`/`ipfs:` allowlist, fail-closed fetch+hash, 4KiB body snapshot.
*   ⏳ **Client Challenge Window:** AI/appeal approve holds native GEN. Client can `accept_work` early or `challenge_work` with counter-evidence. `finalize_payout` only after the window (or to complete a parked verdict).
*   🤖 **Strict AI Evaluation:** GenLayer validators score the envelope against the stored criteria. Provenance failure is a hard REJECT.
*   👤 **Global On-Chain Profiles:** Users can set custom Nicknames and Avatar URLs directly on the blockchain.
*   💬 **On-Chain Discussion:** Clients and freelancers can message on-chain inside each job.
*   💳 **Native GEN Escrow:** MetaMask + Wagmi. `post_job` is payable; payout is `_Wallet.emit_transfer` after accept / successful challenge outcome / finalize — never on AI approve.
*   ⚖️ **AI Dispute & Appeal System:** Rejected work can be appealed or resubmitted with a new envelope. Appeal approve still enters the challenge window.
*   📊 **Live Transparency Dashboard:** The homepage features a real-time statistical dashboard showing Total GEN Paid, Total Jobs Listed, and the AI Approval Rate.
*   🔍 **Smart Search & Filtering:** Browse the marketplace effortlessly using Categories (Web3, AI, Design, etc.) and a real-time search engine.
*   🚀 **Social Integration:** One-click "Share on X (Twitter)" button to boost job visibility across social media.

---

## ⚙️ How It Works

1. **📝 Post a Job:** Client sets description, category, 1–8 acceptance criteria, challenge-window length, and locks native GEN.
2. **📤 Submit Authenticated Evidence:** Freelancer submits a bound envelope (inline UTF-8 or allowlisted URI + content hash), not a bare link.
3. **🧠 AI Evaluates:** GenLayer consensus scores each criterion. Approve → `CHALLENGE_WINDOW` (escrow still locked). Reject → appeal or resubmit.
4. **⏳ Challenge / Accept / Finalize:** Client may accept (pay freelancer) or challenge with counter-evidence. After the deadline, anyone may `finalize_payout`. `COMPLETED` means the freelancer was paid.

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


## 👨‍💻 Developer & Contact

<div align="center">
  <p><b>Built with ❤️ by JUBAYIR69</b></p>
  
  <a href="https://github.com/jubayir-hub-69"><img src="https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white" alt="GitHub" /></a>
  <a href="https://t.me/JUBAYIR69"><img src="https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram" /></a>
  <a href="https://discordapp.com/users/775330417414635530"><img src="https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord" /></a>

  <br/>
  <br/>
  <p><i>"Building the future of decentralized work, one prompt at a time."</i></p>
</div>


