# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import hashlib
import json
import re
from datetime import datetime, timezone
from genlayer import *


MIN_WINDOW = 3600
MAX_WINDOW = 604800
DEFAULT_WINDOW = 86400
MAX_SUBMISSIONS = 3
MAX_CHALLENGE_ATTEMPTS = 3
BODY_PREVIEW_CHARS = 4096
CRITERIA_JSON_MAX = 4096
EVIDENCE_JSON_MAX = 8192
INLINE_BODY_MAX = 4096
ALLOWED_EVIDENCE_TYPES = ("inline_text", "https_document", "ipfs_cid")
ALLOWED_CRITERION_TYPES = ("inline_text", "https_document", "ipfs_cid", "any")
CRITERION_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{1,32}$")
CID_RE = re.compile(r"^[a-zA-Z0-9]{46,90}$")
HASH_PREFIX = "sha256:"

# HASH_PREIMAGE_V1: SHA-256 of UTF-8 bytes of the text body.
# str  -> encode utf-8 (strict)
# bytes/bytearray -> decode utf-8 (strict) then encode utf-8 (same bytes if well-formed)
# any other type or UnicodeDecodeError/UnicodeEncodeError -> provenance_ok False (binary not in v1)


def now_ts() -> int:
    return int(datetime.now(timezone.utc).timestamp())


def canonical_dumps(obj) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def utf8_digest(raw) -> str:
    if isinstance(raw, str):
        data = raw.encode("utf-8")
    elif isinstance(raw, (bytes, bytearray)):
        raw.decode("utf-8")
        data = bytes(raw)
    else:
        raise ValueError("unhashable fetch type")
    return HASH_PREFIX + hashlib.sha256(data).hexdigest()


def criteria_hash(criteria: list) -> str:
    return HASH_PREFIX + sha256_hex(canonical_dumps(criteria))


def host_is_ip(host: str) -> bool:
    h = str(host).strip("[]").lower().rstrip(".")
    if ":" in h:
        return True
    labels = h.split(".")
    if len(labels) == 4 and all(p.isdigit() and 0 <= int(p, 10) <= 255 and str(int(p, 10)) == p for p in labels):
        return True
    if len(labels) == 4 and all(p.isdigit() for p in labels):
        if any(p.startswith("0") and len(p) > 1 for p in labels):
            try:
                if all(0 <= int(p, 8) <= 255 for p in labels):
                    return True
            except Exception:
                pass
    if len(labels) == 4 and all(p.startswith("0x") and all(c in "0123456789abcdef" for c in p[2:]) for p in labels):
        return True
    if h.isdigit() and 0 <= int(h) <= 0xFFFFFFFF:
        return True
    if h.startswith("0x") and all(c in "0123456789abcdef" for c in h[2:]):
        return True
    return False


def _split_uri(uri: str):
    s = str(uri).strip()
    if "://" not in s:
        raise Exception("URI scheme not allowed")
    scheme, rest = s.split("://", 1)
    scheme = scheme.lower()
    authority = rest
    path = ""
    slash = rest.find("/")
    if slash >= 0:
        authority = rest[:slash]
        path = rest[slash:]
    if "@" in authority:
        raise Exception("URI scheme not allowed")
    host = authority.split(":")[0].lower().rstrip(".")
    return scheme, host, path, rest


def ipfs_gateway_url(uri: str) -> str:
    scheme, host, path, _rest = _split_uri(uri)
    if scheme != "ipfs":
        raise Exception("URI scheme not allowed")
    cid = host
    if not CID_RE.match(cid):
        raise Exception("URI scheme not allowed")
    suffix = path if path else ""
    return "https://ipfs.io/ipfs/" + cid + suffix


def uri_allowed(uri: str) -> bool:
    try:
        scheme, host, _path, _rest = _split_uri(uri)
    except Exception:
        return False
    if scheme == "ipfs":
        return bool(CID_RE.match(host))
    if scheme != "https":
        return False
    if not host or host == "localhost" or host.endswith(".local") or host.endswith(".localhost"):
        return False
    if host_is_ip(host):
        return False
    if not any("a" <= c <= "z" for c in host):
        return False
    if "." not in host:
        return False
    return True


