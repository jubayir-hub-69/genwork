export const CONTRACT_ADDRESS = "0xd894234d7b266a588e0DeF60B075ef63C40c80C5";

export const CONTRACT_ABI = [
  {
    "name": "post_job",
    "type": "function",
    "stateMutability": "payable",
    "inputs": [
      { "name": "desc", "type": "string" },
      { "name": "category", "type": "string" },
      { "name": "criteria_json", "type": "string" },
      { "name": "challenge_window_secs", "type": "string" }
    ],
    "outputs": []
  },
  {
    "name": "submit_work",
    "type": "function",
    "inputs": [
      { "name": "job_id", "type": "string" },
      { "name": "evidence_json", "type": "string" }
    ],
    "outputs": []
  },
  {
    "name": "appeal_decision",
    "type": "function",
    "inputs": [
      { "name": "job_id", "type": "string" },
      { "name": "appeal_reason", "type": "string" }
    ],
    "outputs": []
  },
  {
    "name": "challenge_work",
    "type": "function",
    "inputs": [
      { "name": "job_id", "type": "string" },
      { "name": "counter_evidence_json", "type": "string" }
    ],
    "outputs": []
  },
  {
    "name": "accept_work",
    "type": "function",
    "inputs": [
      { "name": "job_id", "type": "string" }
    ],
    "outputs": []
  },
  {
    "name": "finalize_payout",
    "type": "function",
    "inputs": [
      { "name": "job_id", "type": "string" }
    ],
    "outputs": []
  },
  {
    "name": "reject_work",
    "type": "function",
    "inputs": [
      { "name": "job_id", "type": "string" }
    ],
    "outputs": []
  },
  {
    "name": "cancel_job",
    "type": "function",
    "inputs": [
      { "name": "job_id", "type": "string" }
    ],
    "outputs": []
  },
  {
    "name": "send_message",
    "type": "function",
    "inputs": [
      { "name": "job_id", "type": "string" },
      { "name": "message", "type": "string" }
    ],
    "outputs": []
  },
  {
    "name": "update_profile",
    "type": "function",
    "inputs": [
      { "name": "nickname", "type": "string" },
      { "name": "avatar_url", "type": "string" }
    ],
    "outputs": []
  },
  {
    "name": "get_all_jobs",
    "type": "function",
    "inputs": [],
    "outputs": [{ "type": "string" }]
  },
  {
    "name": "get_profiles",
    "type": "function",
    "inputs": [],
    "outputs": [{ "type": "string" }]
  }
] as const;
