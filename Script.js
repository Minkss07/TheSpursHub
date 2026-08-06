/* ---------- Sidebar menu ---------- */

function toggleMenu() {
    document.getElementById("sidebar").classList.toggle("open");
    document.getElementById("overlay").classList.toggle("open");
}

/* ---------- Fixture countdown ---------- */
/* Only runs if a #countdown element exists on the page */

function startCountdown(matchDateISO) {
    const nextMatch = new Date(matchDateISO);
    const el = document.getElementById("countdown");
    if (!el) return;

    function update() {
        const now = new Date();
        const diff = nextMatch - now;

        if (diff <= 0) {
            el.textContent = "Kick off!";
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);

        el.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }

    update();
    setInterval(update, 1000);
}

/* ---------- Predict the Score ---------- */
/*
   Predictions are stored in the browser's localStorage under
   'spursPredictions' as an array of objects:
   { id, opponent, matchDate, predHome, predAway, actualHome, actualAway }

   actualHome/actualAway stay `null` until you log the real result.
*/

function getPredictions() {
    const raw = localStorage.getItem("spursPredictions");
    return raw ? JSON.parse(raw) : [];
}

function savePredictions(predictions) {
    localStorage.setItem("spursPredictions", JSON.stringify(predictions));
}

function initPredictWidget(opponent, matchDateISO) {
    const formBox = document.getElementById("predict-form");
    const statusBox = document.getElementById("predict-status");
    if (!formBox) return;

    const predictions = getPredictions();
    const existing = predictions.find(p => p.opponent === opponent && p.matchDate === matchDateISO);

    if (existing) {
        formBox.style.display = "none";
        statusBox.textContent = `You predicted Tottenham ${existing.predHome} - ${existing.predAway} ${opponent}. Check back after the match to log the result.`;
    } else {
        formBox.style.display = "flex";
        statusBox.textContent = "";
    }

    document.getElementById("predict-save-btn").onclick = function () {
        const predHome = parseInt(document.getElementById("predHome").value, 10) || 0;
        const predAway = parseInt(document.getElementById("predAway").value, 10) || 0;

        const newPrediction = {
            id: Date.now(),
            opponent: opponent,
            matchDate: matchDateISO,
            predHome: predHome,
            predAway: predAway,
            actualHome: null,
            actualAway: null
        };

        predictions.push(newPrediction);
        savePredictions(predictions);
        initPredictWidget(opponent, matchDateISO); // refresh the widget
        renderPredictionHistory();
    };
}

function outcomeOf(home, away) {
    if (home > away) return "home";
    if (home < away) return "away";
    return "draw";
}

function submitResult(id) {
    const home = parseInt(document.getElementById(`actualHome-${id}`).value, 10);
    const away = parseInt(document.getElementById(`actualAway-${id}`).value, 10);
    if (isNaN(home) || isNaN(away)) return;
    logResult(id, home, away);
}

function logResult(id, actualHome, actualAway) {
    const predictions = getPredictions();
    const entry = predictions.find(p => p.id === id);
    if (!entry) return;
    entry.actualHome = actualHome;
    entry.actualAway = actualAway;
    savePredictions(predictions);
    renderPredictionHistory();
}

function renderPredictionHistory() {
    const list = document.getElementById("prediction-history");
    const summary = document.getElementById("accuracy-summary");
    if (!list) return;

    const predictions = getPredictions().slice().reverse(); // newest first
    list.innerHTML = "";

    let correct = 0;
    let resolved = 0;

    predictions.forEach(p => {
        const row = document.createElement("div");
        row.className = "prediction-entry";

        if (p.actualHome === null) {
            row.innerHTML = `
                <span>vs ${p.opponent}: predicted ${p.predHome}-${p.predAway}</span>
                <span>
                    <input type="number" min="0" style="width:40px" id="actualHome-${p.id}"> -
                    <input type="number" min="0" style="width:40px" id="actualAway-${p.id}">
                    <button onclick="submitResult(${p.id})" style="margin-left:6px;">Log</button>
                </span>
            `;
        } else {
            resolved++;
            const predictedOutcome = outcomeOf(p.predHome, p.predAway);
            const actualOutcome = outcomeOf(p.actualHome, p.actualAway);
            const isCorrect = predictedOutcome === actualOutcome;
            if (isCorrect) correct++;

            row.innerHTML = `
                <span>vs ${p.opponent}: predicted ${p.predHome}-${p.predAway}, actual ${p.actualHome}-${p.actualAway}</span>
                <span class="tag ${isCorrect ? "correct" : "wrong"}">${isCorrect ? "Correct" : "Wrong"}</span>
            `;
        }

        list.appendChild(row);
    });

    if (summary) {
        if (resolved === 0) {
            summary.textContent = "No resolved predictions yet.";
        } else {
            const pct = Math.round((correct / resolved) * 100);
            summary.textContent = `Prediction accuracy: ${correct}/${resolved} correct (${pct}%)`;
        }
    }
}
