export const CONTRACT_ADDRESS = "0x3Fa9896431C94C7b595e087be88ec4601Ece011f";

export const CONTRACT_ABI = [
  {
    "name": "post_job",
    "type": "function",
    "inputs": [
      { "name": "desc", "type": "string" },
      { "name": "price", "type": "string" },
      { "name": "client", "type": "string" }
    ],
    "outputs": []
  },
  {
    "name": "submit_work",
    "type": "function",
    "inputs": [
      { "name": "job_id", "type": "string" },
      { "name": "url", "type": "string" },
      { "name": "freelancer", "type": "string" }
    ],
    "outputs": []
  },
  {
    "name": "approve_work",
    "type": "function",
    "inputs": [
      { "name": "job_id", "type": "string" },
      { "name": "approver", "type": "string" }
    ],
    "outputs": []
  },
  {
    "name": "reject_work",
    "type": "function",
    "inputs": [
      { "name": "job_id", "type": "string" },
      { "name": "approver", "type": "string" }
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
    "name": "get_all_jobs",
    "type": "function",
    "inputs": [],
    "outputs": [{ "type": "string" }]
  }
] as const;
