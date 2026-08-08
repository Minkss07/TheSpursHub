/* ---------- Theme toggle (dark / light) ---------- */

function applyStoredTheme() {
    const stored = localStorage.getItem("theme") || "dark";
    document.documentElement.setAttribute("data-theme", stored);
    updateThemeButtonIcon(stored);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    updateThemeButtonIcon(next);
}

function updateThemeButtonIcon(theme) {
    const btn = document.getElementById("theme-toggle-btn");
    if (btn) btn.textContent = theme === "dark" ? "☀" : "🌙";
}

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

function initPredictWidget(opponent, matchDateISO, modelPrediction) {
    const formBox = document.getElementById("predict-form");
    const statusBox = document.getElementById("predict-status");
    if (!formBox) return;

    const opponentLabel = document.getElementById("predict-opponent-name");
    if (opponentLabel) opponentLabel.textContent = opponent;

    const modelScoreEl = document.getElementById("model-score-display");
    const modelNoteEl = document.getElementById("model-score-note");
    if (modelScoreEl) {
        if (modelPrediction && modelPrediction.sampleSize > 0) {
            modelScoreEl.textContent = `${modelPrediction.spursRounded} - ${modelPrediction.oppRounded}`;
            if (modelNoteEl) {
                modelNoteEl.textContent =
                    `xG ${modelPrediction.spursExpected.toFixed(2)} – ${modelPrediction.oppExpected.toFixed(2)} · ` +
                    `${modelPrediction.spursAtHome ? "home" : "away"} · ${modelPrediction.matchesUsed} league matches analysed`;
            }
        } else {
            modelScoreEl.textContent = "—";
            if (modelNoteEl) modelNoteEl.textContent = "Not enough league match data yet";
        }
    }

    renderModelProbabilities(modelPrediction, opponent);

    // Only one pending (unresolved) prediction is allowed at a time —
    // this avoids accidentally saving multiple guesses if a live-data
    // hiccup ever makes the fixture details look slightly different.
    const predictions = getPredictions();
    const pending = predictions.find(p => p.actualHome === null);

    if (pending) {
        formBox.style.display = "none";
        statusBox.innerHTML = `Prediction locked in for <strong>vs ${pending.opponent}</strong>: you said ${pending.predHome}-${pending.predAway}${pending.modelHome !== null && pending.modelHome !== undefined ? `, model said ${pending.modelHome}-${pending.modelAway}` : ""}. Log the real result below once it's played.`;
    } else {
        formBox.style.display = "flex";
        statusBox.textContent = "";
    }

    document.getElementById("predict-save-btn").onclick = function () {
        // Guard again at click time in case of a race condition
        const current = getPredictions();
        if (current.some(p => p.actualHome === null)) {
            initPredictWidget(opponent, matchDateISO, modelPrediction);
            return;
        }

        const predHome = parseInt(document.getElementById("predHome").value, 10) || 0;
        const predAway = parseInt(document.getElementById("predAway").value, 10) || 0;

        const newPrediction = {
            id: Date.now(),
            opponent: opponent,
            matchDate: matchDateISO,
            predHome: predHome,
            predAway: predAway,
            modelHome: modelPrediction ? modelPrediction.spursRounded : null,
            modelAway: modelPrediction ? modelPrediction.oppRounded : null,
            actualHome: null,
            actualAway: null
        };

        current.push(newPrediction);
        savePredictions(current);
        initPredictWidget(opponent, matchDateISO, modelPrediction); // refresh the widget
        renderPredictionHistory();
    };
}

function outcomeOf(home, away) {
    if (home > away) return "home";
    if (home < away) return "away";
    return "draw";
}

/* ---------- Teams & crest badges ---------- */
/* No official crest images are used (licensed club property) —
   these are styled placeholder badges using each club's real colours. */

const TEAMS = {
    tottenham: { name: "Tottenham Hotspur", color: "#132257", initials: "THFC" },
    chelsea:   { name: "Chelsea",           color: "#034694", initials: "CFC" },
    sydney:    { name: "Sydney FC",         color: "#0054a6", initials: "SYD" },
    auckland:  { name: "Auckland FC",       color: "#0b0b0b", initials: "AFC" },
    getafe:    { name: "Getafe CF",         color: "#005999", initials: "GET" }
};

function crestBadge(teamKey, size) {
    size = size || 44;
    const t = TEAMS[teamKey];
    if (!t) return "";
    return `<div class="crest" style="width:${size}px;height:${size}px;background:${t.color};font-size:${size * 0.28}px;">${t.initials}</div>`;
}

function renderFixtureCrests(elementId, teamA, teamB) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.innerHTML = `
        ${crestBadge(teamA, 56)}
        <span class="vs">vs</span>
        ${crestBadge(teamB, 56)}
    `;
}

/* ---------- Recent match data ---------- */
/* Sourced from match reports. Lineup info is included where reliably
   reported; where it wasn't available, a note says so instead of guessing. */

const MATCHES = [
    {
        id: "auckland-2026",
        opponent: "auckland",
        date: "26 July 2026",
        competition: "Pre-season friendly, Eden Park",
        scoreline: "Auckland FC 0 - 2 Tottenham",
        resultTag: "W",
        goals: [
            { teamKey: "tottenham", scorer: "Scarlett", assist: null, minute: "—" },
            { teamKey: "tottenham", scorer: "Richarlison", assist: "Mateus Fernandes → Mathys Tel", minute: "—" }
        ],
        lineupNote: "Full lineup and exact goal minutes weren't clearly reported for this match — happy to add them if you have a source."
    },
    {
        id: "sydney-2026",
        opponent: "sydney",
        date: "29 July 2026",
        competition: "Sydney Super Cup — Tottenham won 4-2 on penalties",
        scoreline: "Tottenham 1 - 1 Sydney FC",
        resultTag: "W",
        goals: [
            { teamKey: "tottenham", scorer: "Mathys Tel", assist: "Free-kick", minute: 29 },
            { teamKey: "sydney", scorer: "Takahiro Sekine", assist: null, minute: 55 }
        ],
        penalties: "Tottenham scored: Williams-Barnett, Tonali, Robertson, Yang Min-Hyeok (missed: Donley). Sydney FC scored: Popovic, Toure (missed: Lacey, Popovic).",
        lineups: {
            tottenham: {
                starting: ["Martin Dúbravka", "Tye Hall", "Malcolm Hardy", "Ben Davies", "Kyerematen", "Archie Gray (c)", "Lucas Bergvall", "Conor Gallagher", "Manor Solomon", "Richarlison", "Mathys Tel"],
                subs: ["Andy Robertson (on 65, for Hall)", "Tingey (on 78, for Hardy)", "Kota Takai (on 46, for Davies)", "Byrne (on 78, for Kyerematen)", "Jamie Donley (on 65, for Gray)", "Sandro Tonali (on 46, for Bergvall)", "Melia (on 65, for Gallagher)", "Yang Min-Hyeok (on 65, for Solomon)", "Scarlett (on 65, for Richarlison)", "Williams-Barnett (on 46, for Tel)"]
            },
            sydney: {
                starting: ["Gus Hoefsloot", "Grant (c)", "A. Popovic", "Courtney-Perkins", "Garcuccio", "Kamijo", "Youlley", "De Jesus", "Quintal", "Sekine", "Macallister"],
                subs: ["Dyer (on 78, for Grant)", "Lancaster (on 74, for Kamijo)", "Alfaro (on 78, for Youlley)", "Toure (on 65, for De Jesus)", "France (on 74, for Quintal)", "Lacey (on 65, for Sekine)", "G. Popovic (on 65, for Macallister)"]
            }
        }
    },
    {
        id: "chelsea-2026",
        opponent: "chelsea",
        date: "1 August 2026",
        competition: "Sydney Super Cup",
        scoreline: "Chelsea 1 - 2 Tottenham",
        resultTag: "W",
        goals: [
            { teamKey: "tottenham", scorer: "Sandro Tonali", assist: "Manor Solomon", minute: 17 },
            { teamKey: "chelsea", scorer: "Estêvão", assist: null, minute: 21 },
            { teamKey: "tottenham", scorer: "Richarlison", assist: "Jamie Donley (shot off the post)", minute: "90+2" }
        ],
        note: "Kevin Danso was sent off 3 minutes into the second half; Tottenham played over 40 minutes with 10 men.",
        lineups: {
            tottenham: {
                starting: ["Antonín Kinsky", "Archie Gray", "Jan Paul van Hecke", "Ben Davies", "Andy Robertson", "Lucas Bergvall", "Sandro Tonali", "Conor Gallagher", "Manor Solomon", "Dominic Solanke", "Mathys Tel"],
                subs: ["Kevin Danso (on 46, for van Hecke)", "Kota Takai (on 81, for Davies)", "Kyerematen (on 72, for Robertson)", "Hall (on 72, for Bergvall)", "Jamie Donley (on 82, for Tonali)", "Hardy (on 54, for Gallagher)", "Moore (on 67, for Solomon)", "Richarlison (on 46, for Solanke)", "Williams-Barnett (on 76, for Tel)"]
            },
            chelsea: {
                starting: ["Teddy Sharman-Lowe", "Marco Palestra", "Wesley Fofana", "Levi Colwill (c)", "Jorrel Hato", "Dario Essugo", "Romeo Lavia", "Estêvão", "Cole Palmer", "Jamie Gittens", "João Pedro"],
                subs: ["Acheampong (on 80, for Palestra)", "Tosin (on 80, for Fofana)", "Sarr (on 80, for Colwill)", "Anselmino (on 62, for Hato)", "Watson (on 80, for Essugo)", "Nicoll-Jazuli (on 46, for Lavia)", "Satpayev (on 69, for Estêvão)", "Walsh (on 80, for Palmer)", "Kellyman (on 80, for Gittens)", "Delap (on 80, for João Pedro)"]
            }
        }
    }
];

