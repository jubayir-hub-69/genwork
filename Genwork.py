# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from genlayer import *

class GenWork(gl.Contract):
    jobs_data: str
    profiles_data: str
    balances_data: str

    def __init__(self):
        self.jobs_data = "[]"
        self.profiles_data = "{}"
        self.balances_data = "{}"

    # --- ESCROW & FUNDS FLOW ---
    @gl.public.write
    def deposit_funds(self, amount: int, caller: str) -> None:
        balances = json.loads(self.balances_data)
        user = caller.lower()
        balances[user] = balances.get(user, 0) + amount
        self.balances_data = json.dumps(balances)

    @gl.public.write
    def withdraw_funds(self, amount: int, caller: str) -> None:
        balances = json.loads(self.balances_data)
        user = caller.lower()
        if balances.get(user, 0) >= amount:
            balances[user] -= amount
            self.balances_data = json.dumps(balances)
        else:
            raise Exception("Insufficient balance to withdraw.")

    # --- JOB WORKFLOW ---
    @gl.public.write
    def post_job(self, desc: str, price: int, category: str, client: str) -> None:
        balances = json.loads(self.balances_data)
        client_lower = client.lower()
        
        if balances.get(client_lower, 0) < price:
            raise Exception("Insufficient platform balance. Please deposit GEN first.")
        
        balances[client_lower] -= price
        self.balances_data = json.dumps(balances)
        
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
    def submit_work(self, job_id: str, work_url: str, freelancer: str) -> None:
        jobs = json.loads(self.jobs_data)
        idx = int(job_id) - 1
        if idx < 0 or idx >= len(jobs): return
        
        job = jobs[idx]
        if job["status"] not in ["OPEN"]: return
        
        job["freelancer"] = freelancer
        job["work_data"] = work_url
        job["status"] = "EVALUATING"
        self.jobs_data = json.dumps(jobs)

        def leader_fn():
            try:
                evidence = gl.nondet.fetch_url(work_url)
                fetched_text = evidence[:2000]
            except Exception:
                fetched_text = "FAILED_TO_FETCH_URL. Link is invalid or unreachable."

            prompt = f"""You are a strict QA AI Validator. 
            Job Description: {job['desc']}
            Evidence (Fetched from URL): {fetched_text}

            TASK: Verify if the fetched evidence actually matches the job description.
            If the link failed to fetch, or content is irrelevant, REJECT.
            If it perfectly proves the work is done, APPROVE.
            
            Respond STRICTLY in JSON: {{"decision": "APPROVE" or "REJECT", "reason": "Explanation"}}"""
            
            return gl.nondet.exec_prompt(prompt, response_format="json")

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return): return False
            return leader_fn().get("decision") == leaders_res.calldata.get("decision")

        try:
            result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
            if result.get("decision") == "APPROVE":
                job["status"] = "AI_APPROVED"
                job["ai_decision"] = result.get("reason", "Approved.")
                balances = json.loads(self.balances_data)
                freelancer_lower = freelancer.lower()
                balances[freelancer_lower] = balances.get(freelancer_lower, 0) + job["price"]
                self.balances_data = json.dumps(balances)
            else:
                job["status"] = "AI_REJECTED"
                job["ai_decision"] = result.get("reason", "Rejected.")
        except Exception:
            job["status"] = "FAILED_EVALUATION"
            job["ai_decision"] = "AI Consensus System Failure."

        jobs[idx] = job
        self.jobs_data = json.dumps(jobs)

    @gl.public.write
    def appeal_decision(self, job_id: str, appeal_reason: str) -> None:
        jobs = json.loads(self.jobs_data)
        idx = int(job_id) - 1
        if idx < 0 or idx >= len(jobs): return
        
        job = jobs[idx]
        if job["status"] != "AI_REJECTED": return
        job["status"] = "APPEAL_IN_PROGRESS"
        self.jobs_data = json.dumps(jobs)

        def leader_fn():
            try:
                evidence = gl.nondet.fetch_url(job["work_data"])
                fetched_text = evidence[:2000]
            except Exception:
                fetched_text = "FAILED_TO_FETCH_URL"

            prompt = f"""You are the Supreme AI Judge evaluating an appeal.
            Job Description: {job['desc']}
            Evidence: {fetched_text}
            Previous AI Rejection Reason: {job['ai_decision']}
            Freelancer Appeal: {appeal_reason}

            Does the argument and evidence prove the work is done?
            Respond STRICTLY in JSON: {{"decision": "APPROVE" or "REJECT", "reason": "Explanation"}}"""
            
            return gl.nondet.exec_prompt(prompt, response_format="json")

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return): return False
            return leader_fn().get("decision") == leaders_res.calldata.get("decision")

        try:
            result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
            balances = json.loads(self.balances_data)
            
            if result.get("decision") == "APPROVE":
                job["status"] = "APPEAL_APPROVED"
                job["ai_decision"] = "Appeal Won: " + result.get("reason")
                freelancer_lower = job["freelancer"].lower()
                balances[freelancer_lower] = balances.get(freelancer_lower, 0) + job["price"]
            else:
                job["status"] = "APPEAL_REJECTED"
                job["ai_decision"] = "Appeal Lost: " + result.get("reason")
                client_lower = job["client"].lower()
                balances[client_lower] = balances.get(client_lower, 0) + job["price"]
                
            self.balances_data = json.dumps(balances)
        except Exception:
            job["status"] = "AI_REJECTED"
            job["ai_decision"] = "Appeal Processing Failed."
            
        jobs[idx] = job
        self.jobs_data = json.dumps(jobs)

    # ---> NEW FUNCTION ADDED TO FIX THE FUND LOCK BUG <---
    @gl.public.write
    def reject_work(self, job_id: str, caller: str) -> None:
        jobs = json.loads(self.jobs_data)
        idx = int(job_id) - 1
        if idx < 0 or idx >= len(jobs): return
        job = jobs[idx]
        
        # Only client can finalize the rejection to get their refund
        if job["client"].lower() == caller.lower() and job["status"] == "AI_REJECTED":
            job["status"] = "CANCELLED"
            balances = json.loads(self.balances_data)
            client_lower = caller.lower()
            balances[client_lower] = balances.get(client_lower, 0) + job["price"]
            self.balances_data = json.dumps(balances)
            job["ai_decision"] = "Client confirmed rejection. Escrow refunded."
            self.jobs_data = json.dumps(jobs)

    @gl.public.write
    def cancel_job(self, job_id: str, client: str) -> None:
        jobs = json.loads(self.jobs_data)
        idx = int(job_id) - 1
        if idx < 0 or idx >= len(jobs): return
        job = jobs[idx]
        if job["client"].lower() == client.lower() and job["status"] in ["OPEN", "FAILED_EVALUATION"]:
            job["status"] = "CANCELLED"
            balances = json.loads(self.balances_data)
            client_lower = client.lower()
            balances[client_lower] = balances.get(client_lower, 0) + job["price"]
            self.balances_data = json.dumps(balances)
            self.jobs_data = json.dumps(jobs)

    # --- CHAT & PROFILES ---
    @gl.public.write
    def send_message(self, job_id: str, message: str, sender: str) -> None:
        jobs = json.loads(self.jobs_data)
        idx = int(job_id) - 1
        if 0 <= idx < len(jobs):
            if "messages" not in jobs[idx]:
                jobs[idx]["messages"] = []
            jobs[idx]["messages"].append({"sender": sender, "text": message})
            self.jobs_data = json.dumps(jobs)

    @gl.public.write
    def update_profile(self, caller: str, nickname: str, avatar_url: str) -> None:
        profiles = json.loads(self.profiles_data)
        profiles[caller.lower()] = {"nickname": nickname, "avatar": avatar_url}
        self.profiles_data = json.dumps(profiles)

    @gl.public.view
    def get_all_jobs(self) -> str: return self.jobs_data
        
    @gl.public.view
    def get_balances(self) -> str: return self.balances_data

    @gl.public.view
    def get_profiles(self) -> str: return self.profiles_data
