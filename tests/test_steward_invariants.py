"""Static steward-compliance tests for GenWork escrow.

These tests do not require GenVM. They prove the source of truth in
Genwork.py / page.tsx cannot regress into the three prior rejection reasons:
no caller-supplied role addresses, real payable escrow, real AI evaluation,
and fail-closed native settlement.
"""

from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = (ROOT / "Genwork.py").read_text(encoding="utf-8")
PAGE = (ROOT / "app" / "page.tsx").read_text(encoding="utf-8")
CONSTANTS = (ROOT / "app" / "constants.ts").read_text(encoding="utf-8")


def settlement_destination(status: str, job: dict) -> str | None:
    if job.get("settled") is True:
        raise AssertionError("double settlement")
    if status == "COMPLETED":
        return job["freelancer"]
    if status in ("CANCELLED", "APPEAL_REJECTED"):
        return job["client"]
    if status in ("OPEN", "EVALUATING", "AI_REJECTED", "APPEAL_IN_PROGRESS", "FAILED_EVALUATION"):
        return None
    raise AssertionError(f"unknown terminal path: {status}")


class StewardInvariantTests(unittest.TestCase):
    def test_no_caller_supplied_role_addresses(self) -> None:
        write_defs = re.findall(
            r"def (post_job|submit_work|cancel_job|reject_work|appeal_decision|send_message|update_profile)\(([^)]*)\)",
            CONTRACT,
        )
        self.assertEqual(len(write_defs), 7)
        for name, params in write_defs:
            self.assertNotRegex(params, r"\b(client|freelancer|caller|owner|recipient)\s*:")
            self.assertNotRegex(params, r"address\s*:")

    def test_authority_from_sender_address(self) -> None:
        self.assertIn("gl.message.sender_address", CONTRACT)
        self.assertNotIn("gl.message.sender.address", CONTRACT)
        for fn in ("post_job", "submit_work", "cancel_job", "reject_work", "appeal_decision"):
            self.assertIn("self._get_sender()", CONTRACT)

    def test_post_job_is_payable_and_locks_msg_value(self) -> None:
        self.assertIn("@gl.public.write.payable", CONTRACT)
        self.assertIn("int(gl.message.value)", CONTRACT)
        self.assertIn("Job price must be greater than zero", CONTRACT)
        self.assertIn('stateMutability": "payable"', CONSTANTS)
        self.assertIn('{ "name": "desc", "type": "string" }', CONSTANTS)
        self.assertIn('{ "name": "category", "type": "string" }', CONSTANTS)

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
        self.assertIsNone(settlement_destination("AI_REJECTED", dict(job)))
        self.assertIsNone(settlement_destination("FAILED_EVALUATION", dict(job)))

        settled = dict(job)
        settled["settled"] = True
        with self.assertRaises(AssertionError):
            settlement_destination("COMPLETED", settled)

    def test_frontend_deposits_native_value(self) -> None:
        self.assertIn("parseEther(jobPrice)", PAGE)
        self.assertIn('sendGenLayerTransaction("post_job", [String(jobDesc), String(jobCategory)], priceWei)', PAGE)
        self.assertIn('sendGenLayerTransaction("submit_work", [String(jobId), String(workData)])', PAGE)
        self.assertNotIn("setInterval", PAGE)
        self.assertNotIn('connect("studionet")', PAGE)
        self.assertNotIn("provider: typeof window", PAGE)
        self.assertIn("parseEther", PAGE)
        self.assertIn("value:", PAGE)

    def test_frontend_submit_work_matches_abi(self) -> None:
        self.assertIn('{ "name": "work_data", "type": "string" }', CONSTANTS)
        self.assertIn("submit_work", PAGE)


if __name__ == "__main__":
    unittest.main()
