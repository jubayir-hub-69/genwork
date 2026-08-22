# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from genlayer import *

class GenWork(gl.Contract):
    jobs_data: str
    profiles_data: str

    def __init__(self):
        self.jobs_data = "[]"
        self.profiles_data = "{}"

    # Safely get the sender address to prevent "unknown" bug
    def _get_sender(self) -> str:
        try:
            return str(gl.message.sender.address).lower()
        except Exception:
            try:
                return str(gl.message.sender).lower()
            except Exception:
                return "unknown_sender"

    @gl.public.write.payable
    def post_job(self, desc: str, category: str) -> None:
        client = self._get_sender()
        
        try:
            price_wei = int(gl.message.value)
        except Exception:
            price_wei = 0
            
        if price_wei <= 0:
            raise Exception("Job price must be greater than zero. Native GEN required.")
            
        try:
            jobs = json.loads(self.jobs_data)
        except Exception:
            jobs = []
            
        new_id = str(len(jobs) + 1)
        
        jobs.append({
            "id": new_id,
            "desc": str(desc),
            "price_wei": str(price_wei), 
            "category": str(category),
            "client": client,
            "freelancer": "",
            "work_data": "", 
            "status": "OPEN",
            "ai_decision": "",
            "messages": []
        })
        self.jobs_data = json.dumps(jobs)

    @gl.public.write
    def submit_work(self, job_id: str, work_data: str) -> None:
        freelancer = self._get_sender()
        try:
            jobs = json.loads(self.jobs_data)
        except Exception:
            return
            
        idx = int(job_id) - 1
        if idx < 0 or idx >= len(jobs): return
        
        job = jobs[idx]
        if job["status"] != "OPEN": return
        
        job["freelancer"] = freelancer
        job["work_data"] = str(work_data)
        job["status"] = "EVALUATING"
        self.jobs_data = json.dumps(jobs)

        def leader_fn():
            work_str = str(work_data)
            fetched_text = ""
            if work_str.startswith("http://") or work_str.startswith("https://"):
                try:
                    evidence = gl.nondet.fetch_url(work_str)
                    fetched_text = f"URL Content: {evidence[:2000]}"
                except Exception:
                    fetched_text = f"Failed to fetch URL: {work_str}"
            else:
                fetched_text = f"Direct Text Submission: {work_str[:2000]}"

            prompt = f"""You are a strict QA AI Validator. 
            Job Description: {job['desc']}
            Evidence: {fetched_text}

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
                job["status"] = "COMPLETED"
                job["ai_decision"] = result.get("reason", "Approved.")
                try:
                    gl.transfer(job["freelancer"], int(job["price_wei"]))
                except Exception:
                    try:
                        gl.send(job["freelancer"], int(job["price_wei"]))
                    except: pass
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
        try:
            jobs = json.loads(self.jobs_data)
        except Exception:
            return
            
        idx = int(job_id) - 1
        if idx < 0 or idx >= len(jobs): return
        
        job = jobs[idx]
        if job["status"] != "AI_REJECTED": return
        job["status"] = "APPEAL_IN_PROGRESS"
        self.jobs_data = json.dumps(jobs)

        def leader_fn():
            work_str = str(job["work_data"])
            fetched_text = ""
            if work_str.startswith("http://") or work_str.startswith("https://"):
                try:
                    evidence = gl.nondet.fetch_url(work_str)
                    fetched_text = f"URL Content: {evidence[:2000]}"
                except Exception:
                    fetched_text = "FAILED_TO_FETCH_URL"
            else:
                fetched_text = f"Direct Text Submission: {work_str[:2000]}"

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
            if result.get("decision") == "APPROVE":
                job["status"] = "COMPLETED"
                job["ai_decision"] = "Appeal Won: " + result.get("reason")
                try:
                    gl.transfer(job["freelancer"], int(job["price_wei"]))
                except Exception:
                    try:
                        gl.send(job["freelancer"], int(job["price_wei"]))
                    except: pass
            else:
                job["status"] = "APPEAL_REJECTED"
                job["ai_decision"] = "Appeal Lost: " + result.get("reason")
                try:
                    gl.transfer(job["client"], int(job["price_wei"]))
                except Exception:
                    try:
                        gl.send(job["client"], int(job["price_wei"]))
                    except: pass
        except Exception:
            job["status"] = "AI_REJECTED"
            job["ai_decision"] = "Appeal Processing Failed."
            
        jobs[idx] = job
        self.jobs_data = json.dumps(jobs)

    @gl.public.write
    def reject_work(self, job_id: str) -> None:
        caller = self._get_sender()
        try:
            jobs = json.loads(self.jobs_data)
        except Exception:
            return
            
        idx = int(job_id) - 1
        if idx < 0 or idx >= len(jobs): return
        job = jobs[idx]
        
        if job["client"] == caller and job["status"] == "AI_REJECTED":
            job["status"] = "CANCELLED"
            job["ai_decision"] = "Client confirmed rejection. Escrow refunded."
            try:
                gl.transfer(job["client"], int(job["price_wei"]))
            except Exception:
                try:
                    gl.send(job["client"], int(job["price_wei"]))
                except: pass
            self.jobs_data = json.dumps(jobs)

    @gl.public.write
    def cancel_job(self, job_id: str) -> None:
        client = self._get_sender()
        try:
            jobs = json.loads(self.jobs_data)
        except Exception:
            return
            
        idx = int(job_id) - 1
        if idx < 0 or idx >= len(jobs): return
        job = jobs[idx]
        
        if job["client"] == client and job["status"] in ["OPEN", "FAILED_EVALUATION"]:
            job["status"] = "CANCELLED"
            try:
                gl.transfer(job["client"], int(job["price_wei"]))
            except Exception:
                try:
                    gl.send(job["client"], int(job["price_wei"]))
                except: pass
            self.jobs_data = json.dumps(jobs)

    @gl.public.write
    def send_message(self, job_id: str, message: str) -> None:
        sender = self._get_sender()
        try:
            jobs = json.loads(self.jobs_data)
        except Exception:
            return
            
        idx = int(job_id) - 1
        if 0 <= idx < len(jobs):
            if "messages" not in jobs[idx]:
                jobs[idx]["messages"] = []
            jobs[idx]["messages"].append({"sender": sender, "text": str(message)})
            self.jobs_data = json.dumps(jobs)

    @gl.public.write
    def update_profile(self, nickname: str, avatar_url: str) -> None:
        caller = self._get_sender()
        try:
            profiles = json.loads(self.profiles_data)
        except Exception:
            return
            
        profiles[caller] = {"nickname": str(nickname), "avatar": str(avatar_url)}
        self.profiles_data = json.dumps(profiles)

    @gl.public.view
    def get_all_jobs(self) -> str: return self.jobs_data

    @gl.public.view
    def get_profiles(self) -> str: return self.profiles_data
