import re

with open('app.js', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Find the ergo section boundaries
start_marker = '  /* ===== PANTALLA 3: ERGO'
end_marker = '  /* ===== PANTALLA 4: SALUD MENTAL'

i1 = content.find(start_marker)
i2 = content.find(end_marker)

if i1 == -1 or i2 == -1:
    print(f'Markers not found: i1={i1}, i2={i2}')
    exit(1)

new_ergo = '''  /* ===== PANTALLA 3: ERGONOMIA ===== */
  function setupErgo() {
    var playBtn  = document.getElementById("btnReproducir");
    var quiz     = document.getElementById("ergoQuiz");
    var hotspotContainer = document.getElementById("hotspotContainer");
    var badG     = document.getElementById("badPosture");
    var goodG    = document.getElementById("goodPosture");
    var checkBtn = document.getElementById("btnCheckErgo");
    var feedback = document.getElementById("ergoFeedback");
    var clueReveal = document.getElementById("ergoClueReveal");
    var btnBack = document.getElementById("btnBackHub1");
    var hintText = document.getElementById("ergoHintText");
    var hotspotStatus = document.getElementById("hotspotStatus");

    var hotspotsFound = { espalda: false, silla: false, monitor: false };

    if (playBtn) {
      playBtn.addEventListener("click", function () {
        playBtn.style.display = "none";
        if (hotspotContainer) hotspotContainer.classList.remove("hidden");
        if (quiz) {
          quiz.classList.remove("hidden");
          quiz.style.display = "block";
        }
        if (badG) badG.style.opacity = "1";
        if (goodG) goodG.style.opacity = "0";
        AudioEngine.playClick();
      });
    }

    var hotspots = document.querySelectorAll(".hotspot");
    hotspots.forEach(function(hs) {
      hs.addEventListener("click", function() {
        var id = hs.dataset.id;
        if (id && !hotspotsFound[id]) {
          hotspotsFound[id] = true;
          hs.style.backgroundColor = "rgba(46, 204, 113, 0.4)";
          hs.style.border = "2px solid #2ecc71";
          AudioEngine.playClick();

          // Show status chips only after first click
          if (hotspotStatus) hotspotStatus.style.opacity = "1";

          var statusEl = document.getElementById("hs-" + id);
          if (statusEl) {
            statusEl.textContent = statusEl.textContent.replace("\u2b1c", "\u2705");
            statusEl.style.background = "rgba(46, 204, 113, 0.4)";
          }

          if (hotspotsFound.espalda && hotspotsFound.silla && hotspotsFound.monitor) {
            if (checkBtn) { checkBtn.click(); }
          }
        }
      });
    });

    if (checkBtn) {
      checkBtn.addEventListener("click", function () {
        if (hotspotsFound.espalda && hotspotsFound.silla && hotspotsFound.monitor) {
          feedback.className = "scene-feedback ok";
          feedback.textContent = "\u2705 \u00a1Postura corregida!";
          if (hintText) hintText.style.display = "none";
          if (badG) badG.style.opacity = "0";
          if (goodG) goodG.style.opacity = "1";
          if (hotspotContainer) hotspotContainer.style.display = "none";
          AudioEngine.playSuccess();
          state.puzzlesCompleted.ergo = true;
          updateHud();
          setTimeout(function () {
            if (clueReveal) clueReveal.classList.remove("hidden");
            if (btnBack) btnBack.disabled = false;
            toast("\ud83d\udd11 Pista 1: PARA", "clue", 4000);
          }, 1500);
          checkBtn.style.display = "none";
        } else {
          feedback.className = "scene-feedback error pulse";
          feedback.textContent = "\u26a0\ufe0f A\u00fan faltan errores por corregir.";
          AudioEngine.playError();
        }
      });
    }

    if (btnBack) {
      btnBack.addEventListener("click", function () {
        if (!btnBack.disabled) { goScene(2); }
      });
    }
  }

'''

content = content[:i1] + new_ergo + content[i2:]

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Ergo section replaced OK')
print('Length:', len(content))
