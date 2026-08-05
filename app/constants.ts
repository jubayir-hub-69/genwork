export const CONTRACT_ADDRESS = "0x74601833DDD3eFcDA2Fb3e8B14162575a44A2aa6";

export const CONTRACT_ABI = [
  {
    "name": "post_job",
    "type": "function",
    "stateMutability": "payable",
    "inputs": [
      { "name": "desc", "type": "string" },
      { "name": "category", "type": "string" }
    ],
    "outputs": []
  },
  {
    "name": "submit_work",
    "type": "function",
    "inputs": [
      { "name": "job_id", "type": "string" },
      { "name": "work_url", "type": "string" }
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
