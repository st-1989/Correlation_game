// Correlation Game app.js
// - Generates a bivariate dataset
// - Plots as scatter using Chart.js
// - Computes Pearson, Spearman, Kendall
// - Checks user's guesses against actual values within tolerance

(() => {
  // Helpers
  function randn() {
    // Box-Muller transform
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  function generateBivariateNormal(n, rho) {
    const xs = [];
    const ys = [];
    const s = Math.sqrt(1 - rho * rho);
    for (let i = 0; i < n; i++) {
      const x = randn();
      const e = randn();
      const y = rho * x + s * e;
      xs.push(x);
      ys.push(y);
    }
    return { xs, ys };
  }

  function mean(a) {
    return a.reduce((s, v) => s + v, 0) / a.length;
  }

  function sd(a) {
    const m = mean(a);
    const v = a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1);
    return Math.sqrt(v);
  }

  function pearsonr(x, y) {
    const n = x.length;
    const mx = mean(x), my = mean(y);
    let cov = 0;
    for (let i = 0; i < n; i++) cov += (x[i] - mx) * (y[i] - my);
    cov /= (n - 1);
    return cov / (sd(x) * sd(y));
  }

  function rankArray(arr) {
    // Return ranks (average ranks for ties)
    const pairs = arr.map((v, i) => ({ v, i }));
    pairs.sort((a, b) => a.v - b.v);
    const ranks = new Array(arr.length);
    let i = 0;
    while (i < pairs.length) {
      let j = i;
      while (j + 1 < pairs.length && pairs[j + 1].v === pairs[i].v) j++;
      const avgRank = (i + j + 2) / 2; // ranks are 1-based
      for (let k = i; k <= j; k++) ranks[pairs[k].i] = avgRank;
      i = j + 1;
    }
    return ranks;
  }

  function spearmanr(x, y) {
    const rx = rankArray(x);
    const ry = rankArray(y);
    return pearsonr(rx, ry);
  }

  function kendallTau(x, y) {
    const n = x.length;
    let concordant = 0;
    let discordant = 0;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = x[i] - x[j];
        const dy = y[i] - y[j];
        const prod = dx * dy;
        if (prod > 0) concordant++;
        else if (prod < 0) discordant++;
        // ties (prod == 0) are ignored in numerator in this simple implementation
      }
    }
    const denom = (n * (n - 1)) / 2;
    return (concordant - discordant) / denom;
  }

  // Format helpers
  function fmt(v) {
    if (!isFinite(v)) return "NaN";
    return (Math.round(v * 1000) / 1000).toFixed(3);
  }

  // DOM elements
  const sampleSizeInput = document.getElementById("sampleSize");
  const targetRInput = document.getElementById("targetR");
  const toleranceInput = document.getElementById("tolerance");
  const newPlotBtn = document.getElementById("newPlotBtn");

  const pearsonInput = document.getElementById("pearsonInput");
  const spearmanInput = document.getElementById("spearmanInput");
  const kendallInput = document.getElementById("kendallInput");
  const guessForm = document.getElementById("guessForm");
  const resultDiv = document.getElementById("result");

  let chart = null;
  let current = {
    xs: [],
    ys: [],
    pearson: 0,
    spearman: 0,
    kendall: 0
  };

  function plotScatter(xs, ys) {
    const ctx = document.getElementById("scatterChart").getContext("2d");
    const points = xs.map((x, i) => ({ x, y: ys[i] }));
    if (chart) {
      chart.data.datasets[0].data = points;
      chart.update();
      return;
    }
    chart = new Chart(ctx, {
      type: "scatter",
      data: {
        datasets: [{
          label: "Data points",
          data: points,
          backgroundColor: "rgba(125,211,252,0.9)"
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { title: { display: true, text: "x" } },
          y: { title: { display: true, text: "y" } }
        }
      }
    });
  }

  function generateAndPlot() {
    const n = Math.max(10, Math.min(1000, parseInt(sampleSizeInput.value || "50", 10)));
    // Choose a true Pearson target plus a small random jitter so players can't memorize
    const target = Math.max(-0.95, Math.min(0.95, parseFloat(targetRInput.value || "0.5")));
    const jitter = (Math.random() - 0.5) * 0.18; // +/- 0.09
    const rho = Math.max(-0.98, Math.min(0.98, target + jitter));

    const { xs, ys } = generateBivariateNormal(n, rho);
    current.xs = xs;
    current.ys = ys;
    current.pearson = pearsonr(xs, ys);
    current.spearman = spearmanr(xs, ys);
    current.kendall = kendallTau(xs, ys);

    plotScatter(xs, ys);

    // Clear inputs and result
    pearsonInput.value = "";
    spearmanInput.value = "";
    kendallInput.value = "";
    resultDiv.innerHTML = `<p>New plot generated (n=${n}). Enter your estimates.</p>`;
  }

  function checkGuesses(e) {
    e.preventDefault();
    const tol = Math.abs(parseFloat(toleranceInput.value) || 0.1);
    const gPearson = parseFloat(pearsonInput.value);
    const gSpearman = parseFloat(spearmanInput.value);
    const gKendall = parseFloat(kendallInput.value);

    if (isNaN(gPearson) || isNaN(gSpearman) || isNaN(gKendall)) {
      resultDiv.innerHTML = `<p class="feedback-fail">Please fill all three guesses with numeric values.</p>`;
      return;
    }

    const aPearson = current.pearson;
    const aSpearman = current.spearman;
    const aKendall = current.kendall;

    const pDiff = Math.abs(gPearson - aPearson);
    const sDiff = Math.abs(gSpearman - aSpearman);
    const kDiff = Math.abs(gKendall - aKendall);

    const pPass = pDiff <= tol;
    const sPass = sDiff <= tol;
    const kPass = kDiff <= tol;

    const allPass = pPass && sPass && kPass;

    resultDiv.innerHTML = `
      <div>
        <p>Actual values: Pearson r = <strong>${fmt(aPearson)}</strong>, Spearman ρ = <strong>${fmt(aSpearman)}</strong>, Kendall τ = <strong>${fmt(aKendall)}</strong>.</p>
        <ul>
          <li>Pearson guess: ${fmt(gPearson)} (diff ${fmt(pDiff)}) — ${pPass ? '<span class="feedback-pass">OK</span>' : '<span class="feedback-fail">Wrong</span>'}</li>
          <li>Spearman guess: ${fmt(gSpearman)} (diff ${fmt(sDiff)}) — ${sPass ? '<span class="feedback-pass">OK</span>' : '<span class="feedback-fail">Wrong</span>'}</li>
          <li>Kendall guess: ${fmt(gKendall)} (diff ${fmt(kDiff)}) — ${kPass ? '<span class="feedback-pass">OK</span>' : '<span class="feedback-fail">Wrong</span>'}</li>
        </ul>
        <p style="font-weight:700; color:${allPass ? '#7dd3fc' : '#ef4444'}">${allPass ? 'You win! 🎉 All estimates are within tolerance.' : 'Not yet — try another estimate or generate a new plot.'}</p>
      </div>
    `;
  }

  // Wire events
  newPlotBtn.addEventListener("click", generateAndPlot);
  guessForm.addEventListener("submit", checkGuesses);

  // Init first plot
  generateAndPlot();

  // Expose functions in console for testing
  window._correlationGame = {
    pearsonr, spearmanr, kendallTau, generateBivariateNormal
  };
})();