function renderRecentResults() {
    const list = document.getElementById("recent-results-list");
    if (!list) return;

    list.innerHTML = "";
    // show most recent first
    MATCHES.slice().reverse().forEach(m => {
        const row = document.createElement("div");
        row.className = "result-row";
        row.onclick = () => openMatchModal(m.id);
        row.innerHTML = `
            ${crestBadge(m.opponent, 36)}
            <span class="opponent-name">vs ${TEAMS[m.opponent].name}</span>
            <span class="score-tag">${m.scoreline.replace("Tottenham", "Spurs").replace(TEAMS[m.opponent].name, "")} ${m.resultTag}</span>
        `;
        list.appendChild(row);
    });
}

function openMatchModal(matchId) {
    const match = MATCHES.find(m => m.id === matchId);
    if (!match) return;

    const content = document.getElementById("modal-content");

    let goalsHtml = match.goals.map(g => `
        <div class="goal-entry">
            <span class="minute">${g.minute}'</span>${g.scorer} (${TEAMS[g.teamKey].name})
            ${g.assist ? `<span class="assist">Assist: ${g.assist}</span>` : ""}
        </div>
    `).join("");

    let lineupsHtml = "";
    if (match.lineups) {
        lineupsHtml += `<p class="lineup-note" style="margin-bottom:6px;">Formation shown is approximate, based on reported lineup order — not a confirmed tactical shape.</p>`;
        Object.keys(match.lineups).forEach(teamKey => {
            const l = match.lineups[teamKey];
            const teamColor = TEAMS[teamKey] ? TEAMS[teamKey].color : "#444a6b";
            lineupsHtml += `
                <div class="pitch-block">
                    <p class="pitch-team-label">${TEAMS[teamKey].name} — Starting XI</p>
                    ${renderPitchSVG(l.starting, teamColor)}
                    <div class="bench-list">
                        <span class="bench-heading">Bench / Substitutions</span>
                        ${l.subs.join("<br>")}
                    </div>
                </div>
            `;
        });
    } else if (match.lineupNote) {
        lineupsHtml = `<p class="lineup-note">${match.lineupNote}</p>`;
    }

    content.innerHTML = `
        <div class="fixture-teams">
            ${crestBadge("tottenham", 60)}
            <span class="vs">${match.scoreline}</span>
            ${crestBadge(match.opponent, 60)}
        </div>
        <p style="text-align:center; color:#666; margin-bottom:10px;">${match.date} — ${match.competition}</p>
        ${match.note ? `<p class="lineup-note" style="text-align:center;">${match.note}</p>` : ""}
        ${match.penalties ? `<p style="font-size:0.9rem; text-align:center; margin:10px 0;"><strong>Penalties:</strong> ${match.penalties}</p>` : ""}
        <h3>Goals</h3>
        ${goalsHtml}
        ${lineupsHtml}
    `;

    document.getElementById("match-modal-overlay").classList.add("open");
}

function closeMatchModal(event) {
    if (event && event.target.id !== "match-modal-overlay" && !event.target.classList.contains("modal-close")) return;
    document.getElementById("match-modal-overlay").classList.remove("open");
}
/* ---------- Squad data ---------- */
/* Sourced from current squad listings (positions, ages, nationalities,
   shirt numbers). Grouped to match the site's section layout. */

