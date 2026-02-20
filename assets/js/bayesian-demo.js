/**
 * Bayesian Diagnosis Demo
 * Sequential updating of diagnostic probabilities as test results arrive.
 *
 * Likelihoods are approximate and for illustration only.
 * Real values would be derived from databases like MIMIC-IV.
 */

(function () {
  "use strict";

  // ── Diagnoses ──
  const DIAGNOSES = [
    { key: "chf",   label: "Heart Failure",  color: "#ef4444" },
    { key: "copd",  label: "COPD Exacerb.",  color: "#f59e0b" },
    { key: "pe",    label: "Pulm. Embolism", color: "#8b5cf6" },
    { key: "pna",   label: "Pneumonia",      color: "#10b981" },
    { key: "other", label: "Other",          color: "#6b7280" },
  ];

  // ── Patient presentation ──
  const PATIENT = {
    age: 68,
    sex: "Male",
    cc: "Acute shortness of breath, worsening over 2 days",
    hx: "History of CHF (EF 35%), COPD, 40-pack-year smoking, hypertension. Recently stopped taking furosemide 5 days ago.",
    vitals: "HR 108, BP 158/92, RR 28, SpO₂ 89% on room air, Temp 37.2°C",
  };

  // ── Priors P(D) — based on chief complaint + demographics ──
  const PRIORS = { chf: 0.30, copd: 0.25, pe: 0.12, pna: 0.18, other: 0.15 };

  // ── Tests: each has a result string and P(result | D) for each diagnosis ──
  const TESTS = [
    {
      id: "bnp",
      label: "BNP",
      resultText: "BNP: 1,840 pg/mL  (markedly elevated, ref < 100)",
      likelihoods: { chf: 0.88, copd: 0.15, pe: 0.25, pna: 0.12, other: 0.08 },
      narration: "BNP above 1,500 is strongly associated with acute decompensated heart failure. Watch CHF surge upward — but notice it doesn't go to 100%. Elevated BNP can also occur in PE and sepsis."
    },
    {
      id: "cxr",
      label: "Chest X-ray",
      resultText: "CXR: Bilateral pulmonary edema, cardiomegaly, small bilateral pleural effusions. No focal consolidation.",
      likelihoods: { chf: 0.90, copd: 0.10, pe: 0.08, pna: 0.15, other: 0.06 },
      narration: "Pulmonary edema on X-ray is the radiographic signature of heart failure. This result further concentrates probability on CHF while making pneumonia (no consolidation) and COPD (no hyperinflation) less likely."
    },
    {
      id: "trop",
      label: "Troponin",
      resultText: "Troponin I: 0.04 ng/mL  (borderline, ref < 0.03)",
      likelihoods: { chf: 0.45, copd: 0.08, pe: 0.30, pna: 0.10, other: 0.10 },
      narration: "A mildly elevated troponin is common in heart failure (myocardial strain) and PE. It's not specific — but notice how it slightly boosts PE's probability relative to COPD and pneumonia."
    },
    {
      id: "abg",
      label: "ABG",
      resultText: "ABG: pH 7.32, pCO₂ 32, pO₂ 58, HCO₃ 18  (metabolic acidosis with respiratory compensation, hypoxemia)",
      likelihoods: { chf: 0.55, copd: 0.20, pe: 0.40, pna: 0.25, other: 0.12 },
      narration: "Metabolic acidosis with hypoxemia fits several diagnoses. In CHF, it suggests poor cardiac output and tissue hypoperfusion. The low pCO₂ argues against COPD exacerbation (which typically shows respiratory acidosis)."
    },
    {
      id: "ddimer",
      label: "D-dimer",
      resultText: "D-dimer: 0.42 µg/mL  (normal, ref < 0.50)",
      likelihoods: { chf: 0.35, copd: 0.30, pe: 0.02, pna: 0.30, other: 0.25 },
      narration: "A normal D-dimer is powerful — it nearly eliminates PE (high negative predictive value). Watch PE's probability collapse. This is a great example of a test that's more useful for what it rules out than what it rules in."
    },
    {
      id: "lactate",
      label: "Lactate",
      resultText: "Lactate: 3.2 mmol/L  (elevated, ref < 2.0)",
      likelihoods: { chf: 0.60, copd: 0.12, pe: 0.35, pna: 0.20, other: 0.15 },
      narration: "Elevated lactate indicates tissue hypoperfusion — the body isn't getting enough oxygen. In the context of everything else, this further supports cardiogenic shock physiology from decompensated heart failure."
    },
  ];

  // ── State ──
  let posteriors = { ...PRIORS };
  let revealedTests = new Set();

  // ── DOM refs ──
  const patientCard = document.getElementById("patient-card");
  const probDisplay = document.getElementById("prob-display");
  const testPanel = document.getElementById("test-panel");
  const testResults = document.getElementById("test-results");
  const narration = document.getElementById("narration");
  const resetBtn = document.getElementById("reset-btn");

  // ── Render patient ──
  function renderPatient() {
    patientCard.innerHTML =
      `<strong>Patient Presentation</strong>` +
      `${PATIENT.age}yo ${PATIENT.sex}. ${PATIENT.cc}.<br>` +
      `<em>${PATIENT.hx}</em><br>` +
      `<strong style="margin-top:0.4rem">Vitals:</strong> ${PATIENT.vitals}`;
  }

  // ── Render probability bars ──
  function renderBars() {
    // Sort by posterior descending
    const sorted = DIAGNOSES.slice().sort((a, b) => posteriors[b.key] - posteriors[a.key]);
    const maxProb = Math.max(...sorted.map(d => posteriors[d.key]));

    probDisplay.innerHTML = sorted.map(d => {
      const p = posteriors[d.key];
      const pct = (p * 100).toFixed(1);
      // Scale bar width so the largest diagnosis fills 100%
      const barWidth = (p / Math.max(maxProb, 0.01)) * 100;
      return `
        <div class="prob-row">
          <span class="prob-label">${d.label}</span>
          <div class="prob-bar-track">
            <div class="prob-bar-fill" style="width:${barWidth}%;background:${d.color}"></div>
          </div>
          <span class="prob-value" style="color:${d.color}">${pct}%</span>
        </div>`;
    }).join("");
  }

  // ── Render test buttons ──
  function renderTests() {
    testPanel.innerHTML = TESTS.map(t => {
      const revealed = revealedTests.has(t.id);
      return `<button class="test-btn ${revealed ? 'revealed' : ''}"
                data-test="${t.id}" ${revealed ? 'disabled' : ''}>
                ${revealed ? '✓ ' : ''}${t.label}
              </button>`;
    }).join("");

    testPanel.querySelectorAll(".test-btn").forEach(btn => {
      btn.addEventListener("click", () => revealTest(btn.dataset.test));
    });
  }

  // ── Bayesian update ──
  function bayesianUpdate(likelihoods) {
    let evidence = 0;
    const updated = {};
    for (const d of DIAGNOSES) {
      updated[d.key] = posteriors[d.key] * likelihoods[d.key];
      evidence += updated[d.key];
    }
    // Normalize
    for (const d of DIAGNOSES) {
      posteriors[d.key] = updated[d.key] / evidence;
    }
  }

  // ── Reveal a test ──
  function revealTest(testId) {
    const test = TESTS.find(t => t.id === testId);
    if (!test || revealedTests.has(testId)) return;

    revealedTests.add(testId);
    bayesianUpdate(test.likelihoods);

    // Add result to log
    const div = document.createElement("div");
    div.className = "test-result";
    div.innerHTML = `<strong>${test.label}:</strong> ${test.resultText}`;
    testResults.appendChild(div);

    // Update narration
    narration.textContent = test.narration;

    // Re-render
    renderBars();
    renderTests();
    resetBtn.style.display = "inline-block";

    // Check if all tests revealed
    if (revealedTests.size === TESTS.length) {
      const top = DIAGNOSES.slice().sort((a, b) => posteriors[b.key] - posteriors[a.key])[0];
      narration.textContent =
        `All tests complete. Final posterior: ${top.label} at ${(posteriors[top.key] * 100).toFixed(1)}%. ` +
        `This patient likely has acute decompensated heart failure — precipitated by stopping their diuretic. ` +
        `Notice that no single test "made" the diagnosis. Each shifted the landscape incrementally. ` +
        `That's decompressed reasoning.`;
    }
  }

  // ── Reset ──
  function reset() {
    posteriors = { ...PRIORS };
    revealedTests.clear();
    testResults.innerHTML = "";
    narration.textContent = "Click a test to begin. Watch how each result shifts the probability landscape.";
    resetBtn.style.display = "none";
    renderBars();
    renderTests();
  }

  // ── Init ──
  renderPatient();
  renderBars();
  renderTests();
  resetBtn.addEventListener("click", reset);
})();
