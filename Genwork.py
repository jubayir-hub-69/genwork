# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from genlayer import *

class GenWork(gl.Contract):
    jobs_data: str
    profiles_data: str

    def __init__(self):
        self.jobs_data = "[]"
        self.profiles_data = "{}"

    @gl.public.write
    def post_job(self, desc: str, price: str, category: str, client: str) -> None:
        jobs = json.loads(self.jobs_data)
        new_id = str(len(jobs) + 1)
        
        jobs.append({
            "id": new_id,
            "desc": desc,
            "price": price,
            "category": category,
            "client": client,
            "freelancer": "",
            "work_data": "", 
            "status": "OPEN",
            "ai_decision": "",
            "messages": []
        })
        self.jobs_data = json.dumps(jobs)

    @gl.public.write
    def submit_work(self, job_id: str, work_data: str, freelancer: str) -> None:
        jobs = json.loads(self.jobs_data)
        idx = int(job_id) - 1
        
        if 0 <= idx < len(jobs):
            job = jobs[idx]
            if job["status"] not in ["OPEN", "APPEALED"]:
                return
                
            job["freelancer"] = freelancer
            job["work_data"] = work_data
            job["status"] = "SUBMITTED"
            
            prompt = f"""You are a strict, highly professional Quality Assurance (QA) evaluator. 
Your job is to critically evaluate if the submitted work perfectly fulfills the client's job description.

Job Description: {job['desc']}
Submitted Work: {work_data}

STRICT EVALUATION RULES FOR AI:
1. Low Effort = REJECT: Reject simple, low-effort text strings (e.g., just typing a name, random letters, or a single word) if the job implies a complex task like a 'design', 'picture', 'website', or 'code'.
2. Format Match: If the job asks for a 'design' or 'picture', a simple text string is NOT acceptable. The user MUST provide a valid URL/link to the actual design.
3. Be a tough judge: If the submission feels like a scam, is lazy, or does not clearly prove the work was done, REJECT it immediately.

You must reply ONLY with a valid JSON in this exact format:
{{"decision": "APPROVE", "reason": "Detailed explanation of why it strictly passed."}} 
or 
{{"decision": "REJECT", "reason": "Detailed explanation of why it failed or lacked effort."}}"""

            def leader_fn():
                return gl.nondet.exec_prompt(prompt, response_format="json")

            def validator_fn(leaders_res) -> bool:
                if not isinstance(leaders_res, gl.vm.Return):
                    return False
                my_res = leader_fn()
                return my_res.get("decision") == leaders_res.calldata.get("decision")

            try:
                result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
                if result.get("decision") == "APPROVE":
                    job["status"] = "AI_APPROVED"
                    job["ai_decision"] = result.get("reason", "AI strictly approved the work.")
                else:
                    job["status"] = "AI_REJECTED"
                    job["ai_decision"] = result.get("reason", "AI rejected the work for quality/effort issues.")
            except Exception:
                job["status"] = "SUBMITTED"
                job["ai_decision"] = "Manual Verification Needed (AI evaluation failed)"

            jobs[idx] = job
            self.jobs_data = json.dumps(jobs)

    @gl.public.write
    def approve_work(self, job_id: str, approver: str) -> None:
        jobs = json.loads(self.jobs_data)
        idx = int(job_id) - 1
        if 0 <= idx < len(jobs):
            if jobs[idx]["client"].lower() == approver.lower():
                jobs[idx]["status"] = "COMPLETED"
                self.jobs_data = json.dumps(jobs)

    @gl.public.write
    def reject_work(self, job_id: str, approver: str) -> None:
        jobs = json.loads(self.jobs_data)
        idx = int(job_id) - 1
        if 0 <= idx < len(jobs):
            if jobs[idx]["client"].lower() == approver.lower():
                jobs[idx]["status"] = "OPEN"
                jobs[idx]["freelancer"] = ""
                jobs[idx]["work_data"] = ""
                jobs[idx]["ai_decision"] = "Client manually rejected and re-opened the job."
                self.jobs_data = json.dumps(jobs)

    @gl.public.write
    def appeal_decision(self, job_id: str, appeal_reason: str) -> None:
        jobs = json.loads(self.jobs_data)
        idx = int(job_id) - 1
        if 0 <= idx < len(jobs):
            jobs[idx]["status"] = "APPEALED"
            jobs[idx]["ai_decision"] = f"Freelancer appealed: {appeal_reason}"
            self.jobs_data = json.dumps(jobs)

    @gl.public.write
    def cancel_job(self, job_id: str, client: str) -> None:
        jobs = json.loads(self.jobs_data)
        idx = int(job_id) - 1
        if 0 <= idx < len(jobs):
            if jobs[idx]["client"].lower() == client.lower() and jobs[idx]["status"] == "OPEN":
                jobs[idx]["status"] = "CANCELLED"
                jobs[idx]["ai_decision"] = "Job was cancelled by the client."
                self.jobs_data = json.dumps(jobs)

    @gl.public.write
    def send_message(self, job_id: str, message: str, sender: str) -> None:
        jobs = json.loads(self.jobs_data)
        idx = int(job_id) - 1
        if 0 <= idx < len(jobs):
            if "messages" not in jobs[idx]:
                jobs[idx]["messages"] = []
            
            jobs[idx]["messages"].append({
                "sender": sender,
                "text": message
            })
            self.jobs_data = json.dumps(jobs)

    @gl.public.write
    def update_profile(self, caller: str, nickname: str, avatar_url: str) -> None:
        profiles = json.loads(self.profiles_data)
        profiles[caller.lower()] = {
            "nickname": nickname,
            "avatar": avatar_url
        }
        self.profiles_data = json.dumps(profiles)

    @gl.public.view
    def get_all_jobs(self) -> str:
        return self.jobs_data

    @gl.public.view
    def get_profiles(self) -> str:
        return self.profiles_data