const SQUAD = {
    att: [
        { name: "Richarlison", pos: "ST", nation: "Brazil", age: 29, shirt: 9, value: "€24M" },
        { name: "Mathys Tel", pos: "LW", nation: "France", age: 21, shirt: 11, value: "€32.5M" },
        { name: "Dominic Solanke", pos: "ST", nation: "England", age: 28, shirt: 19, value: "€31.6M" },
        { name: "Mohammed Kudus", pos: "RW", nation: "Ghana", age: 26, shirt: 20, value: "€50.1M" },
        { name: "Manor Solomon", pos: "LW", nation: "Israel", age: 27, shirt: 27, value: "€10.1M" },
        { name: "Wilson Odobert", pos: "LW", nation: "France", age: 21, shirt: 28, value: "€21.7M", injury: "Cruciate ligament injury — expected back mid-October 2026" },
        { name: "Dane Scarlett", pos: "ST", nation: "England", age: 22, shirt: 44, value: "€1.4M" },
        { name: "Mikey Moore", pos: "LW", nation: "England", age: 18, shirt: 47, value: "€16.2M" },
        { name: "Min-Hyeok Yang", pos: "LW", nation: "South Korea", age: 20, shirt: 59, value: "€5.5M" }
    ],
    cm: [
        { name: "Xavi Simons", pos: "CAM", nation: "Netherlands", age: 23, shirt: 7, value: "€52.4M", injury: "Cruciate ligament injury — expected back early January 2027" },
        { name: "Conor Gallagher", pos: "CM", nation: "England", age: 26, shirt: 8, value: "€34.7M" },
        { name: "James Maddison", pos: "CAM", nation: "England", age: 29, shirt: 10, value: "€30.2M", height: "175cm", foot: "Right" },
        { name: "Archie Gray", pos: "CDM", nation: "England", age: 20, shirt: 14, value: "€47.1M" },
        { name: "Lucas Bergvall", pos: "CM", nation: "Sweden", age: 20, shirt: 15, value: "€46.2M" },
        { name: "Sandro Tonali", pos: "CM", nation: "Italy", age: 26, shirt: 16, value: "€59.9M" },
        { name: "Mateus Fernandes", pos: "CM", nation: "Portugal", age: 22, shirt: 18, value: "€28.7M" },
        { name: "Dejan Kulusevski", pos: "RW", nation: "Sweden", age: 26, shirt: 21, value: "€40.6M", height: "186cm", foot: "Left", injury: "Knee injury — return date uncertain" },
        { name: "Pape Sarr", pos: "CM", nation: "Senegal", age: 23, shirt: 29, value: "€35.3M" },
        { name: "Rodrigo Bentancur", pos: "CDM", nation: "Uruguay", age: 29, shirt: 30, value: "€17.1M" },
        { name: "Callum Olusesi", pos: "CM", nation: "England", age: 19, value: "€432K" }
    ],
    def: [
        { name: "Andrew Robertson", pos: "LB", nation: "Scotland", age: 32, shirt: 3, value: "€7.8M" },
        { name: "Kevin Danso", pos: "CB", nation: "Austria", age: 27, shirt: 4, value: "€19.3M" },
        { name: "Jan Paul van Hecke", pos: "CB", nation: "Netherlands", age: 26, shirt: 6, value: "€35.8M" },
        { name: "Destiny Udogie", pos: "LB", nation: "Italy", age: 23, shirt: 13, value: "€37.3M" },
        { name: "Cristian Romero", pos: "CB", nation: "Argentina", age: 28, shirt: 17, value: "€46.7M" },
        { name: "Pedro Porro", pos: "RB", nation: "Spain", age: 26, shirt: 23, value: "€40.5M" },
        { name: "Djed Spence", pos: "LB", nation: "England", age: 25, shirt: 24, value: "€31.1M" },
        { name: "Ben Davies", pos: "CB", nation: "Wales", age: 33, shirt: 33, value: "€2M" },
        { name: "Micky van de Ven", pos: "CB", nation: "Netherlands", age: 25, shirt: 37, value: "€59.5M" },
        { name: "Souza", pos: "LB", nation: "Brazil", age: 20, shirt: 38 },
        { name: "Ashley Phillips", pos: "CB", nation: "Wales", age: 21, value: "€9.2M" },
        { name: "Marcos Senesi", pos: "CB", nation: "Argentina", age: 29, value: "€16.9M" },
        { name: "Junai Byfield", pos: "CB", nation: "England", age: 17, shirt: 67 }
    ],
    gk: [
        { name: "Guglielmo Vicario", pos: "GK", nation: "Italy", age: 29, shirt: 1, value: "€21.6M" },
        { name: "Antonín Kinsky", pos: "GK", nation: "Czech Republic", age: 23, shirt: 31, value: "€15.1M" },
        { name: "Martin Dúbravka", pos: "GK", nation: "Slovakia", age: 37, shirt: 39, value: "€769.6K" },
        { name: "Brandon Austin", pos: "GK", nation: "England", age: 27, shirt: 40, value: "€681.4K" }
    ]
};

function posPillClass(pos) {
    if (pos === "GK") return "gk";
    if (["CB", "LB", "RB"].includes(pos)) return "def";
    if (["CM", "CDM", "CAM"].includes(pos)) return "mid";
    return "fwd"; // ST, LW, RW
}

function renderSquadSection(elementId, groupKey) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const players = SQUAD[groupKey];
    el.innerHTML = players.map((p, i) => `
        <div class="player-row" data-name="${p.name.toLowerCase()}" onclick="openPlayerModal('${groupKey}', ${i})">
            <span>${p.name}${p.injury ? ` <span class="lineup-note">— injured</span>` : ""}</span>
            <span class="pos-pill ${posPillClass(p.pos)}">${p.pos}</span>
        </div>
    `).join("");
}

let squadPositionFilter = "all";

function setSquadPositionFilter(pos) {
    squadPositionFilter = pos;
    document.querySelectorAll("#squad-filter-pills .filter-pill").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.filter === pos);
    });
    applySquadFilters();
}

function applySquadFilters() {
    const searchTerm = (document.getElementById("squad-search")?.value || "").toLowerCase().trim();
    const sectionMap = { att: "section-att", cm: "section-cm", def: "section-def", gk: "section-gk" };

    Object.keys(sectionMap).forEach(group => {
        const sectionEl = document.getElementById(sectionMap[group]);
        if (!sectionEl) return;
        const groupMatches = squadPositionFilter === "all" || squadPositionFilter === group;
        let visibleCount = 0;

        sectionEl.querySelectorAll(".player-row").forEach(row => {
            const name = row.dataset.name || "";
            const matchesSearch = !searchTerm || name.includes(searchTerm);
            const visible = groupMatches && matchesSearch;
            row.style.display = visible ? "flex" : "none";
            if (visible) visibleCount++;
        });

        sectionEl.style.display = (groupMatches && (visibleCount > 0 || !searchTerm)) ? "" : "none";
    });
}

/* ---------- Cached season stats for player profiles ---------- */

let seasonStatsCache = null;

async function getSeasonStatsCache() {
    if (seasonStatsCache) return seasonStatsCache;
    seasonStatsCache = await fetchTopScorersLive();
    return seasonStatsCache;
}

function findPlayerSeasonStats(allScorers, playerName) {
    if (!allScorers) return null;
    const lastName = playerName.toLowerCase().split(" ").pop();
    return allScorers.find(s =>
        s.team && s.team.id === SPURS_TEAM_ID &&
        s.player && s.player.name &&
        s.player.name.toLowerCase().includes(lastName)
    ) || null;
}

function openPlayerModal(groupKey, index) {
    const player = SQUAD[groupKey][index];
    if (!player) return;

    const content = document.getElementById("player-modal-content");
    content.innerHTML = `
        <div style="display:flex; align-items:center; gap:16px; margin-bottom:6px;">
            ${crestBadge("tottenham", 56)}
            <div>
                <h2 style="margin:0; font-size:1.3rem;">${player.name}</h2>
                <p class="kickoff-line" style="text-align:left; margin-top:4px;">${player.nation} · Age ${player.age}${player.shirt ? ` · No. ${player.shirt}` : ""}</p>
            </div>
        </div>
        <h3>Position</h3>
        <div class="lineup-entry">${player.pos}</div>
        <h3>Player Details</h3>
        <div class="lineup-entry">
            Nationality: ${player.nation}<br>
            Age: ${player.age}
            ${player.shirt ? `<br>Squad number: ${player.shirt}` : ""}
            ${player.height ? `<br>Height: ${player.height}` : ""}
            ${player.foot ? `<br>Preferred foot: ${player.foot}` : ""}
            ${player.value ? `<br>Estimated market value: ${player.value}` : ""}
        </div>
        ${player.injury ? `<h3>Injury Status</h3><div class="lineup-entry">${player.injury}</div>` : ""}
        <h3>This Season</h3>
        <div class="lineup-entry" id="player-season-stats">Loading live stats…</div>
    `;
    document.getElementById("player-modal-overlay").classList.add("open");

    // Fill in live stats once fetched, without blocking the modal from opening
    getSeasonStatsCache().then(allScorers => {
        const statsEl = document.getElementById("player-season-stats");
        if (!statsEl) return; // modal may have been closed already

        if (allScorers === null) {
            statsEl.textContent = "Live stats unavailable right now.";
            return;
        }

        const stats = findPlayerSeasonStats(allScorers, player.name);
        if (!stats) {
            statsEl.textContent = "No goals recorded yet this season.";
        } else {
            statsEl.innerHTML = `
                Goals: ${stats.goals ?? 0}
                ${stats.assists !== null && stats.assists !== undefined ? `<br>Assists: ${stats.assists}` : ""}
                ${stats.playedMatches !== null && stats.playedMatches !== undefined ? `<br>Appearances: ${stats.playedMatches}` : ""}
            `;
        }
    });
}

