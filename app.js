(function () {
  "use strict";

  var STORAGE_KEY = "lottery-state";
  var state = loadState();
  var isDrawing = false;

  // ---------- state persistence ----------

  function defaultState() {
    return { participants: [], prizes: [], history: [] };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var parsed = JSON.parse(raw);
      return {
        participants: parsed.participants || [],
        prizes: parsed.prizes || [],
        history: parsed.history || []
      };
    } catch (e) {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------- tabs ----------

  var tabButtons = document.querySelectorAll(".tab-btn");
  var tabPanels = document.querySelectorAll(".tab-panel");

  tabButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      tabButtons.forEach(function (b) { b.classList.remove("active"); });
      tabPanels.forEach(function (p) { p.classList.remove("active"); });
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    });
  });

  // ---------- participants ----------

  var participantForm = document.getElementById("participant-form");
  var participantNameInput = document.getElementById("participant-name");
  var participantStatus = document.getElementById("participant-status");
  var participantCsvInput = document.getElementById("participant-csv");

  participantForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = participantNameInput.value.trim();
    if (!name) return;
    addParticipant(name);
    participantNameInput.value = "";
    participantNameInput.focus();
    showParticipantStatus("✅ 新增成功", true);
  });

  participantCsvInput.addEventListener("change", function () {
    var file = participantCsvInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      importParticipantsCSV(String(reader.result));
      participantCsvInput.value = "";
    };
    reader.readAsText(file, "UTF-8");
  });

  function showParticipantStatus(message, success) {
    participantStatus.textContent = message;
    participantStatus.classList.toggle("success", success);
    participantStatus.classList.toggle("error", !success);
  }

  function addParticipant(name) {
    state.participants.push({ id: genId(), name: name, status: "active" });
    saveState();
    renderAll();
  }

  function importParticipantsCSV(text) {
    var lines = text.split(/\r?\n/);
    var added = 0;
    lines.forEach(function (line) {
      var trimmed = line.trim();
      if (!trimmed) return;
      var name = trimmed.split(",")[0].trim();
      if (!name) return;
      state.participants.push({ id: genId(), name: name, status: "active" });
      added++;
    });
    if (added > 0) {
      saveState();
      renderAll();
      showParticipantStatus("✅ 匯入成功", true);
    } else {
      showParticipantStatus("❌ 匯入失敗", false);
    }
  }

  // ---------- prizes ----------

  var prizeForm = document.getElementById("prize-form");
  var prizeNameInput = document.getElementById("prize-name");
  var prizeQtyInput = document.getElementById("prize-qty");
  var prizeList = document.getElementById("prize-list");
  var prizeCsvInput = document.getElementById("prize-csv");

  prizeForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = prizeNameInput.value.trim();
    var qty = parseInt(prizeQtyInput.value, 10);
    if (!name || !qty || qty < 1) return;
    addPrize(name, qty);
    prizeNameInput.value = "";
    prizeQtyInput.value = "";
    prizeNameInput.focus();
  });

  prizeCsvInput.addEventListener("change", function () {
    var file = prizeCsvInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      importPrizesCSV(String(reader.result));
      prizeCsvInput.value = "";
    };
    reader.readAsText(file, "UTF-8");
  });

  function addPrize(name, qty) {
    state.prizes.push({ id: genId(), name: name, quantity: qty, remaining: qty });
    saveState();
    renderAll();
  }

  function removePrize(id) {
    state.prizes = state.prizes.filter(function (p) { return p.id !== id; });
    saveState();
    renderAll();
  }

  function importPrizesCSV(text) {
    var lines = text.split(/\r?\n/);
    var added = 0;
    lines.forEach(function (line) {
      var trimmed = line.trim();
      if (!trimmed) return;
      var parts = trimmed.split(",");
      if (parts.length < 2) return;
      var name = parts[0].trim();
      var qty = parseInt(parts[1].trim(), 10);
      if (!name || !qty || qty < 1) return;
      state.prizes.push({ id: genId(), name: name, quantity: qty, remaining: qty });
      added++;
    });
    if (added > 0) {
      saveState();
      renderAll();
    }
  }

  function renderPrizes() {
    prizeList.innerHTML = "";
    state.prizes.forEach(function (p) {
      var li = document.createElement("li");
      var soldOut = p.remaining <= 0;
      if (soldOut) li.classList.add("sold-out");

      var main = document.createElement("span");
      main.className = "row-main";
      main.textContent = p.name + "（剩餘 " + p.remaining + " / " + p.quantity + "）";
      if (soldOut) {
        var tag = document.createElement("span");
        tag.className = "tag sold-out-tag";
        tag.textContent = "已抽完";
        main.appendChild(tag);
      }

      var removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn";
      removeBtn.textContent = "移除";
      removeBtn.addEventListener("click", function () { removePrize(p.id); });

      li.appendChild(main);
      li.appendChild(removeBtn);
      prizeList.appendChild(li);
    });
  }

  // ---------- draw ----------

  var drawPrizeSelect = document.getElementById("draw-prize-select");
  var drawCountInput = document.getElementById("draw-count");
  var drawBtn = document.getElementById("draw-btn");
  var drawMsg = document.getElementById("draw-msg");
  var reelsContainer = document.getElementById("reels-container");

  drawBtn.addEventListener("click", startDraw);
  drawPrizeSelect.addEventListener("change", renderDrawCountOptions);

  function renderPrizeSelect() {
    var prevValue = drawPrizeSelect.value;
    drawPrizeSelect.innerHTML = "";
    state.prizes.forEach(function (p) {
      var opt = document.createElement("option");
      opt.value = p.id;
      var soldOut = p.remaining <= 0;
      opt.textContent = p.name + "（剩餘 " + p.remaining + "）" + (soldOut ? " - 已抽完" : "");
      opt.disabled = soldOut;
      drawPrizeSelect.appendChild(opt);
    });
    if (prevValue) drawPrizeSelect.value = prevValue;
  }

  function renderDrawCountOptions() {
    var prevValue = drawCountInput.value;
    var prize = state.prizes.find(function (p) { return p.id === drawPrizeSelect.value; });
    var activeCount = state.participants.filter(function (p) { return p.status === "active"; }).length;
    var max = prize ? Math.min(prize.remaining, activeCount) : 0;

    drawCountInput.innerHTML = "";
    if (max < 1) {
      var opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "無可抽份數";
      drawCountInput.appendChild(opt);
      drawCountInput.disabled = true;
      return;
    }
    drawCountInput.disabled = false;
    for (var i = 1; i <= max; i++) {
      var o = document.createElement("option");
      o.value = String(i);
      o.textContent = String(i);
      drawCountInput.appendChild(o);
    }
    if (prevValue && Number(prevValue) <= max) drawCountInput.value = prevValue;
  }

  function startDraw() {
    if (isDrawing) return;
    drawMsg.textContent = "";

    var prizeId = drawPrizeSelect.value;
    var prize = state.prizes.find(function (p) { return p.id === prizeId; });
    if (!prize) {
      drawMsg.textContent = "請先新增並選擇獎品";
      return;
    }

    var count = parseInt(drawCountInput.value, 10);
    if (!count || count < 1) {
      drawMsg.textContent = "請輸入要抽的份數";
      return;
    }
    if (count > prize.remaining) {
      drawMsg.textContent = "抽取份數超過該獎品剩餘數量（剩餘 " + prize.remaining + "）";
      return;
    }

    var activeParticipants = state.participants.filter(function (p) { return p.status === "active"; });
    if (count > activeParticipants.length) {
      drawMsg.textContent = "候選人數不足（剩餘可抽 " + activeParticipants.length + " 人）";
      return;
    }

    var winners = pickRandom(activeParticipants, count);
    runSlotAnimation(winners, activeParticipants, function () {
      commitDraw(prize, winners);
    });
  }

  function pickRandom(arr, n) {
    var pool = arr.slice();
    var picked = [];
    for (var i = 0; i < n; i++) {
      var idx = Math.floor(Math.random() * pool.length);
      picked.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return picked;
  }

  function runSlotAnimation(winners, namePool, onDone) {
    isDrawing = true;
    drawBtn.disabled = true;
    reelsContainer.innerHTML = "";

    var names = namePool.map(function (p) { return p.name; });
    if (names.length === 0) names = winners.map(function (w) { return w.name; });

    var reels = winners.map(function () {
      var reel = document.createElement("div");
      reel.className = "reel spinning";
      reel.textContent = "？？？";
      reelsContainer.appendChild(reel);
      return reel;
    });

    var intervals = reels.map(function (reel) {
      return setInterval(function () {
        reel.textContent = names[Math.floor(Math.random() * names.length)];
      }, 70);
    });

    var STAGGER_MS = 800;
    var FIRST_STOP_MS = 1400;

    winners.forEach(function (winner, i) {
      setTimeout(function () {
        clearInterval(intervals[i]);
        var reel = reels[i];
        reel.classList.remove("spinning");
        reel.classList.add("locked");
        reel.textContent = winner.name;

        if (i === winners.length - 1) {
          triggerCelebration();
          setTimeout(function () {
            isDrawing = false;
            drawBtn.disabled = false;
            onDone();
          }, 500);
        }
      }, FIRST_STOP_MS + i * STAGGER_MS);
    });
  }

  // ---------- celebration animation ----------

  var celebrationOverlay = document.getElementById("celebration-overlay");
  var CELEBRATION_COLORS = ["#FBFFB9", "#FDD692", "#EC7357", "#754F44"];

  function triggerCelebration() {
    var styles = [spawnConfetti, spawnFireworks, spawnPoppers];
    var pick = styles[Math.floor(Math.random() * styles.length)];
    pick();
  }

  function spawnConfetti() {
    var count = 90;
    for (var i = 0; i < count; i++) {
      var piece = document.createElement("div");
      piece.className = "confetti-piece";
      var color = CELEBRATION_COLORS[Math.floor(Math.random() * CELEBRATION_COLORS.length)];
      piece.style.left = Math.random() * 100 + "vw";
      piece.style.background = color;
      piece.style.setProperty("--drift", (Math.random() * 200 - 100) + "px");
      piece.style.setProperty("--spin", (Math.random() * 720 - 360) + "deg");
      var duration = 2200 + Math.random() * 1200;
      piece.style.animationDuration = duration + "ms";
      piece.style.animationDelay = (Math.random() * 300) + "ms";
      celebrationOverlay.appendChild(piece);
      setTimeout(function (el) { return function () { el.remove(); }; }(piece), duration + 500);
    }
  }

  function spawnFireworks() {
    var burstCount = 5;
    for (var b = 0; b < burstCount; b++) {
      (function (delay) {
        setTimeout(function () {
          var cx = 15 + Math.random() * 70;
          var cy = 15 + Math.random() * 45;

          var flash = document.createElement("div");
          flash.className = "firework-flash";
          flash.style.left = cx + "vw";
          flash.style.top = cy + "vh";
          celebrationOverlay.appendChild(flash);
          setTimeout(function () { flash.remove(); }, 700);

          var particleCount = 44;
          for (var i = 0; i < particleCount; i++) {
            var particle = document.createElement("div");
            particle.className = "firework-particle";
            var color = CELEBRATION_COLORS[Math.floor(Math.random() * CELEBRATION_COLORS.length)];
            var size = 8 + Math.random() * 6;
            particle.style.width = size + "px";
            particle.style.height = size + "px";
            particle.style.background = color;
            particle.style.boxShadow = "0 0 8px 2px " + color;
            particle.style.left = cx + "vw";
            particle.style.top = cy + "vh";
            var angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.2;
            var distance = 160 + Math.random() * 110;
            var dx = Math.cos(angle) * distance;
            var dy = Math.sin(angle) * distance + 40; // slight gravity drop
            particle.style.setProperty("--dx", dx + "px");
            particle.style.setProperty("--dy", dy + "px");
            var duration = 1400 + Math.random() * 500;
            particle.style.animationDuration = duration + "ms";
            celebrationOverlay.appendChild(particle);
            setTimeout(function (el) { return function () { el.remove(); }; }(particle), duration + 200);
          }
        }, delay);
      })(b * 320);
    }
  }

  function spawnPoppers() {
    var corners = [
      { x: -2, y: 100, dir: 1 },
      { x: 102, y: 100, dir: -1 }
    ];
    corners.forEach(function (corner) {
      var count = 60;
      for (var i = 0; i < count; i++) {
        var streamer = document.createElement("div");
        streamer.className = "popper-streamer";
        var color = CELEBRATION_COLORS[Math.floor(Math.random() * CELEBRATION_COLORS.length)];
        streamer.style.background = color;
        streamer.style.left = corner.x + "vw";
        streamer.style.top = corner.y + "vh";

        var spread = (Math.random() * 55 + 10) * corner.dir; // horizontal launch angle
        var peakX = spread * 0.55 + "vw";
        var peakY = (-1 * (45 + Math.random() * 30)) + "vh";
        var endX = spread + "vw";
        var endY = (Math.random() * 20 + 5) + "vh";

        streamer.style.setProperty("--peakX", peakX);
        streamer.style.setProperty("--peakY", peakY);
        streamer.style.setProperty("--endX", endX);
        streamer.style.setProperty("--endY", endY);
        streamer.style.setProperty("--rot1", (Math.random() * 360) + "deg");
        streamer.style.setProperty("--rot2", (Math.random() * 720 - 360) + "deg");

        var duration = 1600 + Math.random() * 700;
        streamer.style.animationDuration = duration + "ms";
        streamer.style.animationDelay = (Math.random() * 150) + "ms";
        celebrationOverlay.appendChild(streamer);
        setTimeout(function (el) { return function () { el.remove(); }; }(streamer), duration + 400);
      }
    });
  }

  function commitDraw(prize, winners) {
    winners.forEach(function (winner) {
      var participant = state.participants.find(function (p) { return p.id === winner.id; });
      if (participant) participant.status = "won";
    });
    prize.remaining -= winners.length;

    state.history.push({
      id: genId(),
      timestamp: new Date().toLocaleString("zh-TW"),
      prizeId: prize.id,
      prizeName: prize.name,
      winners: winners.map(function (w) { return w.name; })
    });

    saveState();
    renderAll();
  }

  // ---------- history ----------

  var historyBody = document.getElementById("history-body");
  var exportCsvBtn = document.getElementById("export-csv-btn");
  var resetAllBtn = document.getElementById("reset-all-btn");

  exportCsvBtn.addEventListener("click", exportHistoryCSV);
  resetAllBtn.addEventListener("click", function () {
    if (!confirm("確定要清空所有被抽獎人、獎品與歷史紀錄嗎？此動作無法復原。")) return;
    state = defaultState();
    saveState();
    renderAll();
  });

  function renderHistory() {
    historyBody.innerHTML = "";
    state.history.forEach(function (entry) {
      var tr = document.createElement("tr");
      var tdTime = document.createElement("td");
      tdTime.textContent = entry.timestamp;
      var tdPrize = document.createElement("td");
      tdPrize.textContent = entry.prizeName;
      var tdWinners = document.createElement("td");
      tdWinners.textContent = entry.winners.join("、");
      tr.appendChild(tdTime);
      tr.appendChild(tdPrize);
      tr.appendChild(tdWinners);
      historyBody.appendChild(tr);
    });
  }

  function exportHistoryCSV() {
    var rows = [["時間", "獎品", "中獎人"]];
    state.history.forEach(function (entry) {
      entry.winners.forEach(function (name) {
        rows.push([entry.timestamp, entry.prizeName, name]);
      });
    });
    var csv = rows.map(function (row) {
      return row.map(csvEscape).join(",");
    }).join("\r\n");

    var blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "抽獎結果_" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function csvEscape(value) {
    var str = String(value);
    if (/[",\r\n]/.test(str)) {
      str = '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  // ---------- render ----------

  function renderAll() {
    renderPrizes();
    renderPrizeSelect();
    renderDrawCountOptions();
    renderHistory();
  }

  renderAll();
})();
