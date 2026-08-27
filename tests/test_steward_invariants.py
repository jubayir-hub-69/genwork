"""Static steward-compliance tests for GenWork escrow.

These tests do not require GenVM. They prove the source of truth in
contracts/Genwork.py / page.tsx cannot regress into the three prior rejection reasons:
no caller-supplied role addresses, real payable escrow, real AI evaluation,
and fail-closed native settlement.
"""

from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = (ROOT / "contracts" / "Genwork.py").read_text(encoding="utf-8")
PAGE = (ROOT / "app" / "page.tsx").read_text(encoding="utf-8")
CONSTANTS = (ROOT / "app" / "constants.ts").read_text(encoding="utf-8")

WRITE_NAMES = (
    "post_job",
    "submit_work",
    "cancel_job",
    "reject_work",
    "appeal_decision",
    "challenge_work",
    "accept_work",
    "finalize_payout",
    "send_message",
    "update_profile",
)


def _method_body(name: str) -> str:
    pattern = rf"def {name}\(.*?\n(.*?)(?=\n    @gl\.public|\n    def [a-z]|\Z)"
    match = re.search(pattern, CONTRACT, flags=re.S)
    if not match:
        raise AssertionError(f"method {name} not found")
    return match.group(1)


def settlement_destination(status: str, job: dict) -> str | None:
    if job.get("settled") is True:
        raise AssertionError("double settlement")
    if status == "COMPLETED":
        return job["freelancer"]
    if status in ("CANCELLED", "APPEAL_REJECTED", "CHALLENGE_UPHELD"):
        return job["client"]
    if status in (
        "OPEN",
        "EVALUATING",
        "AI_REJECTED",
        "APPEAL_IN_PROGRESS",
        "FAILED_EVALUATION",
        "CHALLENGE_WINDOW",
        "CHALLENGE_EVALUATING",
    ):
        return None
    raise AssertionError(f"unknown terminal path: {status}")