function closePlayerModal(event) {
    if (event && event.target.id !== "player-modal-overlay" && !event.target.classList.contains("modal-close")) return;
    document.getElementById("player-modal-overlay").classList.remove("open");
}

/* ---------- Live fixture data (via Cloudflare Worker proxy) ---------- */
/*
   The actual football-data.org API key lives only inside the Cloudflare
   Worker (server-side) — it is never sent to or visible from the browser.
   This site just calls the Worker, which forwards the request and adds
   the CORS permission browsers need to read the response.
*/

const PROXY_BASE = "https://spurs-proxy.maxzanotti00.workers.dev";
const SPURS_TEAM_ID = 73;

async function fetchNextFixtureLive() {
    try {
        const res = await fetch(`${PROXY_BASE}/next-fixture`);
        if (!res.ok) throw new Error(`Proxy responded ${res.status}`);
        const data = await res.json();
        if (!data.matches || data.matches.length === 0) return null;

        const match = data.matches[0];
        const isHome = match.homeTeam.id === SPURS_TEAM_ID;
        const opponentName = isHome ? match.awayTeam.name : match.homeTeam.name;
        const opponentId = isHome ? match.awayTeam.id : match.homeTeam.id;

        return {
            opponentName: opponentName,
            opponentId: opponentId,
            matchId: match.id,
            utcDate: match.utcDate,
            competition: match.competition ? match.competition.name : "Fixture",
            isHome: isHome
        };
    } catch (err) {
        console.warn("Live fixture fetch failed, using fallback data:", err);
        return null;
    }
}

