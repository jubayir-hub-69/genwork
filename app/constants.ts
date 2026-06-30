export const CONTRACT_ADDRESS = "0x15Fe10571dD8EE08eADFDf7756219acF67BE09E8";

export const CONTRACT_ABI = [
  {
    "name": "post_job",
    "type": "function",
    "inputs": [
      { "name": "desc", "type": "string" },
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
    "name": "get_all_jobs",
    "type": "function",
    "inputs": [],
    "outputs": [{ "type": "string" }]
  }
] as const;
