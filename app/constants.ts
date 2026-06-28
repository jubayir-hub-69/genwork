export const CONTRACT_ADDRESS = "0xF20F1edB82ca4085b9251b960829631458e6d98e";

export const CONTRACT_ABI = [
  {
    "name": "post_job",
    "type": "function",
    "inputs": [{ "name": "desc", "type": "string" }],
    "outputs": [{ "type": "string" }]
  },
  {
    "name": "submit_work",
    "type": "function",
    "inputs": [
      { "name": "job_id", "type": "string" },
      { "name": "url", "type": "string" }
    ],
    "outputs": [{ "type": "string" }]
  },
  {
    "name": "approve_work",
    "type": "function",
    "inputs": [{ "name": "job_id", "type": "string" }],
    "outputs": [{ "type": "string" }]
  },
  {
    "name": "get_all_jobs",
    "type": "function",
    "inputs": [],
    "outputs": [{ "type": "string" }]
  }
] as const;