async function fetchRecentResultsLive(count) {
    try {
        const res = await fetch(`${PROXY_BASE}/recent-results`);
        if (!res.ok) throw new Error(`Proxy responded ${res.status}`);
        const data = await res.json();
        if (!data.matches) return [];

        return data.matches.map(match => {
            const isHome = match.homeTeam.id === SPURS_TEAM_ID;
            const opponentName = isHome ? match.awayTeam.name : match.homeTeam.name;
            const spursScore = isHome ? match.score.fullTime.home : match.score.fullTime.away;
            const oppScore = isHome ? match.score.fullTime.away : match.score.fullTime.home;
            let resultTag = "D";
            if (spursScore > oppScore) resultTag = "W";
            if (spursScore < oppScore) resultTag = "L";

            return {
                id: `live-${match.id}`,
                opponentName: opponentName,
                date: new Date(match.utcDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
                competition: match.competition ? match.competition.name : "Match",
                scoreline: `Tottenham ${spursScore} - ${oppScore} ${opponentName}`,
                resultTag: resultTag,
                isLive: true // flags that we don't have goal/lineup detail for this one
            };
        });
    } catch (err) {
        console.warn("Live results fetch failed, using fallback data:", err);
        return [];
    }
}

/* Initialises the homepage fixture + results using live data where
   possible, falling back to the static values already on the page. */
async function initLiveFixtureData(fallbackDateISO, fallbackOpponentKey) {
    const live = await fetchNextFixtureLive();

    if (live) {
        const opponentInitials = live.opponentName.split(" ").map(w => w[0]).join("").slice(0, 4).toUpperCase();
        // Register a lightweight team entry so crestBadge() works for opponents not in TEAMS
        if (!TEAMS[live.opponentName]) {
            TEAMS[live.opponentName] = { name: live.opponentName, color: "#444a6b", initials: opponentInitials };
        }
        startCountdown(live.utcDate);
        renderFixtureCrests("next-fixture-crests", "tottenham", live.opponentName);
        const kickoffLine = document.querySelector(".kickoff-line");
        if (kickoffLine) {
            const d = new Date(live.utcDate);
            kickoffLine.textContent = `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} KO · ${live.competition}`;
        }
        const modelPrediction = await computeModelPrediction(live.opponentId, live.isHome);
        initPredictWidget(live.opponentName, live.utcDate, modelPrediction);
        renderHeadToHead(live.matchId, live.opponentName);
    } else {
        // fallback: use the static Getafe fixture already in the page
        startCountdown(fallbackDateISO);
        renderFixtureCrests("next-fixture-crests", "tottenham", fallbackOpponentKey);
        initPredictWidget("Getafe", fallbackDateISO, null);
    }
    renderPredictionHistory();
}

async function renderRecentResultsLive() {
    const liveMatches = await fetchRecentResultsLive(3);
    const list = document.getElementById("recent-results-list");
    if (!list) return;

    if (liveMatches.length === 0) {
        // fallback: use the static pre-season friendlies already defined
        renderRecentResults();
        return;
    }

    list.innerHTML = "";
    liveMatches.forEach(m => {
        const row = document.createElement("div");
        row.className = "result-row";
        const opponentInitials = m.opponentName.split(" ").map(w => w[0]).join("").slice(0, 4).toUpperCase();
        if (!TEAMS[m.opponentName]) {
            TEAMS[m.opponentName] = { name: m.opponentName, color: "#444a6b", initials: opponentInitials };
        }
        row.innerHTML = `
            ${crestBadge(m.opponentName, 36)}
            <span class="opponent-name">vs ${m.opponentName}</span>
            <span class="score-tag">${m.scoreline.replace("Tottenham", "Spurs")} ${m.resultTag}</span>
        `;
        row.onclick = () => {
            const content = document.getElementById("modal-content");
            content.innerHTML = `
                <div class="fixture-teams">
                    ${crestBadge("tottenham", 60)}
                    <span class="vs">${m.scoreline}</span>
                    ${crestBadge(m.opponentName, 60)}
                </div>
                <p style="text-align:center; color:#666; margin-bottom:10px;">${m.date} — ${m.competition}</p>
                <p class="lineup-note" style="text-align:center;">Live score data — goal and lineup detail not available for this match yet.</p>
            `;
            document.getElementById("match-modal-overlay").classList.add("open");
        };
        list.appendChild(row);
    });
}

/* ---------- League table ---------- */

async function fetchLeagueTableLive() {
    try {
        const res = await fetch(`${PROXY_BASE}/league-table`);
        if (!res.ok) throw new Error(`Proxy responded ${res.status}`);
        const data = await res.json();
        const totalTable = data.standings?.find(s => s.type === "TOTAL");
        return totalTable ? totalTable.table : null;
    } catch (err) {
        console.warn("League table fetch failed:", err);
        return null;
    }
}

async function renderLeagueTable() {
    const container = document.getElementById("league-table-container");
    if (!container) return;

    const table = await fetchLeagueTableLive();
    if (!table) {
        container.innerHTML = `<p class="lineup-note">Live table unavailable right now — check back once the season is underway.</p>`;
        return;
    }

    const rows = table.map(row => `
        <tr class="${row.team.id === SPURS_TEAM_ID ? "spurs-row" : ""}">
            <td>${row.position}</td>
            <td>${row.team.shortName || row.team.name}</td>
            <td>${row.playedGames}</td>
            <td>${row.won}</td>
            <td>${row.draw}</td>
            <td>${row.lost}</td>
            <td>${row.goalDifference}</td>
            <td class="pts-col">${row.points}</td>
        </tr>
    `).join("");

    container.innerHTML = `
        <div class="table-scroll">
            <table class="league-table">
                <thead>
                    <tr>
                        <th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

/* ---------- Full season fixture list ---------- */

async function fetchSeasonFixturesLive() {
    try {
        const res = await fetch(`${PROXY_BASE}/season-fixtures`);
        if (!res.ok) throw new Error(`Proxy responded ${res.status}`);
        const data = await res.json();
        return data.matches || null;
    } catch (err) {
        console.warn("Season fixtures fetch failed:", err);
        return null;
    }
}

async function renderSeasonFixtures() {
    const container = document.getElementById("season-fixtures-container");
    if (!container) return;

    const matches = await fetchSeasonFixturesLive();
    if (!matches) {
        container.innerHTML = `<p class="lineup-note">Live fixture list unavailable right now — check back later.</p>`;
        return;
    }

    const sorted = matches.slice().sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

    container.innerHTML = sorted.map(match => {
        const isHome = match.homeTeam.id === SPURS_TEAM_ID;
        const opponent = isHome ? match.awayTeam.name : match.homeTeam.name;
        const d = new Date(match.utcDate);
        const dateStr = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

        let resultText = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        if (match.status === "FINISHED") {
            const spursScore = isHome ? match.score.fullTime.home : match.score.fullTime.away;
            const oppScore = isHome ? match.score.fullTime.away : match.score.fullTime.home;
            resultText = `${spursScore} - ${oppScore}`;
        }

        return `
            <div class="fixture-row" data-opponent="${opponent.toLowerCase()}" data-status="${match.status === "FINISHED" ? "played" : "upcoming"}">
                <span class="fixture-date">${dateStr}</span>
                <span class="venue-tag">${isHome ? "H" : "A"}</span>
                <span class="fixture-opponent">${opponent}</span>
                <span class="fixture-result">${resultText}</span>
            </div>
        `;
    }).join("");
}

let fixtureStatusFilter = "all";

function setFixtureStatusFilter(status) {
    fixtureStatusFilter = status;
    document.querySelectorAll("#season-filter-pills .filter-pill").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.filter === status);
    });
    applyFixtureFilters();
}

function applyFixtureFilters() {
    const searchTerm = (document.getElementById("fixture-search")?.value || "").toLowerCase().trim();
    document.querySelectorAll("#season-fixtures-container .fixture-row").forEach(row => {
        const opponent = row.dataset.opponent || "";
        const status = row.dataset.status || "";
        const matchesSearch = !searchTerm || opponent.includes(searchTerm);
        const matchesStatus = fixtureStatusFilter === "all" || status === fixtureStatusFilter;
        row.style.display = (matchesSearch && matchesStatus) ? "flex" : "none";
    });
}

/* ---------- Score prediction model ---------- */
/*
   A Dixon-Coles style bivariate Poisson model — the standard approach
   in football analytics literature (Dixon & Coles, 1997).

   How it works, in plain terms:

   1. Pull every completed Premier League match from the current season
      and the one before it (league matches only — friendlies are
      excluded, since they tell you very little).

   2. Weight each match by how recent it is (exponential decay, ~220 day
      half-life), plus a modest extra discount on last season to account
      for summer squad turnover.

   3. Work out league-wide average home and away goals. Then rate every
      team's attack and defence RELATIVE to that average, separately for
      home and away — because teams genuinely play differently at home.

   4. Shrink each team's rating toward the league average in proportion
      to how little data supports it. A team with two matches played
      shouldn't be trusted as much as one with thirty.

   5. Turn the two teams' ratings into expected goals for this specific
      fixture, then use a Poisson distribution to get the probability of
      EVERY scoreline, not just one guess.

   6. Apply the Dixon-Coles correction, which fixes a known weakness of
      plain Poisson: it misprices low scores (0-0, 1-0, 0-1, 1-1).

   The output is a probability distribution, not a certainty. That is
   the honest form of a football prediction — see the accuracy note on
   the About page.
*/

const MODEL_CONFIG = {
    halfLifeDays: 220,          // recency: a match this old counts half as much
    previousSeasonWeight: 0.8,  // extra discount on last season (squad turnover)
    shrinkageMatches: 6,        // how much data before a team's own numbers are trusted
    maxGoals: 8,                // scoreline grid size
    rho: -0.05,                 // Dixon-Coles low-score correction strength
    currentSeason: 2026,
    previousSeason: 2025
};

let leagueModelCache = null;

async function fetchCompetitionMatches(season) {
    try {
        const res = await fetch(`${PROXY_BASE}/competition-matches?season=${season}`);
        if (!res.ok) throw new Error(`Proxy responded ${res.status}`);
        const data = await res.json();
        return (data.matches || []).filter(m =>
            m.status === "FINISHED" &&
            m.score && m.score.fullTime &&
            m.score.fullTime.home !== null &&
            m.score.fullTime.away !== null
        );
    } catch (err) {
        console.warn(`Competition matches fetch failed for season ${season}:`, err);
        return [];
    }
}

function buildLeagueModel(matchGroups) {
    const now = Date.now();
    const teams = {};
    let leagueHomeGoals = 0, leagueAwayGoals = 0, leagueWeight = 0, rawMatchCount = 0;

    function ensureTeam(id, name) {
        if (!teams[id]) {
            teams[id] = {
                id: id, name: name,
                homeFor: 0, homeAgainst: 0, homeWeight: 0,
                awayFor: 0, awayAgainst: 0, awayWeight: 0
            };
        }
        return teams[id];
    }

    matchGroups.forEach(group => {
        group.matches.forEach(m => {
            const hg = m.score.fullTime.home;
            const ag = m.score.fullTime.away;

            const daysAgo = (now - new Date(m.utcDate).getTime()) / 86400000;
            const decay = Math.pow(0.5, Math.max(0, daysAgo) / MODEL_CONFIG.halfLifeDays);
            const w = group.weight * decay;
            if (!(w > 0)) return;

            const home = ensureTeam(m.homeTeam.id, m.homeTeam.shortName || m.homeTeam.name);
            const away = ensureTeam(m.awayTeam.id, m.awayTeam.shortName || m.awayTeam.name);

            home.homeFor += hg * w;
            home.homeAgainst += ag * w;
            home.homeWeight += w;

            away.awayFor += ag * w;
            away.awayAgainst += hg * w;
            away.awayWeight += w;

            leagueHomeGoals += hg * w;
            leagueAwayGoals += ag * w;
            leagueWeight += w;
            rawMatchCount++;
        });
    });

    if (leagueWeight <= 0) return null;

    const leagueHomeAvg = Math.max(0.2, leagueHomeGoals / leagueWeight);
    const leagueAwayAvg = Math.max(0.2, leagueAwayGoals / leagueWeight);
    const k = MODEL_CONFIG.shrinkageMatches;

    Object.keys(teams).forEach(id => {
        const t = teams[id];
        const hw = t.homeWeight, aw = t.awayWeight;

        // Shrink toward 1.0 (league average) when the sample is thin.
        const hShrink = hw / (hw + k);
        const aShrink = aw / (aw + k);

        const rawAttackHome  = hw > 0 ? (t.homeFor / hw) / leagueHomeAvg : 1;
        const rawDefenceHome = hw > 0 ? (t.homeAgainst / hw) / leagueAwayAvg : 1;
        const rawAttackAway  = aw > 0 ? (t.awayFor / aw) / leagueAwayAvg : 1;
        const rawDefenceAway = aw > 0 ? (t.awayAgainst / aw) / leagueHomeAvg : 1;

        t.attackHome  = 1 + (rawAttackHome  - 1) * hShrink;
        t.defenceHome = 1 + (rawDefenceHome - 1) * hShrink;
        t.attackAway  = 1 + (rawAttackAway  - 1) * aShrink;
        t.defenceAway = 1 + (rawDefenceAway - 1) * aShrink;
        t.dataConfidence = (hShrink + aShrink) / 2; // 0 = no data, →1 = well supported
    });

    return {
        leagueHomeAvg: leagueHomeAvg,
        leagueAwayAvg: leagueAwayAvg,
        teams: teams,
        matchesUsed: rawMatchCount
    };
}

async function getLeagueModel() {
    if (leagueModelCache) return leagueModelCache;

    const [currentMatches, previousMatches] = await Promise.all([
        fetchCompetitionMatches(MODEL_CONFIG.currentSeason),
        fetchCompetitionMatches(MODEL_CONFIG.previousSeason)
    ]);

    const model = buildLeagueModel([
        { matches: currentMatches, weight: 1.0 },
        { matches: previousMatches, weight: MODEL_CONFIG.previousSeasonWeight }
    ]);

    leagueModelCache = model;
    return model;
}

/* --- Poisson maths --- */

function poissonPmf(k, lambda) {
    const lam = Math.max(0.05, lambda);
    let logP = -lam + k * Math.log(lam);
    for (let i = 2; i <= k; i++) logP -= Math.log(i);
    return Math.exp(logP);
}

/* Dixon-Coles correction: plain Poisson assumes the two teams' goals are
   independent, which measurably misprices 0-0, 1-0, 0-1 and 1-1. */
function dixonColesTau(x, y, lambda, mu, rho) {
    if (x === 0 && y === 0) return 1 - lambda * mu * rho;
    if (x === 0 && y === 1) return 1 + lambda * rho;
    if (x === 1 && y === 0) return 1 + mu * rho;
    if (x === 1 && y === 1) return 1 - rho;
    return 1;
}

function buildScoreMatrix(lambdaHome, lambdaAway) {
    const N = MODEL_CONFIG.maxGoals;
    const rho = MODEL_CONFIG.rho;
    const matrix = [];
    let total = 0;

    for (let x = 0; x <= N; x++) {
        matrix[x] = [];
        for (let y = 0; y <= N; y++) {
            let p = poissonPmf(x, lambdaHome) *
                    poissonPmf(y, lambdaAway) *
                    dixonColesTau(x, y, lambdaHome, lambdaAway, rho);
            if (!(p > 0)) p = 0;
            matrix[x][y] = p;
            total += p;
        }
    }

    if (total > 0) {
        for (let x = 0; x <= N; x++) {
            for (let y = 0; y <= N; y++) matrix[x][y] /= total;
        }
    }
    return matrix;
}

function renderModelProbabilities(prediction, opponentName) {
    const box = document.getElementById("model-probabilities");
    if (!box) return;

    if (!prediction || !prediction.sampleSize) {
        box.innerHTML = "";
        return;
    }

    const win = Math.round(prediction.pSpursWin * 100);
    const draw = Math.round(prediction.pDraw * 100);
    const loss = Math.round(prediction.pOppWin * 100);

    const alts = prediction.topScorelines.map(s =>
        `${s.spurs}-${s.opponent} (${Math.round(s.probability * 100)}%)`
    ).join("  ·  ");

    box.innerHTML = `
        <div class="prob-bar">
            <div class="prob-seg prob-win" style="width:${win}%" title="Tottenham win"></div>
            <div class="prob-seg prob-draw" style="width:${draw}%" title="Draw"></div>
            <div class="prob-seg prob-loss" style="width:${loss}%" title="${opponentName} win"></div>
        </div>
        <div class="prob-legend">
            <span><i class="prob-key prob-win"></i>Spurs ${win}%</span>
            <span><i class="prob-key prob-draw"></i>Draw ${draw}%</span>
            <span><i class="prob-key prob-loss"></i>${opponentName} ${loss}%</span>
        </div>
        <p class="lineup-note" style="margin-top:10px;">Most likely scorelines: ${alts}</p>
    `;
}

const NEUTRAL_TEAM = {
    attackHome: 1, defenceHome: 1, attackAway: 1, defenceAway: 1, dataConfidence: 0
};

async function computeModelPrediction(opponentTeamId, spursAtHome) {
    const model = await getLeagueModel();
    if (!model) return null;

    const spurs = model.teams[SPURS_TEAM_ID] || NEUTRAL_TEAM;
    const opp = model.teams[opponentTeamId] || NEUTRAL_TEAM;

    // Expected goals for this specific fixture, respecting who is at home.
    let lambdaHome, lambdaAway;
    if (spursAtHome) {
        lambdaHome = model.leagueHomeAvg * spurs.attackHome * opp.defenceAway;
        lambdaAway = model.leagueAwayAvg * opp.attackAway * spurs.defenceHome;
    } else {
        lambdaHome = model.leagueHomeAvg * opp.attackHome * spurs.defenceAway;
        lambdaAway = model.leagueAwayAvg * spurs.attackAway * opp.defenceHome;
    }

    const matrix = buildScoreMatrix(lambdaHome, lambdaAway);
    const N = MODEL_CONFIG.maxGoals;

    let pHomeWin = 0, pDraw = 0, pAwayWin = 0;
    const scorelines = [];

    for (let x = 0; x <= N; x++) {
        for (let y = 0; y <= N; y++) {
            const p = matrix[x][y];
            if (x > y) pHomeWin += p;
            else if (x === y) pDraw += p;
            else pAwayWin += p;
            scorelines.push({ home: x, away: y, p: p });
        }
    }

    scorelines.sort((a, b) => b.p - a.p);
    const best = scorelines[0];

    // Re-express everything from Tottenham's point of view
    const spursExpected = spursAtHome ? lambdaHome : lambdaAway;
    const oppExpected = spursAtHome ? lambdaAway : lambdaHome;
    const spursRounded = spursAtHome ? best.home : best.away;
    const oppRounded = spursAtHome ? best.away : best.home;
    const pSpursWin = spursAtHome ? pHomeWin : pAwayWin;
    const pOppWin = spursAtHome ? pAwayWin : pHomeWin;

    const topScorelines = scorelines.slice(0, 3).map(s => ({
        spurs: spursAtHome ? s.home : s.away,
        opponent: spursAtHome ? s.away : s.home,
        probability: s.p
    }));

    return {
        spursExpected: spursExpected,
        oppExpected: oppExpected,
        spursRounded: spursRounded,
        oppRounded: oppRounded,
        pSpursWin: pSpursWin,
        pDraw: pDraw,
        pOppWin: pOppWin,
        topScorelines: topScorelines,
        spursAtHome: spursAtHome,
        confidence: Math.min(spurs.dataConfidence, opp.dataConfidence),
        matchesUsed: model.matchesUsed,
        sampleSize: model.matchesUsed
    };
}

/* ---------- Player stats (top scorers) ---------- */

async function fetchTopScorersLive() {
    try {
        const res = await fetch(`${PROXY_BASE}/top-scorers`);
        if (!res.ok) throw new Error(`Proxy responded ${res.status}`);
        const data = await res.json();
        return data.scorers || [];
    } catch (err) {
        console.warn("Top scorers fetch failed:", err);
        return null;
    }
}

async function renderPlayerStats() {
    const container = document.getElementById("player-stats-container");
    if (!container) return;

    const allScorers = await fetchTopScorersLive();
    if (allScorers === null) {
        container.innerHTML = `<p class="lineup-note">Live stats unavailable right now — check back later.</p>`;
        return;
    }

    const spursScorers = allScorers.filter(s => s.team && s.team.id === SPURS_TEAM_ID);

    if (spursScorers.length === 0) {
        container.innerHTML = `<p class="lineup-note">No goals logged yet this season — check back once matches have been played.</p>`;
        return;
    }

    container.innerHTML = spursScorers.map(s => `
        <div class="player-row" style="cursor:default;">
            <span>${s.player.name}</span>
            <span class="kickoff-line" style="text-align:right;">
                ${s.goals ?? 0} goals${s.assists !== null && s.assists !== undefined ? ` · ${s.assists} assists` : ""} · ${s.playedMatches ?? "—"} apps
            </span>
        </div>
    `).join("");
}

/* ---------- Head-to-head ---------- */

async function fetchHeadToHeadLive(matchId) {
    try {
        const res = await fetch(`${PROXY_BASE}/head-to-head?matchId=${matchId}`);
        if (!res.ok) throw new Error(`Proxy responded ${res.status}`);
        return await res.json();
    } catch (err) {
        console.warn("Head-to-head fetch failed:", err);
        return null;
    }
}

async function renderHeadToHead(matchId, opponentName) {
    const container = document.getElementById("h2h-container");
    if (!container) return;

    const data = await fetchHeadToHeadLive(matchId);
    if (!data || !data.aggregates) {
        container.innerHTML = `<p class="lineup-note">No head-to-head data available for this fixture yet.</p>`;
        return;
    }

    const agg = data.aggregates;
    const spursIsHomeTeam = agg.homeTeam && agg.homeTeam.id === SPURS_TEAM_ID;
    const spursWins = spursIsHomeTeam ? agg.homeTeam.wins : agg.awayTeam.wins;
    const oppWins = spursIsHomeTeam ? agg.awayTeam.wins : agg.homeTeam.wins;
    const draws = agg.homeTeam ? agg.homeTeam.draws : 0;

    let recentHtml = "";
    if (data.matches && data.matches.length > 0) {
        recentHtml = data.matches.slice(0, 5).map(m => {
            const d = new Date(m.utcDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
            const home = m.homeTeam.shortName || m.homeTeam.name;
            const away = m.awayTeam.shortName || m.awayTeam.name;
            const score = m.score && m.score.fullTime ? `${m.score.fullTime.home ?? "-"} - ${m.score.fullTime.away ?? "-"}` : "—";
            return `
                <div class="fixture-row">
                    <span class="fixture-date">${d}</span>
                    <span class="fixture-opponent">${home} vs ${away}</span>
                    <span class="fixture-result">${score}</span>
                </div>
            `;
        }).join("");
    }

    container.innerHTML = `
        <p class="kickoff-line" style="margin-bottom:14px;">Last ${agg.numberOfMatches ?? 0} meetings vs ${opponentName}</p>
        <div class="stat-grid" style="margin-bottom:16px;">
            <div class="stat-box"><div class="stat-value">${spursWins ?? 0}</div><div class="stat-label">Spurs Wins</div></div>
            <div class="stat-box"><div class="stat-value">${draws ?? 0}</div><div class="stat-label">Draws</div></div>
            <div class="stat-box" style="grid-column: span 2;"><div class="stat-value">${oppWins ?? 0}</div><div class="stat-label">${opponentName} Wins</div></div>
        </div>
        ${recentHtml}
    `;
}

/* ---------- Formation pitch view ---------- */
/*
   Renders a starting XI on a minimalist pitch, laid out using the
   standard reported order (GK, back four, midfield three, front
   three). This is a display approximation based on lineup order,
   not a confirmed tactical shape from a source.
*/

function renderPitchSVG(startingXI, teamColor) {
    if (!startingXI || startingXI.length < 11) return "";

    const gk = [startingXI[0]];
    const def = startingXI.slice(1, 5);
    const mid = startingXI.slice(5, 8);
    const fwd = startingXI.slice(8, 11);

    const rows = [
        { players: fwd, y: 70 },
        { players: mid, y: 175 },
        { players: def, y: 280 },
        { players: gk, y: 365 }
    ];

    let tokens = "";
    rows.forEach(row => {
        const count = row.players.length;
        row.players.forEach((name, i) => {
            const x = (300 / (count + 1)) * (i + 1);
            const shortName = name.split(" ").pop().replace(/[()]/g, "").slice(0, 10);
            tokens += `
                <circle cx="${x}" cy="${row.y}" r="15" fill="${teamColor}" stroke="#f2f4fb" stroke-width="1.5" />
                <text x="${x}" y="${row.y + 26}" class="pitch-player-name">${shortName}</text>
            `;
        });
    });

    return `
        <div class="pitch-svg-wrap">
            <svg viewBox="0 0 300 400" width="100%" style="display:block;">
                <rect x="4" y="4" width="292" height="392" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
                <line x1="4" y1="200" x2="296" y2="200" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
                <circle cx="150" cy="200" r="40" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
                <rect x="70" y="4" width="160" height="55" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
                <rect x="70" y="341" width="160" height="55" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
                ${tokens}
            </svg>
        </div>
    `;
}

/* ---------- Spurs News (live, via GNews) ---------- */
/*
   Fetches the latest Tottenham-related articles every time the page
   loads — so the list is always current without any manual updates.
   Only short publisher-provided snippets are shown, each linking out
   to the original article rather than reproducing it.
*/

function categorizeArticle(text) {
    const lower = text.toLowerCase();
    if (/(transfer|signing|sign|loan move|fee|bid for|move to)/.test(lower)) return { label: "Transfer", cls: "transfer" };
    if (/(injury|injured|ruled out|surgery|setback|fitness)/.test(lower)) return { label: "Injury", cls: "injury" };
    if (/(opinion|analysis|column|verdict|why)/.test(lower)) return { label: "Opinion", cls: "opinion" };
    if (/(criticism|controvers|backlash|fans? react|protest)/.test(lower)) return { label: "Controversy", cls: "controversy" };
    return { label: "News", cls: "opinion" };
}

async function fetchSpursNewsLive(count) {
    try {
        const res = await fetch(`${PROXY_BASE}/spurs-news?max=${count}`);
        if (!res.ok) throw new Error(`Proxy responded ${res.status}`);
        const data = await res.json();
        return data.articles || [];
    } catch (err) {
        console.warn("Spurs news fetch failed:", err);
        return null;
    }
}

async function renderSpursNewsLive(count) {
    const container = document.getElementById("spurs-news-container");
    if (!container) return;

    const articles = await fetchSpursNewsLive(count);
    if (!articles) {
        container.innerHTML = `<p class="lineup-note">Live news unavailable right now — check back later.</p>`;
        return;
    }
    if (articles.length === 0) {
        container.innerHTML = `<p class="lineup-note">No recent articles found.</p>`;
        return;
    }

    container.innerHTML = articles.map(a => {
        const cat = categorizeArticle(`${a.title} ${a.description || ""}`);
        const d = new Date(a.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
        return `
            <div class="news-item">
                <span class="news-tag ${cat.cls}">${cat.label}</span>
                <span class="news-date">${d} · ${a.source && a.source.name ? a.source.name : "Source"}</span>
                <h3>${a.title}</h3>
                ${a.description ? `<p>${a.description}</p>` : ""}
                <a href="${a.url}" target="_blank" rel="noopener">Read more →</a>
            </div>
        `;
    }).join("");
}

/* ---------- Fan League (shared predictions via Cloudflare KV) ---------- */
/*
   Anyone using this page submits a name + prediction that gets stored
   centrally and is visible to everyone else on the leaderboard — this
   is genuinely shared data, unlike the personal predictions elsewhere
   on the site which live only in your own browser.
*/

function getFanLeagueName() {
    return localStorage.getItem("fanLeagueName") || "";
}

function setFanLeagueName(name) {
    localStorage.setItem("fanLeagueName", name);
}

async function submitFanLeaguePrediction(matchId, opponent, matchDate, predHome, predAway) {
    const name = getFanLeagueName();
    if (!name) return { error: "No name set" };

    try {
        const res = await fetch(`${PROXY_BASE}/submit-prediction`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, matchId, opponent, matchDate, predHome, predAway }),
        });
        return await res.json();
    } catch (err) {
        console.warn("Submit prediction failed:", err);
        return { error: "Network error" };
    }
}

async function fetchAllFanPredictions() {
    try {
        const res = await fetch(`${PROXY_BASE}/predictions`);
        if (!res.ok) throw new Error(`Proxy responded ${res.status}`);
        const data = await res.json();
        return data.predictions || [];
    } catch (err) {
        console.warn("Fetch predictions failed:", err);
        return null;
    }
}

async function fetchMatchResult(matchId) {
    try {
        const res = await fetch(`${PROXY_BASE}/match-result?matchId=${matchId}`);
        if (!res.ok) throw new Error(`Proxy responded ${res.status}`);
        return await res.json();
    } catch (err) {
        console.warn("Fetch match result failed:", err);
        return null;
    }
}

async function initFanLeaguePage() {
    const nameGate = document.getElementById("fan-league-name-gate");
    const mainArea = document.getElementById("fan-league-main");
    const savedName = getFanLeagueName();

    if (!savedName) {
        nameGate.style.display = "block";
        mainArea.style.display = "none";
        document.getElementById("fan-league-name-save").onclick = () => {
            const val = document.getElementById("fan-league-name-input").value.trim();
            if (!val) return;
            setFanLeagueName(val);
            initFanLeaguePage();
        };
        return;
    }

    nameGate.style.display = "none";
    mainArea.style.display = "block";
    document.getElementById("fan-league-current-name").textContent = savedName;

    // Load next fixture to build the submission form
    const live = await fetchNextFixtureLive();
    const formEl = document.getElementById("fan-league-predict-form");

    if (live) {
        document.getElementById("fan-league-fixture-label").textContent = `Tottenham vs ${live.opponentName}`;
        formEl.style.display = "flex";
        document.getElementById("fan-league-save-btn").onclick = async () => {
            const h = parseInt(document.getElementById("fan-predHome").value, 10) || 0;
            const a = parseInt(document.getElementById("fan-predAway").value, 10) || 0;
            const statusEl = document.getElementById("fan-league-submit-status");
            statusEl.textContent = "Saving…";
            const result = await submitFanLeaguePrediction(live.matchId, live.opponentName, live.utcDate, h, a);
            statusEl.textContent = result.success ? "Saved! Visible to everyone on the leaderboard." : "Something went wrong — try again.";
            renderFanLeagueLeaderboard();
        };
    } else {
        formEl.style.display = "none";
    }

    renderFanLeagueLeaderboard();
}

async function renderFanLeagueLeaderboard() {
    const container = document.getElementById("fan-league-leaderboard");
    container.innerHTML = `<p class="lineup-note">Loading leaderboard…</p>`;

    const predictions = await fetchAllFanPredictions();
    if (predictions === null) {
        container.innerHTML = `<p class="lineup-note">Leaderboard unavailable right now.</p>`;
        return;
    }
    if (predictions.length === 0) {
        container.innerHTML = `<p class="lineup-note">No predictions submitted yet — be the first!</p>`;
        return;
    }

    // Group by matchId so we only fetch each match's result once
    const matchIds = [...new Set(predictions.map(p => p.matchId))];
    const resultsByMatch = {};
    await Promise.all(matchIds.map(async id => {
        const data = await fetchMatchResult(id);
        resultsByMatch[id] = data && data.score && data.status === "FINISHED" ? data : null;
    }));

    const tally = {}; // name -> { correct, total }

    predictions.forEach(p => {
        if (!tally[p.name]) tally[p.name] = { correct: 0, total: 0 };
        const match = resultsByMatch[p.matchId];
        if (match) {
            tally[p.name].total++;
            const isHome = match.homeTeam.id === SPURS_TEAM_ID;
            const spursScore = isHome ? match.score.fullTime.home : match.score.fullTime.away;
            const oppScore = isHome ? match.score.fullTime.away : match.score.fullTime.home;
            const actualOutcome = outcomeOf(spursScore, oppScore);
            const predOutcome = outcomeOf(p.predHome, p.predAway);
            if (actualOutcome === predOutcome) tally[p.name].correct++;
        }
    });

    const ranked = Object.entries(tally)
        .map(([name, t]) => ({ name, ...t, pct: t.total > 0 ? Math.round((t.correct / t.total) * 100) : null }))
        .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));

    if (ranked.length === 0) {
        container.innerHTML = `<p class="lineup-note">Predictions are in, but no matches have finished yet to score them.</p>`;
        return;
    }

    container.innerHTML = ranked.map((r, i) => `
        <div class="player-row" style="cursor:default;">
            <span>#${i + 1} ${r.name}</span>
            <span class="kickoff-line" style="text-align:right;">${r.pct !== null ? `${r.correct}/${r.total} correct (${r.pct}%)` : "No resolved predictions yet"}</span>
        </div>
    `).join("");
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

    let userCorrect = 0;
    let modelCorrect = 0;
    let resolved = 0;

    predictions.forEach(p => {
        const row = document.createElement("div");
        row.className = "prediction-entry";

        if (p.actualHome === null) {
            row.innerHTML = `
                <span>vs ${p.opponent}: you ${p.predHome}-${p.predAway}${p.modelHome !== null && p.modelHome !== undefined ? `, model ${p.modelHome}-${p.modelAway}` : ""}</span>
                <span>
                    <input type="number" min="0" style="width:40px" id="actualHome-${p.id}"> -
                    <input type="number" min="0" style="width:40px" id="actualAway-${p.id}">
                    <button onclick="submitResult(${p.id})" style="margin-left:6px;">Log</button>
                </span>
            `;
        } else {
            resolved++;
            const actualOutcome = outcomeOf(p.actualHome, p.actualAway);
            const userOutcome = outcomeOf(p.predHome, p.predAway);
            const userIsCorrect = userOutcome === actualOutcome;
            if (userIsCorrect) userCorrect++;

            let modelTagHtml = "";
            if (p.modelHome !== null && p.modelHome !== undefined) {
                const modelOutcome = outcomeOf(p.modelHome, p.modelAway);
                const modelIsCorrect = modelOutcome === actualOutcome;
                if (modelIsCorrect) modelCorrect++;
                modelTagHtml = `<span class="tag ${modelIsCorrect ? "correct" : "wrong"}">Model ${modelIsCorrect ? "✓" : "✗"}</span>`;
            }

            row.innerHTML = `
                <span>vs ${p.opponent}: you ${p.predHome}-${p.predAway}${p.modelHome !== null && p.modelHome !== undefined ? `, model ${p.modelHome}-${p.modelAway}` : ""}, actual ${p.actualHome}-${p.actualAway}</span>
                <span style="display:flex; gap:6px;">
                    <span class="tag ${userIsCorrect ? "correct" : "wrong"}">You ${userIsCorrect ? "✓" : "✗"}</span>
                    ${modelTagHtml}
                </span>
            `;
        }

        list.appendChild(row);
    });

    if (summary) {
        if (resolved === 0) {
            summary.textContent = "No resolved predictions yet.";
        } else {
            const userPct = Math.round((userCorrect / resolved) * 100);
            const modelPct = Math.round((modelCorrect / resolved) * 100);
            summary.textContent = `You: ${userCorrect}/${resolved} correct (${userPct}%)  ·  Model: ${modelCorrect}/${resolved} correct (${modelPct}%)`;
        }
    }
}

applyStoredTheme();