def parse_criteria(criteria_json: str) -> list:
    if not str(criteria_json).strip():
        raise Exception("Acceptance criteria required")
    if len(criteria_json) > CRITERIA_JSON_MAX:
        raise Exception("Acceptance criteria required")
    try:
        parsed = json.loads(criteria_json)
    except Exception:
        raise Exception("Acceptance criteria required")
    if not isinstance(parsed, list):
        raise Exception("Acceptance criteria required")
    count = len(parsed)
    if count < 1 or count > 8:
        raise Exception("Acceptance criteria required")
    seen = set()
    out = []
    for item in parsed:
        if not isinstance(item, dict):
            raise Exception("Acceptance criteria required")
        cid = str(item.get("id") or "").strip()
        statement = str(item.get("statement") or "").strip()
        etype = str(item.get("evidence_type") or "").strip()
        if not CRITERION_ID_RE.match(cid) or cid in seen:
            raise Exception("Acceptance criteria required")
        if len(statement) < 10 or len(statement) > 500:
            raise Exception("Acceptance criteria required")
        if etype not in ALLOWED_CRITERION_TYPES:
            raise Exception("Acceptance criteria required")
        seen.add(cid)
        out.append({"id": cid, "statement": statement, "evidence_type": etype})
    return out


def window_expired(job: dict) -> bool:
    deadline = str(job.get("challenge_deadline") or "")
    if not deadline:
        raise Exception("Challenge window not opened")
    return now_ts() >= int(deadline)


def score_or_reject(result, job):
    if not isinstance(result, dict):
        return "REJECT", []
    provenance_ok = result.get("provenance_ok") is True
    decision = str(result.get("decision") or "")
    crit_results = result.get("criteria_results")
    if not isinstance(crit_results, list):
        return "REJECT", []
    expected = [str(c["id"]) for c in job.get("criteria") or []]
    got = [str(r.get("id")) for r in crit_results]
    if len(got) != len(expected) or set(got) != set(expected) or len(got) != len(set(got)):
        return "REJECT", crit_results
    all_pass = all(r.get("pass") is True for r in crit_results)
    if decision == "APPROVE" and provenance_ok and all_pass:
        return "APPROVE", crit_results
    return "REJECT", crit_results


def _author_statement(role: str, job_id: str, crit_hash: str) -> str:
    if role == "client_challenge":
        return "I challenge GenWork job " + str(job_id) + " against criteria " + str(crit_hash) + "."
    return "I produced this deliverable for GenWork job " + str(job_id) + " against criteria " + str(crit_hash) + "."


