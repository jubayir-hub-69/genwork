import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const contract = readFileSync(join(root, "Genwork.py"), "utf8");
const page = readFileSync(join(root, "app", "page.tsx"), "utf8");
const constants = readFileSync(join(root, "app", "constants.ts"), "utf8");

function settlementDestination(status, job) {
  if (job.settled === true) throw new Error("double settlement");
  if (status === "COMPLETED") return job.freelancer;
  if (status === "CANCELLED" || status === "APPEAL_REJECTED") return job.client;
  if (["OPEN", "EVALUATING", "AI_REJECTED", "APPEAL_IN_PROGRESS", "FAILED_EVALUATION"].includes(status)) {
    return null;
  }
  throw new Error(`unknown terminal path: ${status}`);
}

const writeDefs = [...contract.matchAll(/def (post_job|submit_work|cancel_job|reject_work|appeal_decision|send_message|update_profile)\(([^)]*)\)/g)];
assert.equal(writeDefs.length, 7);
for (const [, , params] of writeDefs) {
  assert.equal(/\b(client|freelancer|caller|owner|recipient)\s*:/.test(params), false);
  assert.equal(/\baddress\s*:/.test(params), false);
}

assert.match(contract, /gl\.message\.sender_address/);
assert.equal(contract.includes("gl.message.sender.address"), false);
for (const fn of ["post_job", "submit_work", "cancel_job", "reject_work", "appeal_decision"]) {
  assert.ok(contract.includes("self._get_sender()"), fn);
}

assert.match(contract, /@gl\.public\.write\.payable/);
assert.match(contract, /int\(gl\.message\.value\)/);
assert.match(constants, /stateMutability": "payable"/);
assert.match(constants, /"name": "desc"/);
assert.match(constants, /"name": "category"/);

assert.match(contract, /emit_transfer/);
assert.match(contract, /_Wallet\(dest\)\.emit_transfer/);
assert.match(contract, /u256\(wei\)/);
assert.equal(/except:\s*pass/.test(contract), false);
assert.match(contract, /Job already settled/);
assert.match(contract, /job\["settled"\] = True/);

assert.ok((contract.match(/gl\.nondet\.fetch_url/g) || []).length >= 2);
assert.ok((contract.match(/gl\.nondet\.exec_prompt/g) || []).length >= 2);
assert.ok((contract.match(/gl\.vm\.run_nondet_unsafe/g) || []).length >= 2);

const job = { client: "0xclient", freelancer: "0xworker", price_wei: "1000", settled: false };
assert.equal(settlementDestination("COMPLETED", job), "0xworker");
assert.equal(settlementDestination("CANCELLED", { ...job }), "0xclient");
assert.equal(settlementDestination("APPEAL_REJECTED", { ...job }), "0xclient");
assert.equal(settlementDestination("AI_REJECTED", { ...job }), null);
assert.equal(settlementDestination("FAILED_EVALUATION", { ...job }), null);
assert.throws(() => settlementDestination("COMPLETED", { ...job, settled: true }));

assert.match(page, /parseEther\(jobPrice\)/);
assert.match(page, /sendGenLayerTransaction\("post_job", \[String\(jobDesc\), String\(jobCategory\)\], priceWei\)/);
assert.match(page, /sendGenLayerTransaction\("submit_work", \[String\(jobId\), String\(workData\)\]\)/);
assert.equal(page.includes("setInterval"), false);
assert.equal(page.includes('connect("studionet")'), false);
assert.equal(page.includes("provider: typeof window"), false);
assert.match(constants, /"name": "work_data"/);

console.log("ALL STEWARD INVARIANTS PASSED");