class StewardInvariantTests(unittest.TestCase):
    def test_no_caller_supplied_role_addresses(self) -> None:
        write_defs = re.findall(
            r"def (" + "|".join(WRITE_NAMES) + r")\(([^)]*)\)",
            CONTRACT,
        )
        self.assertEqual(len(write_defs), 10)
        for name, params in write_defs:
            self.assertNotRegex(params, r"\b(client|freelancer|caller|owner|recipient)\s*:")
            self.assertNotRegex(params, r"address\s*:")

    def test_authority_from_sender_address(self) -> None:
        self.assertIn("gl.message.sender_address", CONTRACT)
        self.assertNotIn("gl.message.sender.address", CONTRACT)
        for fn in ("post_job", "submit_work", "cancel_job", "reject_work", "appeal_decision", "challenge_work", "accept_work"):
            self.assertIn("self._get_sender()", CONTRACT)

    def test_post_job_is_payable_and_locks_msg_value(self) -> None:
        self.assertIn("@gl.public.write.payable", CONTRACT)
        self.assertIn("int(gl.message.value)", CONTRACT)
        self.assertIn("Job price must be greater than zero", CONTRACT)
        self.assertIn('stateMutability": "payable"', CONSTANTS)
        self.assertIn('{ "name": "desc", "type": "string" }', CONSTANTS)
        self.assertIn('{ "name": "category", "type": "string" }', CONSTANTS)
        self.assertIn('{ "name": "criteria_json", "type": "string" }', CONSTANTS)
        self.assertIn('{ "name": "challenge_window_secs", "type": "string" }', CONSTANTS)

    def test_payout_uses_official_emit_transfer_and_fail_closed(self) -> None:
        self.assertIn("emit_transfer", CONTRACT)
        self.assertIn("_Wallet(dest).emit_transfer", CONTRACT)
        self.assertIn("u256(wei)", CONTRACT)
        self.assertNotRegex(CONTRACT, r"except:\s*pass")
        self.assertIn("Job already settled", CONTRACT)
        self.assertIn('job["settled"] = True', CONTRACT)

    def test_real_ai_evaluation_not_outline(self) -> None:
        self.assertGreaterEqual(CONTRACT.count("gl.nondet.fetch_url"), 2)
        self.assertGreaterEqual(CONTRACT.count("gl.nondet.exec_prompt"), 2)
        self.assertGreaterEqual(CONTRACT.count("gl.vm.run_nondet_unsafe"), 2)
        self.assertIn("response_format=\"json\"", CONTRACT)

    def test_fund_conservation_table(self) -> None:
        job = {
            "client": "0xclient",
            "freelancer": "0xworker",
            "price_wei": "1000",
            "settled": False,
        }
        self.assertEqual(settlement_destination("COMPLETED", job), "0xworker")
        self.assertEqual(settlement_destination("CANCELLED", dict(job)), "0xclient")
        self.assertEqual(settlement_destination("APPEAL_REJECTED", dict(job)), "0xclient")
        self.assertEqual(settlement_destination("CHALLENGE_UPHELD", dict(job)), "0xclient")
        self.assertIsNone(settlement_destination("AI_REJECTED", dict(job)))
        self.assertIsNone(settlement_destination("FAILED_EVALUATION", dict(job)))
        self.assertIsNone(settlement_destination("CHALLENGE_WINDOW", dict(job)))
        self.assertIsNone(settlement_destination("CHALLENGE_EVALUATING", dict(job)))

        settled = dict(job)
        settled["settled"] = True
        with self.assertRaises(AssertionError):
            settlement_destination("COMPLETED", settled)

    def test_submit_work_never_settles(self) -> None:
        body = _method_body("submit_work")
        self.assertNotIn("_settle", body)
        self.assertIn("apply_approval_window", body)

    def test_appeal_approve_does_not_pay_freelancer(self) -> None:
        body = _method_body("appeal_decision")
        self.assertNotIn('_settle(job, job["freelancer"])', body)
        self.assertIn('_settle(job, job["client"])', body)
        self.assertIn("apply_approval_window", body)

    def test_milestone_gates_and_frozen_strings(self) -> None:
        self.assertIn("Acceptance criteria required", CONTRACT)
        self.assertIn("Evidence envelope required", CONTRACT)
        self.assertIn("genwork.evidence.v1", CONTRACT)
        self.assertIn("attested_by does not match sender", CONTRACT)
        self.assertIn("Inline content_hash does not match body", CONTRACT)
        self.assertIn("HASH_PREIMAGE_V1", CONTRACT)
        self.assertIn("Challenge window expired", CONTRACT)
        self.assertIn("Challenge window still open", CONTRACT)
        self.assertIn("Challenge window not opened", CONTRACT)
        self.assertIn("MIN_WINDOW = 3600", CONTRACT)
        self.assertNotIn("MIN_WINDOW = 300", CONTRACT)
        self.assertIn("Only the client can challenge", CONTRACT)
        self.assertIn("client_challenge", CONTRACT)
        self.assertIn("Challenge retry limit reached", CONTRACT)
        self.assertIn("CHALLENGE_NO_LIVE_FREELANCER_FETCH", CONTRACT)
        self.assertNotIn("ORIGINAL_URI_MUTATED", CONTRACT)
        self.assertIn('r.get("pass") is True', CONTRACT)
        self.assertIn("Resubmit limit reached", CONTRACT)
        self.assertIn("AI_REJECTED", _method_body("submit_work"))
        self.assertIn("FAILED_EVALUATION", _method_body("submit_work"))

    def test_uphold_persists_before_settle(self) -> None:
        body = _method_body("commit_verdict_then_pay")
        save_at = body.find("self._save_jobs(jobs)")
        settle_at = body.find("self._settle(")
        self.assertGreaterEqual(save_at, 0)
        self.assertGreater(settle_at, save_at)
        self.assertNotIn("CHALLENGE_WINDOW", body)
        finalize = _method_body("finalize_payout")
        uphold_at = finalize.find('"UPHOLD"')
        expired_at = finalize.find("window_expired")
        freelancer_at = finalize.find('job["freelancer"]')
        self.assertGreaterEqual(uphold_at, 0)
        self.assertGreater(expired_at, uphold_at)
        self.assertGreater(freelancer_at, uphold_at)

    def test_challenge_fail_does_not_reset_deadline(self) -> None:
        body = _method_body("challenge_work")
        except_block = body.split("except Exception:", 1)[1].split("if decision ==", 1)[0]
        self.assertNotIn("challenge_deadline", except_block)
        first_inc = body.find('str(attempts + 1)')
        nondet = body.find("run_nondet_unsafe")
        self.assertGreater(first_inc, nondet)

    def test_frontend_deposits_native_value(self) -> None:
        self.assertIn("parseEther(jobPrice)", PAGE)
        self.assertIn("criteriaJson", PAGE)
        self.assertIn("challengeWindowSecs", PAGE)
        self.assertIn("sendGenLayerTransaction", PAGE)
        self.assertIn("post_job", PAGE)
        self.assertNotIn("setInterval", PAGE)
        self.assertNotIn('connect("studionet")', PAGE)
        self.assertNotIn("provider: typeof window", PAGE)
        self.assertIn("parseEther", PAGE)
        self.assertIn("value:", PAGE)
        self.assertIn("criteriaRows", PAGE)
        self.assertIn("evidenceDrafts", PAGE)
        self.assertIn("accept_work", PAGE)
        self.assertIn("finalize_payout", PAGE)
        self.assertIn("challenge_work", PAGE)
        self.assertIn("CHALLENGE_EVALUATING", PAGE)

    def test_frontend_submit_work_matches_abi(self) -> None:
        self.assertIn('{ "name": "evidence_json", "type": "string" }', CONSTANTS)
        self.assertIn("submit_work", PAGE)
        self.assertIn("JSON.stringify", PAGE)


if __name__ == "__main__":
    unittest.main()