def validate_envelope(evidence_json: str, job: dict, sender: str, role: str) -> dict:
    if not str(evidence_json).strip():
        raise Exception("Evidence envelope required")
    if len(evidence_json) > EVIDENCE_JSON_MAX:
        raise Exception("Evidence envelope required")
    try:
        env = json.loads(evidence_json)
    except Exception:
        raise Exception("Evidence envelope required")
    if not isinstance(env, dict):
        raise Exception("Evidence envelope required")
    if str(env.get("schema") or "") != "genwork.evidence.v1":
        raise Exception("Invalid evidence schema")
    if str(env.get("role") or "") != role:
        raise Exception("Invalid evidence schema")
    if str(env.get("job_id") or "") != str(job.get("id")):
        raise Exception("Evidence envelope required")
    if str(env.get("criteria_hash") or "") != str(job.get("criteria_hash") or ""):
        raise Exception("Evidence envelope required")
    attested = str(env.get("attested_by") or "").strip().lower()
    if attested != str(sender).lower():
        raise Exception("attested_by does not match sender")
    expected_stmt = _author_statement(role, job.get("id"), job.get("criteria_hash"))
    if str(env.get("author_statement") or "") != expected_stmt:
        raise Exception("author_statement does not match template")
    etype = str(env.get("evidence_type") or "")
    if etype not in ALLOWED_EVIDENCE_TYPES:
        raise Exception("Invalid evidence schema")
    content_hash = str(env.get("content_hash") or "")
    if not content_hash.startswith(HASH_PREFIX) or len(content_hash) != len(HASH_PREFIX) + 64:
        raise Exception("Evidence envelope required")
    uri = str(env.get("uri") or "").strip()
    body = str(env.get("body") or "")
    if etype == "inline_text":
        if uri:
            raise Exception("URI scheme not allowed")
        if not body or len(body) > INLINE_BODY_MAX:
            raise Exception("Evidence envelope required")
        expected = HASH_PREFIX + sha256_hex(body)
        if content_hash != expected:
            raise Exception("Inline content_hash does not match body")
    else:
        if body:
            raise Exception("Evidence envelope required")
        if not uri_allowed(uri):
            raise Exception("URI scheme not allowed")
        if etype == "ipfs_cid" and not uri.lower().startswith("ipfs://"):
            raise Exception("URI scheme not allowed")
        if etype == "https_document" and not uri.lower().startswith("https://"):
            raise Exception("URI scheme not allowed")
    needs_fetchable = False
    for c in job.get("criteria") or []:
        if str(c.get("evidence_type") or "") in ("https_document", "ipfs_cid"):
            needs_fetchable = True
            break
    if needs_fetchable and etype == "inline_text":
        raise Exception("Evidence envelope required")
    return {
        "schema": "genwork.evidence.v1",
        "evidence_type": etype,
        "uri": uri,
        "body": body if etype == "inline_text" else "",
        "content_hash": content_hash,
        "author_statement": expected_stmt,
        "attested_by": attested,
        "job_id": str(job.get("id")),
        "criteria_hash": str(job.get("criteria_hash") or ""),
        "role": role,
    }


def _ids_bind(result, job) -> bool:
    crit_results = result.get("criteria_results") if isinstance(result, dict) else None
    if not isinstance(crit_results, list):
        return False
    expected = [str(c["id"]) for c in job.get("criteria") or []]
    got = [str(r.get("id")) for r in crit_results]
    return len(got) == len(expected) and set(got) == set(expected) and len(got) == len(set(got))


