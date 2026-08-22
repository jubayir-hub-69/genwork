# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from genlayer import *


@gl.evm.contract_interface
class _Wallet:
    class View:
        pass

    class Write:
        pass


class GenWork(gl.Contract):
    jobs_data: str
    profiles_data: str

    def __init__(self):
        self.jobs_data = "[]"
        self.profiles_data = "{}"

    def _get_sender(self) -> str:
        try:
            sender = str(gl.message.sender_address).lower()
        except Exception:
            raise Exception("Unable to derive transaction sender")
        if not sender or "unknown" in sender:
            raise Exception("Unable to derive transaction sender")
        return sender

    def _load_jobs(self) -> list:
        try:
            jobs = json.loads(self.jobs_data)
            return jobs if isinstance(jobs, list) else []
        except Exception:
            return []

    def _save_jobs(self, jobs: list) -> None:
        self.jobs_data = json.dumps(jobs)

    def _job_index(self, job_id: str) -> int:
        idx = int(job_id) - 1
        jobs = self._load_jobs()
        if idx < 0 or idx >= len(jobs):
            raise Exception("Invalid job id")
        return idx

    def _payout(self, to_addr: str, amount_wei: int) -> None:
        if not to_addr or "unknown" in str(to_addr).lower():
            raise Exception("Invalid payout recipient")
        wei = int(amount_wei)
        if wei <= 0:
            raise Exception("Invalid payout amount")
        dest = Address(str(to_addr))
        amount = u256(wei)
        try:
            _Wallet(dest).emit_transfer(value=amount)
            return
        except Exception as evm_err:
            try:
                gl.get_contract_at(dest).emit_transfer(value=amount, on="finalized")
                return
            except Exception:
                raise Exception("Native GEN transfer failed: " + str(evm_err))

    def _settle(self, job: dict, recipient: str) -> None:
        if job.get("settled") is True:
            raise Exception("Job already settled")
        self._payout(recipient, int(job["price_wei"]))
        job["settled"] = True
        job["settled_to"] = recipient

    @gl.public.write.payable
    def post_job(self, desc: str, category: str) -> None:
        client = self._get_sender()
        try:
            price_wei = int(gl.message.value)
        except Exception:
            price_wei = 0
        if price_wei <= 0:
            raise Exception("Job price must be greater than zero. Native GEN required.")

        jobs = self._load_jobs()
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
            "messages": [],
            "settled": False,
            "settled_to": "",
        })
        self._save_jobs(jobs)

    @gl.public.write
    def submit_work(self, job_id: str, work_data: str) -> None:
        freelancer = self._get_sender()
        jobs = self._load_jobs()
        idx = self._job_index(job_id)
        job = jobs[idx]

        if job["status"] != "OPEN":
            raise Exception("Job is not open")
        if job["client"] == freelancer:
            raise Exception("Client cannot submit work on their own job")
        if not str(work_data).strip():
            raise Exception("Work evidence is required")

        job["freelancer"] = freelancer
        job["work_data"] = str(work_data)
        job["status"] = "EVALUATING"
        jobs[idx] = job
        self._save_jobs(jobs)

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
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            return leader_fn().get("decision") == leaders_res.calldata.get("decision")

        try:
            result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
            if result.get("decision") == "APPROVE":
                self._settle(job, job["freelancer"])
                job["status"] = "COMPLETED"
                job["ai_decision"] = result.get("reason", "Approved.")
            else:
                job["status"] = "AI_REJECTED"
                job["ai_decision"] = result.get("reason", "Rejected.")
        except Exception:
            job["status"] = "FAILED_EVALUATION"
            job["ai_decision"] = "AI Consensus System Failure."

        jobs[idx] = job
        self._save_jobs(jobs)

    @gl.public.write
    def appeal_decision(self, job_id: str, appeal_reason: str) -> None:
        caller = self._get_sender()
        jobs = self._load_jobs()
        idx = self._job_index(job_id)
        job = jobs[idx]

        if job["status"] != "AI_REJECTED":
            raise Exception("Job is not awaiting appeal")
        if job["freelancer"] != caller:
            raise Exception("Only the assigned freelancer can appeal")
        if not str(appeal_reason).strip():
            raise Exception("Appeal reason is required")

        job["status"] = "APPEAL_IN_PROGRESS"
        jobs[idx] = job
        self._save_jobs(jobs)

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
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            return leader_fn().get("decision") == leaders_res.calldata.get("decision")

        try:
            result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
            reason = str(result.get("reason") or "")
            if result.get("decision") == "APPROVE":
                self._settle(job, job["freelancer"])
                job["status"] = "COMPLETED"
                job["ai_decision"] = "Appeal Won: " + reason
            else:
                self._settle(job, job["client"])
                job["status"] = "APPEAL_REJECTED"
                job["ai_decision"] = "Appeal Lost: " + reason
        except Exception:
            job["status"] = "AI_REJECTED"
            job["ai_decision"] = "Appeal Processing Failed."

        jobs[idx] = job
        self._save_jobs(jobs)

    @gl.public.write
    def reject_work(self, job_id: str) -> None:
        caller = self._get_sender()
        jobs = self._load_jobs()
        idx = self._job_index(job_id)
        job = jobs[idx]

        if job["client"] != caller:
            raise Exception("Only the client can confirm rejection")
        if job["status"] != "AI_REJECTED":
            raise Exception("Job is not in AI_REJECTED")
        if job.get("settled") is True:
            raise Exception("Job already settled")

        self._settle(job, job["client"])
        job["status"] = "CANCELLED"
        job["ai_decision"] = "Client confirmed rejection. Escrow refunded."
        jobs[idx] = job
        self._save_jobs(jobs)

    @gl.public.write
    def cancel_job(self, job_id: str) -> None:
        caller = self._get_sender()
        jobs = self._load_jobs()
        idx = self._job_index(job_id)
        job = jobs[idx]

        if job["client"] != caller:
            raise Exception("Only the client can cancel")
        if job["status"] not in ["OPEN", "FAILED_EVALUATION"]:
            raise Exception("Job cannot be cancelled in its current status")
        if job.get("settled") is True:
            raise Exception("Job already settled")

        self._settle(job, job["client"])
        job["status"] = "CANCELLED"
        job["ai_decision"] = "Client cancelled. Escrow refunded."
        jobs[idx] = job
        self._save_jobs(jobs)

    @gl.public.write
    def send_message(self, job_id: str, message: str) -> None:
        sender = self._get_sender()
        jobs = self._load_jobs()
        idx = self._job_index(job_id)
        if "messages" not in jobs[idx]:
            jobs[idx]["messages"] = []
        jobs[idx]["messages"].append({"sender": sender, "text": str(message)})
        self._save_jobs(jobs)

    @gl.public.write
    def update_profile(self, nickname: str, avatar_url: str) -> None:
        caller = self._get_sender()
        try:
            profiles = json.loads(self.profiles_data)
            if not isinstance(profiles, dict):
                profiles = {}
        except Exception:
            profiles = {}
        profiles[caller] = {"nickname": str(nickname), "avatar": str(avatar_url)}
        self.profiles_data = json.dumps(profiles)

    @gl.public.view
    def get_all_jobs(self) -> str:
        return self.jobs_data

    @gl.public.view
    def get_profiles(self) -> str:
        return self.profiles_data
