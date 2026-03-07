/**
 * Bayesian Diagnostic Game
 * Interactive clinical reasoning game with D3 bubble visualization.
 * Likelihood ratios are rough placeholders — will be replaced with MIMIC-IV derived values.
 */
(function () {
  "use strict";

  // ── Diagnoses ──
  const DIAGNOSES = [
    { key: "chf",  label: "Heart Failure",       abbr: "CHF",  color: "#ef4444" },
    { key: "copd", label: "COPD Exacerbation",   abbr: "COPD", color: "#f59e0b" },
    { key: "pe",   label: "Pulmonary Embolism",  abbr: "PE",   color: "#8b5cf6" },
    { key: "pna",  label: "Pneumonia",           abbr: "PNA",  color: "#10b981" },
    { key: "anx",  label: "Anxiety / Hypervent.", abbr: "ANX",  color: "#06b6d4" },
    { key: "other",label: "Other",               abbr: "OTH",  color: "#6b7280" },
  ];

  const PRIORS = { chf: 0.20, copd: 0.20, pe: 0.10, pna: 0.20, anx: 0.15, other: 0.15 };

  // ── Stages ──
  const STAGES = [
    {
      id: "cc", title: "Chief Complaint", description: "A 68-year-old man presents to the ED with shortness of breath. Gather the initial details.",
      questions: [
        {
          id: "onset", label: "Onset", multi: false,
          options: [
            { label: "Sudden (minutes)", lrs: { chf: 0.6, copd: 0.5, pe: 2.5, pna: 0.7, anx: 2.0, other: 1.0 } },
            { label: "Gradual (days)", lrs: { chf: 1.5, copd: 1.4, pe: 0.3, pna: 1.6, anx: 0.5, other: 1.0 } },
            { label: "Chronic worsening", lrs: { chf: 1.8, copd: 2.0, pe: 0.2, pna: 0.6, anx: 0.4, other: 1.2 } },
          ],
        },
        {
          id: "severity", label: "Severity", multi: false,
          options: [
            { label: "Mild", lrs: { chf: 0.6, copd: 0.7, pe: 0.5, pna: 0.7, anx: 1.8, other: 1.5 } },
            { label: "Moderate", lrs: { chf: 1.0, copd: 1.0, pe: 1.0, pna: 1.0, anx: 1.0, other: 1.0 } },
            { label: "Severe", lrs: { chf: 1.5, copd: 1.4, pe: 1.5, pna: 1.3, anx: 0.4, other: 0.7 } },
          ],
        },
        {
          id: "symptoms", label: "Associated Symptoms (select all)", multi: true,
          options: [
            { label: "Chest pain", lrs: { chf: 0.9, copd: 0.7, pe: 2.0, pna: 1.3, anx: 1.5, other: 1.0 } },
            { label: "Cough", lrs: { chf: 1.2, copd: 1.5, pe: 0.8, pna: 2.0, anx: 0.5, other: 0.8 } },
            { label: "Fever", lrs: { chf: 0.5, copd: 1.2, pe: 0.6, pna: 2.5, anx: 0.3, other: 1.0 } },
            { label: "Leg swelling", lrs: { chf: 2.5, copd: 0.6, pe: 1.8, pna: 0.5, anx: 0.3, other: 0.7 } },
            { label: "Wheezing", lrs: { chf: 1.3, copd: 2.5, pe: 0.5, pna: 0.8, anx: 0.7, other: 0.8 } },
            { label: "Palpitations", lrs: { chf: 1.3, copd: 0.8, pe: 1.3, pna: 0.6, anx: 2.5, other: 1.0 } },
          ],
        },
      ],
      narration: function(choices) {
        const onset = choices.onset;
        if (!onset) return "";
        if (onset === "Sudden (minutes)") return "Sudden-onset dyspnea raises concern for acute processes — PE, flash pulmonary edema, or panic. Gradual presentations would favor infectious or decompensating causes.";
        if (onset === "Gradual (days)") return "A gradual onset over days fits exacerbation of chronic disease (CHF, COPD) or evolving pneumonia. PE becomes less likely but isn't eliminated.";
        return "Progressive worsening points toward decompensation of a chronic condition. The differential narrows toward CHF and COPD exacerbation.";
      },
    },
    {
      id: "hx", title: "History", description: "Review the patient's medical history and risk factors.",
      questions: [
        {
          id: "smoking", label: "Smoking History", multi: false,
          options: [
            { label: "Never", lrs: { chf: 1.0, copd: 0.3, pe: 1.0, pna: 0.8, anx: 1.2, other: 1.2 } },
            { label: "Former", lrs: { chf: 1.1, copd: 1.5, pe: 1.0, pna: 1.1, anx: 0.9, other: 1.0 } },
            { label: "Active", lrs: { chf: 1.0, copd: 2.5, pe: 1.0, pna: 1.3, anx: 0.8, other: 0.9 } },
          ],
        },
        {
          id: "cardiac", label: "Cardiac History", multi: false,
          options: [
            { label: "Known CHF", lrs: { chf: 3.0, copd: 0.8, pe: 0.8, pna: 0.8, anx: 0.5, other: 0.7 } },
            { label: "None", lrs: { chf: 0.5, copd: 1.1, pe: 1.1, pna: 1.1, anx: 1.2, other: 1.1 } },
          ],
        },
        {
          id: "vte", label: "VTE Risk Factors", multi: false,
          options: [
            { label: "Recent surgery", lrs: { chf: 0.8, copd: 0.8, pe: 3.0, pna: 0.8, anx: 0.6, other: 0.9 } },
            { label: "Prior DVT/PE", lrs: { chf: 0.8, copd: 0.8, pe: 3.5, pna: 0.7, anx: 0.5, other: 0.8 } },
            { label: "None", lrs: { chf: 1.1, copd: 1.1, pe: 0.5, pna: 1.1, anx: 1.2, other: 1.1 } },
          ],
        },
      ],
      narration: function(choices) {
        if (choices.cardiac === "Known CHF") return "Known heart failure dramatically increases the prior probability of CHF exacerbation. The most common cause of acute dyspnea in a CHF patient is... CHF.";
        if (choices.vte === "Prior DVT/PE") return "A history of VTE is one of the strongest risk factors for recurrent PE. This should keep PE high on the differential regardless of other findings.";
        if (choices.smoking === "Active") return "Active smoking is the strongest risk factor for COPD and increases pneumonia risk. The bronchial inflammation of chronic smoking makes both more likely.";
        return "The history helps calibrate baseline risk. Each risk factor shifts the prior landscape before any tests are ordered.";
      },
    },
    {
      id: "vitals", title: "Vital Signs", description: "The nurse hands you the vitals.",
      questions: [
        {
          id: "hr", label: "Heart Rate", multi: false,
          options: [
            { label: "Normal (60-100)", lrs: { chf: 0.8, copd: 0.8, pe: 0.5, pna: 0.7, anx: 0.6, other: 1.3 } },
            { label: "Tachycardic (100-120)", lrs: { chf: 1.3, copd: 1.2, pe: 1.8, pna: 1.4, anx: 1.8, other: 0.8 } },
            { label: "Very tachycardic (>120)", lrs: { chf: 1.5, copd: 1.0, pe: 2.5, pna: 1.5, anx: 1.5, other: 0.6 } },
          ],
        },
        {
          id: "spo2", label: "Oxygen Saturation", multi: false,
          options: [
            { label: "> 95%", lrs: { chf: 0.5, copd: 0.5, pe: 0.6, pna: 0.5, anx: 2.5, other: 1.5 } },
            { label: "90-95%", lrs: { chf: 1.3, copd: 1.5, pe: 1.3, pna: 1.4, anx: 0.4, other: 0.9 } },
            { label: "< 90%", lrs: { chf: 2.0, copd: 2.0, pe: 2.0, pna: 2.0, anx: 0.1, other: 0.7 } },
          ],
        },
        {
          id: "temp", label: "Temperature", multi: false,
          options: [
            { label: "Normal", lrs: { chf: 1.1, copd: 1.0, pe: 1.1, pna: 0.5, anx: 1.3, other: 1.1 } },
            { label: "Low-grade (37.5-38.5)", lrs: { chf: 0.8, copd: 1.2, pe: 0.9, pna: 1.8, anx: 0.5, other: 1.0 } },
            { label: "High fever (>38.5)", lrs: { chf: 0.4, copd: 1.0, pe: 0.5, pna: 3.0, anx: 0.2, other: 0.8 } },
          ],
        },
      ],
      narration: function(choices) {
        if (choices.spo2 === "< 90%") return "Significant hypoxemia (SpO2 < 90%) essentially eliminates anxiety/hyperventilation and points toward genuine cardiopulmonary pathology. The oxygen level alone narrows the differential considerably.";
        if (choices.spo2 === "> 95%") return "Normal oxygen saturation makes serious cardiopulmonary disease less likely. Anxiety and hyperventilation often present with completely normal oxygenation — patients feel short of breath but are saturating well.";
        if (choices.temp === "High fever (>38.5)") return "High fever strongly favors an infectious etiology. Pneumonia jumps to the top of the differential. CHF and PE rarely cause significant fever.";
        return "Vitals are the first objective data. Tachycardia is nonspecific but concerning. Oxygen saturation is one of the most powerful discriminators in the SOB differential.";
      },
    },
    {
      id: "exam", title: "Physical Exam", description: "You examine the patient at the bedside.",
      questions: [
        {
          id: "lungs", label: "Lung Sounds", multi: false,
          options: [
            { label: "Bilateral crackles", lrs: { chf: 3.0, copd: 0.4, pe: 0.5, pna: 0.8, anx: 0.2, other: 0.5 } },
            { label: "Wheezes", lrs: { chf: 1.2, copd: 3.0, pe: 0.5, pna: 0.6, anx: 0.4, other: 0.7 } },
            { label: "Focal crackles", lrs: { chf: 0.6, copd: 0.5, pe: 0.8, pna: 3.5, anx: 0.2, other: 0.7 } },
            { label: "Diminished", lrs: { chf: 1.2, copd: 2.0, pe: 1.0, pna: 1.0, anx: 0.5, other: 1.2 } },
            { label: "Clear", lrs: { chf: 0.3, copd: 0.4, pe: 1.5, pna: 0.3, anx: 2.5, other: 1.8 } },
          ],
        },
        {
          id: "jvd", label: "Jugular Venous Distension", multi: false,
          options: [
            { label: "Present", lrs: { chf: 3.5, copd: 1.0, pe: 1.5, pna: 0.5, anx: 0.2, other: 0.5 } },
            { label: "Absent", lrs: { chf: 0.5, copd: 1.0, pe: 0.9, pna: 1.1, anx: 1.3, other: 1.2 } },
          ],
        },
        {
          id: "edema", label: "Lower Extremity Edema", multi: false,
          options: [
            { label: "Bilateral", lrs: { chf: 3.0, copd: 1.2, pe: 0.7, pna: 0.5, anx: 0.3, other: 0.8 } },
            { label: "Unilateral", lrs: { chf: 0.6, copd: 0.5, pe: 3.5, pna: 0.5, anx: 0.3, other: 0.8 } },
            { label: "None", lrs: { chf: 0.5, copd: 1.0, pe: 0.7, pna: 1.2, anx: 1.5, other: 1.2 } },
          ],
        },
      ],
      narration: function(choices) {
        if (choices.lungs === "Bilateral crackles" && choices.jvd === "Present") return "Bilateral crackles + JVD is the classic triad of acute decompensated heart failure. Fluid backs up from the failing heart into the lungs (crackles) and venous system (JVD). This combination is highly specific.";
        if (choices.lungs === "Focal crackles") return "Focal crackles localized to one area strongly suggest consolidation — the hallmark of pneumonia. Unlike CHF's bilateral crackles, this is asymmetric and reflects a localized process.";
        if (choices.edema === "Unilateral") return "Unilateral leg swelling is a red flag for DVT, which is the source of most pulmonary emboli. This finding should keep PE prominently in the differential.";
        if (choices.lungs === "Clear") return "Clear lungs make CHF, pneumonia, and COPD less likely. PE often presents with a relatively clear exam — the pathology is vascular, not parenchymal. Anxiety also presents with a normal exam.";
        return "The physical exam adds another layer of data. Each finding applies its own likelihood ratio, and the differential continues to shift.";
      },
    },
    {
      id: "labs", title: "Laboratory Results", description: "Lab results return from the ED workup.",
      questions: [
        {
          id: "bnp", label: "BNP / NT-proBNP", multi: false,
          options: [
            { label: "Normal", lrs: { chf: 0.1, copd: 1.3, pe: 1.0, pna: 1.2, anx: 1.5, other: 1.3 } },
            { label: "Mildly elevated (<400)", lrs: { chf: 1.5, copd: 1.0, pe: 1.2, pna: 0.9, anx: 0.6, other: 0.9 } },
            { label: "Markedly elevated (>400)", lrs: { chf: 3.5, copd: 0.5, pe: 0.8, pna: 0.5, anx: 0.3, other: 0.5 } },
          ],
        },
        {
          id: "trop", label: "Troponin", multi: false,
          options: [
            { label: "Normal", lrs: { chf: 0.7, copd: 1.1, pe: 0.6, pna: 1.1, anx: 1.3, other: 1.1 } },
            { label: "Elevated", lrs: { chf: 1.8, copd: 0.6, pe: 2.0, pna: 0.6, anx: 0.3, other: 0.7 } },
          ],
        },
        {
          id: "ddimer", label: "D-dimer", multi: false,
          options: [
            { label: "Normal", lrs: { chf: 0.9, copd: 0.9, pe: 0.05, pna: 0.9, anx: 1.2, other: 1.1 } },
            { label: "Elevated", lrs: { chf: 1.1, copd: 1.1, pe: 2.0, pna: 1.1, anx: 0.7, other: 0.9 } },
          ],
        },
        {
          id: "wbc", label: "White Blood Cell Count", multi: false,
          options: [
            { label: "Normal", lrs: { chf: 1.0, copd: 0.8, pe: 1.0, pna: 0.5, anx: 1.3, other: 1.1 } },
            { label: "Leukocytosis", lrs: { chf: 0.8, copd: 1.3, pe: 0.9, pna: 2.5, anx: 0.4, other: 0.9 } },
          ],
        },
        {
          id: "abg", label: "ABG Pattern", multi: false,
          options: [
            { label: "Respiratory alkalosis", lrs: { chf: 0.8, copd: 0.3, pe: 2.0, pna: 0.8, anx: 2.5, other: 0.8 } },
            { label: "Respiratory acidosis", lrs: { chf: 0.7, copd: 3.0, pe: 0.3, pna: 0.8, anx: 0.1, other: 0.7 } },
            { label: "Met. acidosis + hypoxemia", lrs: { chf: 1.8, copd: 0.7, pe: 1.5, pna: 1.3, anx: 0.1, other: 0.8 } },
            { label: "Normal", lrs: { chf: 0.5, copd: 0.5, pe: 0.6, pna: 0.6, anx: 2.5, other: 1.8 } },
          ],
        },
      ],
      narration: function(choices) {
        if (choices.bnp === "Normal") return "A normal BNP is one of the most powerful rule-out tests in medicine. Its negative likelihood ratio of ~0.1 nearly eliminates heart failure. Watch CHF collapse.";
        if (choices.bnp === "Markedly elevated (>400)") return "A markedly elevated BNP is the biochemical signature of myocardial wall stress. While not 100% specific for CHF (PE and sepsis can also elevate it), this is a strong signal.";
        if (choices.ddimer === "Normal") return "A normal D-dimer essentially eliminates PE — its negative predictive value exceeds 99% in low-to-moderate pretest probability. Watch PE's bubble virtually disappear.";
        if (choices.abg === "Respiratory acidosis") return "Respiratory acidosis (elevated pCO2) means the patient can't blow off CO2 — classic for COPD exacerbation with bronchospasm. This pattern is highly specific for obstructive disease.";
        return "Lab results provide some of the strongest likelihood ratios in clinical medicine. A normal BNP or D-dimer can dramatically shift the posterior by ruling out diagnoses with near-certainty.";
      },
    },
    {
      id: "imaging", title: "Imaging", description: "Imaging results are now available.",
      questions: [
        {
          id: "cxr", label: "Chest X-ray", multi: false,
          options: [
            { label: "Pulmonary edema", lrs: { chf: 3.5, copd: 0.3, pe: 0.4, pna: 0.3, anx: 0.1, other: 0.4 } },
            { label: "Hyperinflation", lrs: { chf: 0.4, copd: 3.5, pe: 0.6, pna: 0.4, anx: 0.3, other: 0.6 } },
            { label: "Consolidation", lrs: { chf: 0.3, copd: 0.4, pe: 0.4, pna: 4.0, anx: 0.1, other: 0.5 } },
            { label: "Normal", lrs: { chf: 0.3, copd: 0.5, pe: 1.5, pna: 0.3, anx: 2.5, other: 1.5 } },
          ],
        },
      ],
      // CTA is injected dynamically if PE > 15%
      narration: function(choices) {
        if (choices.cxr === "Pulmonary edema") return "Bilateral pulmonary edema on CXR is the radiographic hallmark of heart failure. Cephalization of vessels, bilateral infiltrates, pleural effusions — the heart is failing to pump effectively.";
        if (choices.cxr === "Consolidation") return "A focal consolidation on CXR is classic for bacterial pneumonia. The lobar pattern indicates a localized infectious process filling alveoli with inflammatory exudate.";
        if (choices.cxr === "Normal") return "A normal chest X-ray is actually informative. It argues against CHF, COPD exacerbation, and pneumonia. PE classically presents with a normal CXR — the pathology is vascular, invisible to plain film.";
        if (choices.cxr === "Hyperinflation") return "Hyperinflated lungs with flattened diaphragms are the radiographic signature of air trapping in COPD. This finding dramatically increases the probability of COPD exacerbation.";
        return "";
      },
    },
  ];

  // CTA question injected at imaging stage when PE is likely
  const CTA_QUESTION = {
    id: "cta", label: "CT Angiography", multi: false,
    options: [
      { label: "PE confirmed", lrs: { chf: 0.3, copd: 0.3, pe: 15.0, pna: 0.3, anx: 0.1, other: 0.3 } },
      { label: "No PE", lrs: { chf: 1.1, copd: 1.1, pe: 0.02, pna: 1.1, anx: 1.1, other: 1.1 } },
      { label: "Not ordered", lrs: { chf: 1.0, copd: 1.0, pe: 1.0, pna: 1.0, anx: 1.0, other: 1.0 } },
    ],
  };

  // ── Game State ──
  let posteriors = {};
  let history = []; // { stageName, questionId, optionLabel, deltas }
  let currentStage = -1; // -1 = intro
  let stageChoices = {};
  let simulation = null;
  let bubbleNodes = [];
  let activeView = "bubbles"; // "bubbles" or "planets"
  let isFullscreen = false;
  let planetView = null;

  // ── DOM ──
  const $ = (id) => document.getElementById(id);

  // ── Initialize ──
  function init() {
    resetState();
    renderBubbles();
    updateCertainty();

    $("start-btn").addEventListener("click", startGame);
    $("details-toggle").addEventListener("click", toggleDetails);
    $("next-btn").addEventListener("click", advanceStage);
    $("restart-btn").addEventListener("click", () => {
      resetState();
      renderBubbles();
      updateCertainty();
      if (planetView) planetView.update();
      showIntro();
    });

    // View toggle
    $("viz-toggle").addEventListener("click", (e) => {
      const btn = e.target.closest(".viz-toggle-btn");
      if (!btn) return;
      switchView(btn.dataset.view);
    });

    // Fullscreen
    $("fullscreen-btn").addEventListener("click", toggleFullscreen);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isFullscreen) toggleFullscreen();
    });

    // Resize handler
    window.addEventListener("resize", () => {
      if (activeView === "bubbles") renderBubbles();
      if (planetView) planetView.resize();
    });
  }

  function resetState() {
    posteriors = { ...PRIORS };
    history = [];
    currentStage = -1;
    stageChoices = {};
  }

  // ── View Switching ──
  function switchView(view) {
    if (view === activeView) return;
    activeView = view;

    $("viz-toggle").querySelectorAll(".viz-toggle-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });

    if (view === "bubbles") {
      $("bubble-container").style.display = "";
      $("planet-container").style.display = "none";
      renderBubbles();
    } else {
      $("bubble-container").style.display = "none";
      $("planet-container").style.display = "";
      if (!planetView) {
        planetView = createPlanetView();
      }
      planetView.update();
      planetView.resize();
    }
  }

  // ── Fullscreen ──
  function toggleFullscreen() {
    const panel = $("viz-panel");
    isFullscreen = !isFullscreen;

    if (isFullscreen) {
      panel.classList.add("viz-fullscreen");

      // Add close button
      const closeBtn = document.createElement("button");
      closeBtn.className = "fullscreen-close";
      closeBtn.id = "fullscreen-close-btn";
      closeBtn.innerHTML = "&times;";
      closeBtn.addEventListener("click", toggleFullscreen);
      panel.appendChild(closeBtn);

      // Add prob bar
      const probBar = document.createElement("div");
      probBar.className = "fullscreen-prob-bar";
      probBar.id = "fullscreen-prob-bar";
      panel.appendChild(probBar);
      updateFullscreenProbBar();

      document.body.style.overflow = "hidden";
    } else {
      panel.classList.remove("viz-fullscreen");
      const closeBtn = $("fullscreen-close-btn");
      if (closeBtn) closeBtn.remove();
      const probBar = $("fullscreen-prob-bar");
      if (probBar) probBar.remove();
      document.body.style.overflow = "";
    }

    // Re-render at new dimensions
    setTimeout(() => {
      if (activeView === "bubbles") renderBubbles();
      if (planetView) planetView.resize();
    }, 50);
  }

  function updateFullscreenProbBar() {
    const bar = $("fullscreen-prob-bar");
    if (!bar) return;
    const ranked = getRanked();
    bar.innerHTML = ranked.map(d => {
      const pct = (posteriors[d.key] * 100).toFixed(1);
      return `<span class="fullscreen-prob-item">
        <span class="fullscreen-prob-dot" style="background:${d.color}"></span>
        ${d.abbr} <span class="fullscreen-prob-pct">${pct}%</span>
      </span>`;
    }).join("");
  }

  // ── Evidence Sensitivity ──
  function getEvidenceSensitivity() {
    const nextStageIdx = currentStage + 1;
    if (nextStageIdx < 0 || nextStageIdx >= STAGES.length) {
      // No next stage — return uniform sensitivity
      const result = {};
      DIAGNOSES.forEach(d => { result[d.key] = 1; });
      return result;
    }

    const nextStage = STAGES[nextStageIdx];
    let questions = [...nextStage.questions];
    if (nextStage.id === "imaging" && posteriors.pe > 0.15) {
      questions.push(CTA_QUESTION);
    }

    const sensitivity = {};
    DIAGNOSES.forEach(d => {
      let maxLR = -Infinity, minLR = Infinity;
      questions.forEach(q => {
        q.options.forEach(opt => {
          const lr = opt.lrs[d.key];
          if (lr > maxLR) maxLR = lr;
          if (lr < minLR) minLR = lr;
        });
      });
      // Ratio of max to min LR — how much tests could swing this diagnosis
      sensitivity[d.key] = minLR > 0 ? maxLR / minLR : maxLR;
    });

    return sensitivity;
  }

  // ── Bayes Engine ──
  function bayesUpdate(lrs) {
    const prev = { ...posteriors };
    let evidence = 0;
    const updated = {};
    for (const d of DIAGNOSES) {
      updated[d.key] = posteriors[d.key] * lrs[d.key];
      evidence += updated[d.key];
    }
    const deltas = {};
    for (const d of DIAGNOSES) {
      posteriors[d.key] = updated[d.key] / evidence;
      deltas[d.key] = posteriors[d.key] - prev[d.key];
    }
    return deltas;
  }

  function getEntropy() {
    let h = 0;
    for (const d of DIAGNOSES) {
      const p = posteriors[d.key];
      if (p > 0) h -= p * Math.log2(p);
    }
    // Max entropy for 6 diagnoses = log2(6) ≈ 2.585
    const maxH = Math.log2(DIAGNOSES.length);
    return Math.max(0, Math.min(100, Math.round((1 - h / maxH) * 100)));
  }

  function getRanked() {
    return DIAGNOSES.slice().sort((a, b) => posteriors[b.key] - posteriors[a.key]);
  }

  // ── D3 Bubble Chart ──
  function renderBubbles() {
    const svg = d3.select("#bubble-svg");
    svg.selectAll("*").remove();

    const container = $("bubble-container");
    const w = container.clientWidth;
    const h = container.clientHeight || w;

    svg.attr("viewBox", `0 0 ${w} ${h}`);

    // Glow filter
    const defs = svg.append("defs");
    const filter = defs.append("filter").attr("id", "glow");
    filter.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "blur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "blur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Background
    svg.append("rect").attr("width", w).attr("height", h).attr("fill", "#0a0a0f");

    const scaleFactor = Math.min(w, h) * 0.55;

    bubbleNodes = DIAGNOSES.map((d, i) => ({
      key: d.key,
      label: d.abbr,
      fullLabel: d.label,
      color: d.color,
      r: Math.sqrt(posteriors[d.key]) * scaleFactor,
      x: w / 2 + (Math.cos(i * Math.PI * 2 / DIAGNOSES.length) * 60),
      y: h / 2 + (Math.sin(i * Math.PI * 2 / DIAGNOSES.length) * 60),
    }));

    const g = svg.append("g");

    const nodeGroups = g.selectAll("g.diagnosis")
      .data(bubbleNodes, d => d.key)
      .enter()
      .append("g")
      .attr("class", "diagnosis");

    nodeGroups.append("circle")
      .attr("r", d => d.r)
      .attr("fill", d => d.color)
      .attr("fill-opacity", 0.7)
      .attr("stroke", d => d.color)
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.4)
      .attr("filter", "url(#glow)");

    nodeGroups.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.2em")
      .attr("fill", "#fff")
      .attr("font-family", "Inter, sans-serif")
      .attr("font-weight", "700")
      .attr("font-size", d => Math.max(10, d.r * 0.4) + "px")
      .text(d => d.label);

    nodeGroups.append("text")
      .attr("class", "pct-label")
      .attr("text-anchor", "middle")
      .attr("dy", "1em")
      .attr("fill", "#fff")
      .attr("fill-opacity", 0.8)
      .attr("font-family", "JetBrains Mono, monospace")
      .attr("font-size", d => Math.max(8, d.r * 0.3) + "px")
      .text(d => (posteriors[d.key] * 100).toFixed(1) + "%");

    simulation = d3.forceSimulation(bubbleNodes)
      .force("center", d3.forceCenter(w / 2, h / 2))
      .force("charge", d3.forceManyBody().strength(5))
      .force("collide", d3.forceCollide(d => d.r + 4).strength(0.8))
      .force("x", d3.forceX(w / 2).strength(0.05))
      .force("y", d3.forceY(h / 2).strength(0.05))
      .on("tick", () => {
        nodeGroups.attr("transform", d => `translate(${d.x},${d.y})`);
      });
  }

  function updateBubbles() {
    const container = $("bubble-container");
    const w = container.clientWidth;
    const h = container.clientHeight || w;
    const scaleFactor = Math.min(w, h) * 0.55;

    bubbleNodes.forEach(n => {
      n.r = Math.sqrt(posteriors[n.key]) * scaleFactor;
    });

    const svg = d3.select("#bubble-svg");

    svg.selectAll("g.diagnosis circle")
      .data(bubbleNodes, d => d.key)
      .transition()
      .duration(600)
      .attr("r", d => d.r);

    svg.selectAll("g.diagnosis text:not(.pct-label)")
      .data(bubbleNodes, d => d.key)
      .transition()
      .duration(600)
      .attr("font-size", d => Math.max(10, d.r * 0.4) + "px");

    svg.selectAll("g.diagnosis .pct-label")
      .data(bubbleNodes, d => d.key)
      .transition()
      .duration(600)
      .attr("font-size", d => Math.max(8, d.r * 0.3) + "px")
      .tween("text", function(d) {
        const self = this;
        const prev = parseFloat(self.textContent) || 0;
        const next = posteriors[d.key] * 100;
        const interp = d3.interpolateNumber(prev, next);
        return function(t) { self.textContent = interp(t).toFixed(1) + "%"; };
      });

    simulation.force("collide", d3.forceCollide(d => d.r + 4).strength(0.8));
    simulation.alpha(0.6).restart();
  }

  // ── Certainty Meter ──
  function updateCertainty() {
    const val = getEntropy();
    $("certainty-value").textContent = val + "%";
  }

  // ── Bar Chart ──
  function toggleDetails() {
    const chart = $("bar-chart");
    const btn = $("details-toggle");
    if (chart.style.display === "none") {
      chart.style.display = "block";
      btn.classList.add("open");
      btn.textContent = "Hide Details";
      renderBars();
    } else {
      chart.style.display = "none";
      btn.classList.remove("open");
      btn.textContent = "Details";
    }
  }

  function renderBars(deltas) {
    const chart = $("bar-chart");
    if (chart.style.display === "none") return;

    const ranked = getRanked();
    chart.innerHTML = ranked.map((d, i) => {
      const p = posteriors[d.key];
      const pct = (p * 100).toFixed(1);
      const barW = Math.max(1, p * 100 * 2); // scale for visibility
      let deltaHTML = "";
      if (deltas) {
        const delta = deltas[d.key] * 100;
        if (Math.abs(delta) > 0.05) {
          const cls = delta > 0 ? "positive" : "negative";
          const sign = delta > 0 ? "+" : "";
          deltaHTML = `<span class="bar-delta ${cls}">${sign}${delta.toFixed(1)}%</span>`;
        }
      }
      return `
        <div class="bar-row" style="order:${i}">
          <span class="bar-label" style="color:${d.color}">${d.label}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width:${barW}%;background:${d.color}"></div>
          </div>
          <span class="bar-value" style="color:${d.color}">${pct}%</span>
          ${deltaHTML}
        </div>`;
    }).join("");

    // Fade deltas after 2s
    if (deltas) {
      setTimeout(() => {
        chart.querySelectorAll(".bar-delta").forEach(el => el.classList.add("fade"));
      }, 2000);
    }
  }

  // ── Progress Bar ──
  function updateProgress() {
    const steps = document.querySelectorAll(".progress-step");
    steps.forEach((step, i) => {
      step.classList.toggle("active", i === currentStage);
      step.classList.toggle("done", i < currentStage);
    });
    const pct = currentStage >= 0 ? ((currentStage + 1) / STAGES.length) * 100 : 0;
    $("progress-fill").style.width = pct + "%";
  }

  // ── Game Flow ──
  function showIntro() {
    currentStage = -1;
    $("intro-screen").style.display = "block";
    $("stage-content").style.display = "none";
    $("debrief-screen").style.display = "none";
    updateProgress();
  }

  function startGame() {
    $("intro-screen").style.display = "none";
    $("stage-content").style.display = "block";
    currentStage = 0;
    renderStage();
  }

  function renderStage() {
    if (currentStage >= STAGES.length) {
      showDebrief();
      return;
    }

    const stage = STAGES[currentStage];
    stageChoices = {};
    $("stage-title").textContent = stage.title;
    $("stage-description").textContent = stage.description;
    $("narration-box").style.display = "none";
    $("next-btn").style.display = "none";

    // Build questions for this stage, injecting CTA if needed
    let questions = [...stage.questions];
    if (stage.id === "imaging" && posteriors.pe > 0.15) {
      questions.push(CTA_QUESTION);
    }

    const container = $("questions-container");
    container.innerHTML = "";

    questions.forEach(q => {
      const group = document.createElement("div");
      group.className = "question-group";
      group.dataset.qid = q.id;

      const label = document.createElement("div");
      label.className = "question-label";
      label.textContent = q.label;
      group.appendChild(label);

      const grid = document.createElement("div");
      grid.className = "option-grid";

      q.options.forEach(opt => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.textContent = opt.label;
        btn.addEventListener("click", () => handleOption(q, opt, btn, grid, group));
        grid.appendChild(btn);
      });

      group.appendChild(grid);

      if (q.multi) {
        const confirm = document.createElement("button");
        confirm.className = "multi-confirm";
        confirm.textContent = "Confirm selections";
        confirm.style.display = "none";
        confirm.addEventListener("click", () => confirmMulti(q, group));
        group.appendChild(confirm);
      }

      container.appendChild(group);
    });

    updateProgress();
    // Scroll content into view on mobile
    $("stage-content").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleOption(question, option, btn, grid, group) {
    if (question.multi) {
      // Toggle multi-select
      btn.classList.toggle("selected");
      // Show confirm button if any selected
      const confirmBtn = group.querySelector(".multi-confirm");
      const anySelected = grid.querySelector(".option-btn.selected");
      confirmBtn.style.display = anySelected ? "block" : "none";
    } else {
      // Single select — lock and apply immediately
      grid.querySelectorAll(".option-btn").forEach(b => {
        b.classList.remove("selected");
        b.classList.add("locked");
      });
      btn.classList.add("selected");
      btn.classList.remove("locked");

      stageChoices[question.id] = option.label;
      const deltas = bayesUpdate(option.lrs);
      history.push({
        stageName: STAGES[currentStage].title,
        questionId: question.id,
        optionLabel: option.label,
        deltas: { ...deltas },
      });

      updateBubbles();
      updateCertainty();
      renderBars(deltas);
      if (planetView && activeView === "planets") {
        planetView.update();
        planetView.pulse(deltas);
      }
      if (isFullscreen) updateFullscreenProbBar();
      checkStageComplete();
    }
  }

  function confirmMulti(question, group) {
    const grid = group.querySelector(".option-grid");
    const selected = grid.querySelectorAll(".option-btn.selected");

    if (selected.length === 0) return;

    // Lock all buttons
    grid.querySelectorAll(".option-btn").forEach(b => b.classList.add("locked"));
    group.querySelector(".multi-confirm").style.display = "none";

    // Apply each selected option's LRs sequentially
    const labels = [];
    selected.forEach(btn => {
      const optLabel = btn.textContent;
      labels.push(optLabel);
      const opt = question.options.find(o => o.label === optLabel);
      if (opt) {
        const deltas = bayesUpdate(opt.lrs);
        history.push({
          stageName: STAGES[currentStage].title,
          questionId: question.id,
          optionLabel: optLabel,
          deltas: { ...deltas },
        });
        updateBubbles();
        renderBars(deltas);
        if (planetView && activeView === "planets") {
          planetView.update();
          planetView.pulse(deltas);
        }
      }
    });

    stageChoices[question.id] = labels.join(", ");
    updateCertainty();
    if (isFullscreen) updateFullscreenProbBar();
    checkStageComplete();
  }

  function checkStageComplete() {
    const stage = STAGES[currentStage];
    let questions = [...stage.questions];
    if (stage.id === "imaging" && posteriors.pe > 0.15) {
      questions.push(CTA_QUESTION);
    }

    // Check if all non-multi questions are answered and all multi groups are confirmed
    const allAnswered = questions.every(q => {
      if (q.multi) {
        const group = document.querySelector(`[data-qid="${q.id}"]`);
        return group && group.querySelector(".option-btn.locked") !== null;
      }
      return stageChoices[q.id] !== undefined;
    });

    if (allAnswered) {
      // Show narration
      const narrationText = stage.narration(stageChoices);
      if (narrationText) {
        $("narration-box").textContent = narrationText;
        $("narration-box").style.display = "block";
      }
      $("next-btn").style.display = "inline-block";
    }
  }

  function advanceStage() {
    currentStage++;
    if (currentStage >= STAGES.length) {
      showDebrief();
    } else {
      renderStage();
    }
    // Update planet orbits for new stage's evidence sensitivity
    if (planetView && activeView === "planets") planetView.update();
  }

  // ── Debrief ──
  function showDebrief() {
    $("stage-content").style.display = "none";
    $("debrief-screen").style.display = "block";

    const ranked = getRanked();
    const top = ranked[0];
    const topPct = (posteriors[top.key] * 100).toFixed(1);

    $("debrief-summary").innerHTML = `
      <p class="debrief-final">
        <strong>Most likely diagnosis: <span style="color:${top.color}">${top.label}</span> at ${topPct}%</strong><br>
        Diagnostic certainty reached ${getEntropy()}%.
      </p>
      <p class="debrief-final">
        Each clinical finding shifted the probability landscape through Bayesian updating. No single test made the diagnosis — the accumulation of evidence guided you here.
      </p>
    `;

    renderHeatmap();
    updateProgress();
  }

  function renderHeatmap() {
    if (history.length === 0) return;

    const container = $("heatmap-container");
    const diagKeys = DIAGNOSES.map(d => d.key);
    const diagAbbrs = DIAGNOSES.map(d => d.abbr);
    const diagColors = DIAGNOSES.map(d => d.color);

    let html = '<div class="heatmap-title">Evidence Impact Map</div>';
    html += '<table class="heatmap-table"><thead><tr><th>Finding</th>';
    diagAbbrs.forEach((abbr, i) => {
      html += `<th style="color:${diagColors[i]}">${abbr}</th>`;
    });
    html += '</tr></thead><tbody>';

    history.forEach(h => {
      html += `<tr><td>${h.optionLabel}</td>`;
      diagKeys.forEach(key => {
        const delta = h.deltas[key] * 100;
        let bgColor, textColor;
        if (delta > 0.5) {
          const intensity = Math.min(1, delta / 15);
          bgColor = `rgba(74, 222, 128, ${intensity * 0.4})`;
          textColor = "#4ade80";
        } else if (delta < -0.5) {
          const intensity = Math.min(1, Math.abs(delta) / 15);
          bgColor = `rgba(248, 113, 113, ${intensity * 0.4})`;
          textColor = "#f87171";
        } else {
          bgColor = "transparent";
          textColor = "var(--g-text-sec)";
        }
        const sign = delta > 0 ? "+" : "";
        html += `<td><span class="heatmap-cell" style="background:${bgColor};color:${textColor}">${sign}${delta.toFixed(1)}</span></td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // ── 3D Planet View (Three.js) ──
  function createPlanetView() {
    const container = $("planet-container");
    const canvas = $("planet-canvas");
    const isMobile = window.innerWidth < 768;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 3, 8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setClearColor(0x050510);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Bloom post-processing (skip on mobile)
    let composer = null;
    if (!isMobile && typeof THREE.EffectComposer !== "undefined") {
      composer = new THREE.EffectComposer(renderer);
      const renderPass = new THREE.RenderPass(scene, camera);
      composer.addPass(renderPass);
      const bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(container.clientWidth, container.clientHeight),
        0.8, 0.4, 0.85
      );
      composer.addPass(bloomPass);
    }

    // Lights
    const ambientLight = new THREE.AmbientLight(0x333355, 0.6);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0x6366f1, 2, 20);
    pointLight.position.set(0, 0, 0);
    scene.add(pointLight);

    // Star field
    const starGeo = new THREE.BufferGeometry();
    const starCount = 300;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) {
      starPos[i] = (Math.random() - 0.5) * 40;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.05, transparent: true, opacity: 0.6 });
    scene.add(new THREE.Points(starGeo, starMat));

    // Center sphere (gravity well)
    const centerGeo = new THREE.SphereGeometry(0.15, 16, 16);
    const centerMat = new THREE.MeshStandardMaterial({
      color: 0x6366f1, emissive: 0x6366f1, emissiveIntensity: 0.8, transparent: true, opacity: 0.9
    });
    const centerSphere = new THREE.Mesh(centerGeo, centerMat);
    scene.add(centerSphere);

    // Planet data
    const planets = [];
    const planetGroup = new THREE.Group();
    scene.add(planetGroup);

    DIAGNOSES.forEach((d, i) => {
      const angle = (i / DIAGNOSES.length) * Math.PI * 2;
      const color = new THREE.Color(d.color);

      // Planet mesh
      const geo = new THREE.SphereGeometry(1, 24, 24);
      const mat = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.3,
        roughness: 0.6,
        metalness: 0.2,
      });
      const mesh = new THREE.Mesh(geo, mat);
      planetGroup.add(mesh);

      // Orbital ring
      const ringGeo = new THREE.RingGeometry(0.98, 1.02, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: color, transparent: true, opacity: 0.15, side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      planetGroup.add(ring);

      // Canvas label sprite
      const labelCanvas = document.createElement("canvas");
      labelCanvas.width = 128;
      labelCanvas.height = 64;
      const ctx = labelCanvas.getContext("2d");
      const texture = new THREE.CanvasTexture(labelCanvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(1.2, 0.6, 1);
      planetGroup.add(sprite);

      planets.push({
        key: d.key,
        abbr: d.abbr,
        color: d.color,
        threeColor: color,
        mesh, ring, sprite, labelCanvas, texture, mat,
        angle,
        currentOrbit: 3,
        targetOrbit: 3,
        currentSize: 0.3,
        targetSize: 0.3,
        pulseIntensity: 0,
      });
    });

    function updateLabel(planet, pct) {
      const ctx = planet.labelCanvas.getContext("2d");
      ctx.clearRect(0, 0, 128, 64);
      ctx.textAlign = "center";
      ctx.fillStyle = planet.color;
      ctx.font = "bold 22px Inter, sans-serif";
      ctx.fillText(planet.abbr, 64, 26);
      ctx.font = "16px JetBrains Mono, monospace";
      ctx.fillStyle = "#ccccdd";
      ctx.fillText(pct.toFixed(1) + "%", 64, 48);
      planet.texture.needsUpdate = true;
    }

    let animId = null;
    let rotationAngle = 0;

    function update() {
      const sensitivity = getEvidenceSensitivity();
      const maxSens = Math.max(...Object.values(sensitivity), 1);

      planets.forEach(p => {
        const prob = posteriors[p.key];
        // Size: sqrt scaling, range 0.1 to 0.7
        p.targetSize = 0.1 + Math.sqrt(prob) * 0.6;

        // Orbital distance: inverse of normalized sensitivity
        // High sensitivity → close (orbit 1.2), low sensitivity → far (orbit 4.5)
        const normSens = sensitivity[p.key] / maxSens; // 0..1
        p.targetOrbit = 1.2 + (1 - normSens) * 3.3;

        updateLabel(p, prob * 100);
      });
    }

    function pulse(deltas) {
      planets.forEach(p => {
        const delta = Math.abs(deltas[p.key] || 0);
        if (delta > 0.01) {
          p.pulseIntensity = Math.min(1.5, delta * 10);
        }
      });
    }

    function animate() {
      animId = requestAnimationFrame(animate);
      rotationAngle += 0.003;

      planets.forEach(p => {
        // Smooth transitions
        p.currentSize += (p.targetSize - p.currentSize) * 0.05;
        p.currentOrbit += (p.targetOrbit - p.currentOrbit) * 0.05;

        // Position on orbit
        const x = Math.cos(p.angle + rotationAngle) * p.currentOrbit;
        const z = Math.sin(p.angle + rotationAngle) * p.currentOrbit;

        p.mesh.position.set(x, 0, z);
        p.mesh.scale.setScalar(p.currentSize);

        // Orbital ring
        p.ring.scale.set(p.currentOrbit, p.currentOrbit, p.currentOrbit);

        // Label above planet
        p.sprite.position.set(x, p.currentSize + 0.5, z);

        // Pulse effect (emissive decay)
        if (p.pulseIntensity > 0.01) {
          p.mat.emissiveIntensity = 0.3 + p.pulseIntensity;
          p.pulseIntensity *= 0.95; // decay
        } else {
          p.mat.emissiveIntensity = 0.3;
          p.pulseIntensity = 0;
        }
      });

      // Slow camera orbit
      camera.position.x = Math.sin(rotationAngle * 0.3) * 2;
      camera.position.z = 8 + Math.cos(rotationAngle * 0.3) * 1;
      camera.lookAt(0, 0, 0);

      if (composer) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
    }

    function resize() {
      const w = container.clientWidth;
      const h = container.clientHeight || w;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (composer) composer.setSize(w, h);
    }

    function dispose() {
      if (animId) cancelAnimationFrame(animId);
    }

    // Start
    resize();
    update();
    animate();

    return { update, pulse, resize, dispose };
  }

  // ── Boot ──
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