def _all_pass(result) -> bool:
    crit_results = result.get("criteria_results") if isinstance(result, dict) else None
    if not isinstance(crit_results, list) or not crit_results:
        return False
    return all(r.get("pass") is True for r in crit_results)


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

    def apply_approval_window(self, job: dict) -> None:
        if str(job.get("challenge_deadline") or ""):
            job["status"] = "CHALLENGE_WINDOW"
            return
        now = now_ts()
        job["challenge_opened_at"] = str(now)
        job["challenge_deadline"] = str(now + int(job["challenge_window_secs"]))
        try:
            job["challenge_tx_datetime"] = str(gl.message_raw["datetime"])
        except Exception:
            job["challenge_tx_datetime"] = ""
        job["status"] = "CHALLENGE_WINDOW"

    def commit_verdict_then_pay(self, jobs: list, idx: int, job: dict, decision: str, recipient: str, terminal_status: str) -> None:
        job["challenge_decision"] = decision
        jobs[idx] = job
        self._save_jobs(jobs)
        try:
            self._settle(job, recipient)
            job["status"] = terminal_status
        except Exception:
            if decision == "UPHOLD":
                job["status"] = "CHALLENGE_UPHELD"
            else:
                job["status"] = "CHALLENGE_EVALUATING"
            job["challenge_reason"] = str(job.get("challenge_reason") or "") + " Payout pending finalize_payout."
        jobs[idx] = job
        self._save_jobs(jobs)

    def _empty_milestone_fields(self) -> dict:
        return {
            "criteria": [],
            "criteria_hash": "",
            "challenge_window_secs": str(DEFAULT_WINDOW),
            "challenge_opened_at": "",
            "challenge_deadline": "",
            "challenge_tx_datetime": "",
            "evidence": {},
            "evidence_content_hash": "",
            "body_preview": "",
            "ai_criteria_results": [],
            "submission_count": "0",
            "counter_evidence": {},
            "counter_body_preview": "",
            "challenge_decision": "",
            "challenge_reason": "",
            "challenge_attempts": "0",
        }

    def _fetch_target(self, env: dict) -> str:
        uri = str(env.get("uri") or "")
        if str(env.get("evidence_type") or "") == "ipfs_cid":
            return ipfs_gateway_url(uri)
        return uri

    def _preview_from_raw(self, raw) -> str:
        if isinstance(raw, str):
            return raw[:BODY_PREVIEW_CHARS]
        if isinstance(raw, (bytes, bytearray)):
            return raw.decode("utf-8")[:BODY_PREVIEW_CHARS]
        return ""

    @gl.public.write.payable
    def post_job(self, desc: str, category: str, criteria_json: str, challenge_window_secs: str) -> None:
        client = self._get_sender()
        try:
            price_wei = int(gl.message.value)
        except Exception:
            price_wei = 0
        if price_wei <= 0:
            raise Exception("Job price must be greater than zero. Native GEN required.")
        if len(str(desc).strip()) < 10:
            raise Exception("Job description must be at least 10 characters")
        criteria = parse_criteria(criteria_json)
        try:
            window = int(str(challenge_window_secs).strip())
        except Exception:
            raise Exception("challenge_window_secs out of bounds")
        if window < MIN_WINDOW or window > MAX_WINDOW:
            raise Exception("challenge_window_secs out of bounds")

        jobs = self._load_jobs()
        new_id = str(len(jobs) + 1)
        job = {
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
        }
        job.update(self._empty_milestone_fields())
        job["criteria"] = criteria
        job["criteria_hash"] = criteria_hash(criteria)
        job["challenge_window_secs"] = str(window)
        jobs.append(job)
        self._save_jobs(jobs)

    @gl.public.write
    def submit_work(self, job_id: str, evidence_json: str) -> None:
        freelancer = self._get_sender()
        jobs = self._load_jobs()
        idx = self._job_index(job_id)
        job = jobs[idx]
        status = str(job.get("status") or "")

        if status == "OPEN":
            if job["client"] == freelancer:
                raise Exception("Client cannot submit work on their own job")
            job["freelancer"] = freelancer
        elif status in ("AI_REJECTED", "FAILED_EVALUATION"):
            if job.get("freelancer") != freelancer:
                raise Exception("Job is not open for submission")
            if int(job.get("submission_count") or "0") >= MAX_SUBMISSIONS:
                raise Exception("Resubmit limit reached")
            job["evidence"] = {}
            job["work_data"] = ""
            job["body_preview"] = ""
            job["evidence_content_hash"] = ""
            job["ai_decision"] = ""
            job["ai_criteria_results"] = []
        else:
            raise Exception("Job is not open for submission")

        env = validate_envelope(evidence_json, job, freelancer, "freelancer_submission")
        job["submission_count"] = str(int(job.get("submission_count") or "0") + 1)
        job["evidence"] = env
        job["work_data"] = json.dumps(env)
        job["evidence_content_hash"] = env["content_hash"]
        job["status"] = "EVALUATING"
        jobs[idx] = job
        self._save_jobs(jobs)

        criteria_blob = canonical_dumps(job["criteria"])
        envelope_public = canonical_dumps({
            "evidence_type": env["evidence_type"],
            "uri": env["uri"],
            "content_hash": env["content_hash"],
            "author_statement": env["author_statement"],
        })

        def leader_fn():
            body = env.get("body") or ""
            provenance_note = "INLINE_HASH_OK"
            if env["evidence_type"] != "inline_text":
                try:
                    raw = gl.nondet.fetch_url(self._fetch_target(env))
                    if raw is None or (isinstance(raw, str) and not str(raw).strip()):
                        return {
                            "decision": "REJECT",
                            "provenance_ok": False,
                            "reason": "FETCH_FAILED",
                            "criteria_results": [],
                            "body_preview": "",
                        }
                    digest = utf8_digest(raw)
                    if digest != env["content_hash"]:
                        return {
                            "decision": "REJECT",
                            "provenance_ok": False,
                            "reason": "HASH_MISMATCH",
                            "criteria_results": [],
                            "body_preview": "",
                        }
                    body = self._preview_from_raw(raw)
                    provenance_note = "PROVENANCE_OK"
                except Exception:
                    return {
                        "decision": "REJECT",
                        "provenance_ok": False,
                        "reason": "FETCH_FAILED",
                        "criteria_results": [],
                        "body_preview": "",
                    }
            prompt = f"""You are a strict QA validator for GenWork.
You MUST score the deliverable against EACH acceptance criterion.
You MUST REJECT if provenance_ok is false, even if the content looks related.
You MUST REJECT if the fetch failed or the content hash did not match.
Do not invent criteria. Do not approve on vibe.

Job id: {job['id']}
Job description: {job['desc']}
Acceptance criteria (JSON): {criteria_blob}
Evidence envelope (JSON, secrets stripped to type/uri/hash/statement): {envelope_public}
Provenance: {provenance_note}
Fetched or inline body (truncated to 4000 chars): {str(body)[:4000]}

Respond STRICTLY as JSON:
{{
  "decision": "APPROVE" or "REJECT",
  "provenance_ok": true or false,
  "criteria_results": [{{"id": "c1", "pass": true, "reason": "..."}}],
  "reason": "short overall explanation"
}}
Every criterion id MUST appear exactly once in criteria_results."""
            result = gl.nondet.exec_prompt(prompt, response_format="json")
            if not isinstance(result, dict):
                result = {}
            result["provenance_ok"] = True
            result["body_preview"] = str(body)[:BODY_PREVIEW_CHARS]
            return result

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            follower = leader_fn()
            return (
                follower.get("decision") == leaders_res.calldata.get("decision")
                and follower.get("provenance_ok") is leaders_res.calldata.get("provenance_ok")
            )

        try:
            result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
            if isinstance(result, dict) and result.get("body_preview"):
                job["body_preview"] = str(result.get("body_preview"))[:BODY_PREVIEW_CHARS]
            elif env["evidence_type"] == "inline_text":
                job["body_preview"] = str(env.get("body") or "")[:BODY_PREVIEW_CHARS]
            outcome, crit_results = score_or_reject(result, job)
            job["ai_criteria_results"] = crit_results
            if outcome == "APPROVE":
                self.apply_approval_window(job)
                job["ai_decision"] = str((result or {}).get("reason") or "Approved; challenge window open.")
            else:
                job["status"] = "AI_REJECTED"
                job["ai_decision"] = str((result or {}).get("reason") or "Rejected.")
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

        env = job.get("evidence") if isinstance(job.get("evidence"), dict) else {}
        criteria_blob = canonical_dumps(job.get("criteria") or [])
        preview = str(job.get("body_preview") or "")

        def leader_fn():
            prompt = f"""You are the Supreme AI Judge evaluating an appeal.
You MUST score the stored deliverable against EACH acceptance criterion.
Do not invent criteria.

Job Description: {job['desc']}
Acceptance criteria (JSON): {criteria_blob}
Stored body preview: {preview[:4000]}
Previous AI Rejection Reason: {job['ai_decision']}
Freelancer Appeal: {appeal_reason}
Evidence type: {env.get('evidence_type', '')}
Content hash: {env.get('content_hash', '')}

Respond STRICTLY as JSON:
{{
  "decision": "APPROVE" or "REJECT",
  "provenance_ok": true,
  "criteria_results": [{{"id": "c1", "pass": true, "reason": "..."}}],
  "reason": "short overall explanation"
}}
Every criterion id MUST appear exactly once in criteria_results."""
            result = gl.nondet.exec_prompt(prompt, response_format="json")
            if not isinstance(result, dict):
                result = {}
            result["provenance_ok"] = True
            return result

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            follower = leader_fn()
            return (
                follower.get("decision") == leaders_res.calldata.get("decision")
                and follower.get("provenance_ok") is leaders_res.calldata.get("provenance_ok")
            )

        try:
            result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
            reason = str((result or {}).get("reason") or "")
            outcome, crit_results = score_or_reject(result, job)
            job["ai_criteria_results"] = crit_results
            if outcome == "APPROVE":
                self.apply_approval_window(job)
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
    def challenge_work(self, job_id: str, counter_evidence_json: str) -> None:
        caller = self._get_sender()
        jobs = self._load_jobs()
        idx = self._job_index(job_id)
        job = jobs[idx]

        if caller != job["client"]:
            raise Exception("Only the client can challenge")
        if job.get("settled") is True:
            raise Exception("Job already settled")
        if job["status"] != "CHALLENGE_WINDOW":
            raise Exception("Job is not in challenge window")
        if window_expired(job):
            raise Exception("Challenge window expired")
        if str(job.get("challenge_decision") or ""):
            raise Exception("Challenge evaluation already decided")
        if int(job.get("challenge_attempts") or "0") >= MAX_CHALLENGE_ATTEMPTS:
            raise Exception("Challenge retry limit reached")

        env = validate_envelope(counter_evidence_json, job, caller, "client_challenge")
        job["counter_evidence"] = env
        job["status"] = "CHALLENGE_EVALUATING"
        jobs[idx] = job
        self._save_jobs(jobs)

        criteria_blob = canonical_dumps(job.get("criteria") or [])
        preview = str(job.get("body_preview") or "")
        # CHALLENGE_NO_LIVE_FREELANCER_FETCH

        def leader_fn():
            counter_body = env.get("body") or ""
            if env["evidence_type"] != "inline_text":
                try:
                    raw = gl.nondet.fetch_url(self._fetch_target(env))
                    if raw is None or (isinstance(raw, str) and not str(raw).strip()):
                        return {
                            "decision": "DISCARD",
                            "provenance_ok": False,
                            "reason": "FETCH_FAILED",
                            "criteria_results": [],
                            "counter_body_preview": "",
                        }
                    digest = utf8_digest(raw)
                    if digest != env["content_hash"]:
                        return {
                            "decision": "DISCARD",
                            "provenance_ok": False,
                            "reason": "HASH_MISMATCH",
                            "criteria_results": [],
                            "counter_body_preview": "",
                        }
                    counter_body = self._preview_from_raw(raw)
                except Exception:
                    return {
                        "decision": "DISCARD",
                        "provenance_ok": False,
                        "reason": "FETCH_FAILED",
                        "criteria_results": [],
                        "counter_body_preview": "",
                    }
            prompt = f"""You are a strict QA validator judging a client challenge.
Score the ORIGINAL freelancer deliverable (body_preview) against EACH acceptance criterion.
Use the client counter-evidence as additional context. Do not fetch or assume live freelancer URLs.

Job description: {job['desc']}
Acceptance criteria (JSON): {criteria_blob}
Freelancer body preview (T0 snapshot): {preview[:4000]}
Client counter-evidence body: {str(counter_body)[:4000]}

UPHOLD means the client is right and the work fails at least one criterion.
OVERRULE means the work still meets every criterion.

Respond STRICTLY as JSON:
{{
  "decision": "UPHOLD" or "OVERRULE",
  "provenance_ok": true or false,
  "criteria_results": [{{"id": "c1", "pass": true, "reason": "..."}}],
  "reason": "short overall explanation"
}}
Every criterion id MUST appear exactly once in criteria_results."""
            result = gl.nondet.exec_prompt(prompt, response_format="json")
            if not isinstance(result, dict):
                result = {}
            result["provenance_ok"] = True
            result["counter_body_preview"] = str(counter_body)[:BODY_PREVIEW_CHARS]
            return result

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            follower = leader_fn()
            return (
                follower.get("decision") == leaders_res.calldata.get("decision")
                and follower.get("provenance_ok") is leaders_res.calldata.get("provenance_ok")
            )

        try:
            result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        except Exception:
            job["status"] = "CHALLENGE_WINDOW"
            job["challenge_reason"] = "Challenge evaluation failed."
            jobs[idx] = job
            self._save_jobs(jobs)
            return

        if isinstance(result, dict) and result.get("counter_body_preview"):
            job["counter_body_preview"] = str(result.get("counter_body_preview"))[:BODY_PREVIEW_CHARS]
        attempts = int(job.get("challenge_attempts") or "0")
        decision = str((result or {}).get("decision") or "")
        provenance_ok = isinstance(result, dict) and result.get("provenance_ok") is True
        ids_ok = _ids_bind(result, job)
        all_pass = _all_pass(result)

        if decision == "UPHOLD" and provenance_ok and ids_ok and (not all_pass):
            job["challenge_attempts"] = str(attempts + 1)
            job["challenge_reason"] = str((result or {}).get("reason") or "Challenge upheld.")
            job["ai_criteria_results"] = result.get("criteria_results") if isinstance(result, dict) else []
            self.commit_verdict_then_pay(jobs, idx, job, "UPHOLD", job["client"], "CHALLENGE_UPHELD")
            return
        if decision == "OVERRULE" and provenance_ok and ids_ok and all_pass:
            job["challenge_attempts"] = str(attempts + 1)
            job["challenge_reason"] = str((result or {}).get("reason") or "Challenge overruled.")
            job["ai_criteria_results"] = result.get("criteria_results") if isinstance(result, dict) else []
            self.commit_verdict_then_pay(jobs, idx, job, "OVERRULE", job["freelancer"], "COMPLETED")
            return

        job["challenge_attempts"] = str(attempts + 1)
        job["status"] = "CHALLENGE_WINDOW"
        job["challenge_reason"] = "Challenge result discarded."
        jobs[idx] = job
        self._save_jobs(jobs)

    @gl.public.write
    def accept_work(self, job_id: str) -> None:
        caller = self._get_sender()
        jobs = self._load_jobs()
        idx = self._job_index(job_id)
        job = jobs[idx]
        if caller != job["client"]:
            raise Exception("Only the client can accept")
        if job["status"] != "CHALLENGE_WINDOW":
            raise Exception("Job is not in challenge window")
        if job.get("settled") is True:
            raise Exception("Job already settled")
        if str(job.get("challenge_decision") or ""):
            raise Exception("Challenge evaluation already decided")
        self._settle(job, job["freelancer"])
        job["status"] = "COMPLETED"
        job["ai_decision"] = "Client accepted work. Escrow released."
        jobs[idx] = job
        self._save_jobs(jobs)

    @gl.public.write
    def finalize_payout(self, job_id: str) -> None:
        jobs = self._load_jobs()
        idx = self._job_index(job_id)
        job = jobs[idx]
        if job.get("settled") is True:
            raise Exception("Job already settled")
        decision = str(job.get("challenge_decision") or "")
        status = job["status"]
        if decision == "UPHOLD":
            self._settle(job, job["client"])
            job["status"] = "CHALLENGE_UPHELD"
            jobs[idx] = job
            self._save_jobs(jobs)
            return
        if decision == "OVERRULE":
            self._settle(job, job["freelancer"])
            job["status"] = "COMPLETED"
            jobs[idx] = job
            self._save_jobs(jobs)
            return
        if status not in ("CHALLENGE_WINDOW", "CHALLENGE_EVALUATING"):
            raise Exception("Job is not in challenge window")
        if not window_expired(job):
            raise Exception("Challenge window still open")
        if decision == "":
            self._settle(job, job["freelancer"])
            job["status"] = "COMPLETED"
            jobs[idx] = job
            self._save_jobs(jobs)
            return
        raise Exception("Challenge evaluation already decided")

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
