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
        Object.keys(match.lineups).forEach(teamKey => {
            const l = match.lineups[teamKey];
            lineupsHtml += `
                <h3>${TEAMS[teamKey].name} — Starting XI</h3>
                <div class="lineup-entry">${l.starting.join(", ")}</div>
                <h3>${TEAMS[teamKey].name} — Substitutions</h3>
                <div class="lineup-entry">${l.subs.join(", ")}</div>
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
        <div class="player-row" onclick="openPlayerModal('${groupKey}', ${i})">
            <span>${p.name}${p.injury ? ` <span class="lineup-note">— injured</span>` : ""}</span>
            <span class="pos-pill ${posPillClass(p.pos)}">${p.pos}</span>
        </div>
    `).join("");
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
    `;
    document.getElementById("player-modal-overlay").classList.add("open");
}

function closePlayerModal(event) {
    if (event && event.target.id !== "player-modal-overlay" && !event.target.classList.contains("modal-close")) return;
    document.getElementById("player-modal-overlay").classList.remove("open");
}

/* ---------- Live fixture data (football-data.org) ---------- */
/*
   Free tier: real fixture dates, opponents, and final scores for
   competitions like the Premier League. It does NOT reliably include
   goal-by-goal detail (scorer/assist/minute) or lineups on the free
   plan — those stay manually added for big matches, same as before.

   If the API call fails for any reason (offline, rate limit, CORS),
   everything falls back to the static data already in this file, so
   the site never breaks.
*/

const FOOTBALL_API_TOKEN = "2b8579a1a512447bb01bf95064f44bf5";
const FOOTBALL_API_BASE = "https://api.football-data.org/v4";
const SPURS_TEAM_ID = 73;

async function fetchNextFixtureLive() {
    try {
        const res = await fetch(`${FOOTBALL_API_BASE}/teams/${SPURS_TEAM_ID}/matches?status=SCHEDULED&limit=1`, {
            headers: { "X-Auth-Token": FOOTBALL_API_TOKEN }
        });
        if (!res.ok) throw new Error(`API responded ${res.status}`);
        const data = await res.json();
        if (!data.matches || data.matches.length === 0) return null;

        const match = data.matches[0];
        const isHome = match.homeTeam.id === SPURS_TEAM_ID;
        const opponentName = isHome ? match.awayTeam.name : match.homeTeam.name;

        return {
            opponentName: opponentName,
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
        const res = await fetch(`${FOOTBALL_API_BASE}/teams/${SPURS_TEAM_ID}/matches?status=FINISHED&limit=${count}`, {
            headers: { "X-Auth-Token": FOOTBALL_API_TOKEN }
        });
        if (!res.ok) throw new Error(`API responded ${res.status}`);
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
        document.querySelector("#next-fixture-crests")?.parentElement.querySelector("h2").nextElementSibling;
        startCountdown(live.utcDate);
        renderFixtureCrests("next-fixture-crests", "tottenham", live.opponentName);
        const kickoffLine = document.querySelector(".kickoff-line");
        if (kickoffLine) {
            const d = new Date(live.utcDate);
            kickoffLine.textContent = `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} KO · ${live.competition}`;
        }
        initPredictWidget(live.opponentName, live.utcDate);
    } else {
        // fallback: use the static Getafe fixture already in the page
        startCountdown(fallbackDateISO);
        renderFixtureCrests("next-fixture-crests", "tottenham", fallbackOpponentKey);
        initPredictWidget("Getafe", fallbackDateISO);
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
