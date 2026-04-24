(function() {
  "use strict";

  /* ================================================================
     ESTADO & CONSTANTES
     ================================================================ */
  const state = {
    timerSeconds: 600,
    timerId: null,
    currentScene: 1,
    teamName: "",
    puzzlesCompleted: { ergo: false, mental: false, visual: false, health: false },
    briValue: 0,
    stabilityMs: 0,
    visualLoopStarted: false,
    collectedNotes: [],
    overloadActive: false,
    overloadSpawnerId: null,
    overloadMoveId: null,
    audioPlayed: false,
    startTime: null,
    endTime: null
  };

  // Inicialización Firebase
  const firebaseConfig = {
    apiKey: "AIzaSyChW_w7eNmxHbI2R5TiNE6wnK9iPU44EXk",
    authDomain: "escape-room-usil.firebaseapp.com",
    projectId: "escape-room-usil",
    storageBucket: "escape-room-usil.firebasestorage.app",
    messagingSenderId: "90196405125",
    appId: "1:90196405125:web:eff208742750546370f2ec"
  };
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);


  // Función para enviar a Firebase Firestore
  function enviarDatosASheets() {
    try {
      const durationMs = state.endTime - state.startTime;
      const m = Math.floor(durationMs / 60000);
      const s = Math.floor((durationMs % 60000) / 1000);
      const tiempoTotal = `${m}m ${s}s`;

      firebase.firestore().collection("registros").add({
        nombre:      state.teamName || "Sin nombre",
        dni:         state.teamDni  || "Sin DNI",
        fechaInicio: state.startTime.toLocaleString("es-PE"),
        fechaFin:    state.endTime.toLocaleString("es-PE"),
        tiempoTotal: tiempoTotal,
        fecha:       state.endTime.toLocaleDateString("es-PE"),
        timestamp:   firebase.firestore.FieldValue.serverTimestamp()
      })
      .then(() => console.log("✅ Guardado en Firebase."))
      .catch(err => console.error("❌ Error Firebase:", err));

    } catch(e) {
      console.error(e);
    }
  }

  // Ambient Drone Synthesizer for mysterious music
  let mysteryAudioCtx = null;
  let mysteryOsc = null;
  let mysteryGain = null;

  function playMysteryDrone() {
    try {
      if (!mysteryAudioCtx) {
        mysteryAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (mysteryAudioCtx.state === 'suspended') {
        mysteryAudioCtx.resume();
      }
      if (mysteryOsc) return; 
      
      mysteryOsc = mysteryAudioCtx.createOscillator();
      mysteryGain = mysteryAudioCtx.createGain();
      
      mysteryOsc.type = 'triangle';
      mysteryOsc.frequency.setValueAtTime(65, mysteryAudioCtx.currentTime); 
      
      const lfo = mysteryAudioCtx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.3, mysteryAudioCtx.currentTime);
      const lfoGain = mysteryAudioCtx.createGain();
      lfoGain.gain.setValueAtTime(5, mysteryAudioCtx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(mysteryOsc.frequency);
      lfo.start();

      const filter = mysteryAudioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(250, mysteryAudioCtx.currentTime);

      mysteryOsc.connect(filter);
      filter.connect(mysteryGain);
      mysteryGain.connect(mysteryAudioCtx.destination);
      
      mysteryGain.gain.setValueAtTime(0, mysteryAudioCtx.currentTime);
      mysteryGain.gain.linearRampToValueAtTime(0.15, mysteryAudioCtx.currentTime + 3);
      
      mysteryOsc.start();
    } catch(e) {}
  }

  function stopMysteryDrone() {
    if (mysteryGain && mysteryAudioCtx) {
      mysteryGain.gain.linearRampToValueAtTime(0, mysteryAudioCtx.currentTime + 1);
      setTimeout(() => {
        if (mysteryOsc) {
          try { mysteryOsc.stop(); } catch(e){}
          mysteryOsc.disconnect();
          mysteryOsc = null;
        }
      }, 1000);
    }
  }

  const CONFIG = {
    OVERLOAD_MESSAGES: [
      { app: "Teams",   msg: "¿Tienes el reporte listo?",                     type: "teams",    sfx: "teamsNotif" },
      { app: "Outlook", msg: "Tu solicitud de vacaciones está en revisión",   type: "email",    sfx: "whaMsg" },
      { app: "Puerta",  msg: "🚪 Toc toc... ¿tienes un momento?",              type: "door",     sfx: "door" },
      { app: "Teams",   msg: "Reunión de equipo en 5 minutos",                type: "teams",    isCall: true, sfx: "teamsCall" },
      { app: "Outlook", msg: "Recordatorio: Entrega de informe hoy",          type: "email",    sfx: "whaMsg" },
      { app: "WhatsApp",msg: "Hola, una consulta 😊",                          type: "whatsapp", sfx: "whaNotif" },
      { app: "Outlook", msg: "Acción requerida: Revisión de presupuesto",     type: "email",    sfx: "whaMsg" },
      { app: "Puerta",  msg: "🚪 ¿Carla? Solo quería consultarte algo...",     type: "door",     sfx: "door" },
      { app: "Outlook", msg: "FYI: Cambio en reunión de mañana",              type: "email",    sfx: "whaMsg" },
      { app: "WhatsApp",msg: "Necesito que me ayudes, ¿tienes un momento?",    type: "whatsapp", sfx: "whaMsg" },
      { app: "Llamada", msg: "📹 Solicitud de videollamada — Jefe",           type: "call",     isCall: true, sfx: "teamsCall" }
    ]
  };

  const SFX = {
    intro: new Audio("SONIDOS/AUDIO-INICIO-CONTEXTO-DEL-CASO.mp3"),
    teamsNotif: new Audio("SONIDOS/SONIDO-NOTIFICACIÓN TEAMS.mp3"),
    whaNotif: new Audio("SONIDOS/SONIDO-NOTIFICACIÓN DE WHATSAPP.mp3"),
    whaMsg: new Audio("SONIDOS/SONIDO- MENSAJE DE WHATSAPP.mp3"),
    door: new Audio("SONIDOS/SONIDO- TOQUE DE PUERTA.mp3"),
    teamsCall: new Audio("SONIDOS/SONIDO-LLAMADA TEAMS (2).mp3"),
    click: new Audio("assets/click.mp3") // Fallback check
  };

  const AudioEngine = {
    play: function(sfxName) {
      if (!SFX[sfxName]) return;
      try {
        let clone = SFX[sfxName].cloneNode();
        clone.volume = 0.6;
        clone.play().catch(()=>{});
      } catch(e){}
    }
  };

  function showGameAlert(msg) {
    const toast = document.createElement("div");
    toast.className = "game-toast-alert";
    toast.innerHTML = `⚠️ ${msg}`;
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.add("show"), 10);
    
    // Remove after 3s
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }

  /* ================================================================
     NAVEGACIÓN & HUD
     ================================================================ */
  function goScene(num) {
    // CRITICAL: Stop overload sounds when leaving scene 4
    if (state.currentScene === 4 && num !== 4) {
      stopOverload();
    }

    document.querySelectorAll(".scene").forEach(s => s.classList.remove("active"));
    const target = document.querySelector(`.scene[data-scene='${num}']`);
    if (target) {
      target.classList.add("active");
      state.currentScene = num;
      if (num === 4) startOverload();
      if (num === 6) setupHealthNotes();
      if (num === 7) setupFinal();

      // Play mystery drone in the evidence games, stop in hub/final
      if ([3, 4, 5, 6].includes(num)) {
        playMysteryDrone();
      } else {
        stopMysteryDrone();
      }
    }
  }

  function startTimer() {
    state.timerId = setInterval(() => {
      state.timerSeconds--;
      if (state.timerSeconds <= 0) {
        clearInterval(state.timerId);
        alert("TIEMPO AGOTADO. Carla no pudo ser ayudada.");
        location.reload();
      }
      let m = Math.floor(state.timerSeconds / 60);
      let s = state.timerSeconds % 60;
      document.getElementById("hudTimer").textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
    }, 1000);
  }

  function updateHud() {
    const comp = Object.values(state.puzzlesCompleted).filter(Boolean).length;
    document.getElementById("hudClues").textContent = `🔑 ${comp}/4`;
    const prog = document.getElementById("taskbarProgress");
    if (prog) prog.textContent = `PROGRESO: ${comp}/4`;
    
    const icons = { ergo:"statusVideo", mental:"statusOverload", visual:"statusFatigue", health:"statusHealth" };
    Object.keys(icons).forEach(k => {
      const el = document.getElementById(icons[k]);
      if (el) el.textContent = state.puzzlesCompleted[k] ? "✅" : "⬜";
    });

    if (comp === 4) document.getElementById("hubFinalWrap").classList.remove("hidden");
  }

  /* ================================================================
     ESCENA 1: INTRO
     ================================================================ */
  function setupIntro() {
    const btnPlay = document.getElementById("btnPlayIntro");
    const overlay = document.getElementById("introStartOverlay");
    const panel = document.getElementById("introBlurPanel");
    const bgVideo = document.getElementById("bgVideoIntro");

    btnPlay.addEventListener("click", () => {
      if (!state.audioPlayed) {
        SFX.intro.play().catch(()=>{});
        state.audioPlayed = true;
      }
      bgVideo.play();
      overlay.classList.add("fade-out");
      setTimeout(() => {
        overlay.classList.add("hidden");
        panel.classList.remove("hidden");
        
        // Animación por grupos para no saturar la pantalla
        const sequence = [
          { sel: ".group-1", delay: 500 },
          { sel: ".group-2", delay: 3500 },
          { sel: ".group-3", delay: 5500 },
          { sel: ".group-4", delay: 8500 }
        ];

        sequence.forEach(step => {
          setTimeout(() => {
            document.querySelectorAll(step.sel).forEach(l => l.classList.add("visible"));
            if (step.sel !== ".group-2") AudioEngine.play("teamsNotif");
          }, step.delay);
        });

        setTimeout(() => document.getElementById("nameInputSection").classList.add("visible"), 10500);
      }, 800);
    });

    document.getElementById("btnStart").addEventListener("click", () => {
      const name = document.getElementById("playerName").value.trim();
      const dni = document.getElementById("playerDNI") ? document.getElementById("playerDNI").value.trim() : "";
      if (!name) return alert("Ingresa tu nombre para continuar");
      state.teamName = name;
      state.teamDni = dni;
      state.startTime = new Date(); // Guardar hora de inicio
      
      document.getElementById("mainHud").classList.remove("hidden");
      startTimer();
      goScene(2);
    });

    document.getElementById("btnToggleFullscreen").addEventListener("click", () => {
      if (!document.fullscreenElement) {
        try {
          if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
          else if (document.documentElement.webkitRequestFullscreen) document.documentElement.webkitRequestFullscreen();
          else if (document.documentElement.msRequestFullscreen) document.documentElement.msRequestFullscreen();
          document.getElementById("btnToggleFullscreen").innerHTML = "🗗 VOLVER A PANTALLA NORMAL";
        } catch (err) {}
      } else {
        try {
          if (document.exitFullscreen) document.exitFullscreen();
          else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
          else if (document.msExitFullscreen) document.msExitFullscreen();
          document.getElementById("btnToggleFullscreen").innerHTML = "⛶ CAMBIAR A PANTALLA COMPLETA";
        } catch (err) {}
      }
    });
  }

  /* ================================================================
     ESCENA 2: HUB
     ================================================================ */
  function setupHub() {
    document.querySelectorAll(".desktop-icon").forEach(icon => {
      icon.addEventListener("click", () => goScene(parseInt(icon.dataset.target)));
    });
    document.getElementById("btnToFinal").addEventListener("click", () => goScene(7));
  }

  /* ================================================================
     ESCENA 3: ERGO
     ================================================================ */
  function setupErgo() {
    const playBtn = document.getElementById("btnReproducir");
    const hotspots = document.getElementById("hotspotContainer");
    const found = { espalda: false, silla: false };

    playBtn.addEventListener("click", () => {
      playBtn.classList.add("hidden");
      hotspots.classList.remove("hidden");
    });

    document.querySelectorAll(".ergo-hotspot").forEach(hs => {
      hs.addEventListener("click", () => {
        const id = hs.dataset.id;
        if (!found[id]) {
          found[id] = true;
          hs.classList.add("found");
          // Marca el checkbox correspondiente
          const optId = hs.dataset.opt;
          if (optId) {
            const lbl = document.getElementById(optId);
            if (lbl) {
              lbl.textContent = lbl.textContent.replace("☐", "☑");
              lbl.classList.add("checked");
            }
          }
          if (Object.values(found).every(Boolean)) {
            state.puzzlesCompleted.ergo = true;
            updateHud();
            document.getElementById("goodPosture").style.opacity = 1;
            setTimeout(() => document.getElementById("ergoClueReveal").classList.remove("hidden"), 1000);
          }
        }
      });
    });
    document.getElementById("btnBackHub1").addEventListener("click", () => goScene(2));
  }

  /* ================================================================
     ESCENA 4: MENTAL
     ================================================================ */
  function startOverload() {
    const zone = document.getElementById("overloadZone");
    const det = document.getElementById("detenerBtn");
    zone.innerHTML = "";
    state.overloadActive = true;
    
    // Style adjustments: sin fondo azul
    det.classList.remove("btn-premium");
    det.style.backgroundColor = "rgba(0,0,0,0.5)";
    det.style.border = "3px solid #ff4444";
    det.style.color = "#ff4444";
    det.style.fontWeight = "900";
    det.style.fontSize = "1.2rem";
    det.style.padding = "10px 20px";
    det.style.borderRadius = "8px";
    det.style.cursor = "pointer";
    det.style.backdropFilter = "blur(5px)";
    det.style.textShadow = "none";
    det.style.boxShadow = "none";
    
    // Hide initially and show after 5s
    det.classList.add("hidden");
    setTimeout(() => {
      if(state.overloadActive) {
        det.classList.remove("hidden");
      }
    }, 5000);
    
    const startTime = Date.now();
    let moveSpeed = 650; // Empezamos a 650ms para que sea clickeable
    det.style.transition = "left 0.4s ease, top 0.4s ease";

    function moveDetener() {
      if (!state.overloadActive) return;
      const margin = 80;
      const x = Math.random() * (window.innerWidth - det.offsetWidth - (margin * 2)) + margin;
      const y = Math.random() * (window.innerHeight - det.offsetHeight - (margin * 2)) + margin;
      det.style.left = x + "px";
      det.style.top = y + "px";
      det.style.transform = "none";

      const elapsed = Date.now() - startTime;
      if (elapsed > 5000) {
        // Slow down a bit to make it catchable
        moveSpeed = Math.min(1200, moveSpeed + 100); 
        det.style.transition = `left ${moveSpeed/1000}s ease, top ${moveSpeed/1000}s ease`;
      }
      
      state.overloadMoveId = setTimeout(moveDetener, moveSpeed);
    }
    
    // Inicia el movimiento inmediatamente
    moveDetener();

    function spawn() {
      if (!state.overloadActive || state.currentScene !== 4) return;
      const data = CONFIG.OVERLOAD_MESSAGES[Math.floor(Math.random() * CONFIG.OVERLOAD_MESSAGES.length)];
      const win = document.createElement("div");
      win.className = `overload-window ${data.type}`;
      win.style.left = Math.random() * 70 + "%";
      win.style.top = Math.random() * 60 + "%";
      
      // Estructura realista con botón X
      win.innerHTML = `
        <div class="win-header">
          <span>${data.app}</span>
          <span class="win-close">×</span>
        </div>
        <div class="win-body">${data.msg}</div>
      `;
      
      zone.appendChild(win);
      // Only play sound if we're still on scene 4
      if (state.currentScene === 4 && state.overloadActive) {
        AudioEngine.play(data.sfx);
      }

      const closeBtn = win.querySelector(".win-close");
      if (closeBtn) {
        closeBtn.onclick = (e) => {
          e.stopPropagation();
          win.remove();
        };
      }

      if (data.isCall) {
        document.getElementById("cameraOverlay").classList.add("active");
        setTimeout(() => document.getElementById("cameraOverlay").classList.remove("active"), 2000);
      }
      state.overloadSpawnerId = setTimeout(spawn, Math.random() * 800 + 400);
    }
    spawn();

    // Usamos mousedown y touchstart para que registre instantáneamente
    const resolverMental = (e) => {
      e.preventDefault(); // previene comportamientos raros al clickear rápido
      stopOverload();
      state.puzzlesCompleted.mental = true;
      updateHud();
      document.getElementById("silenceReveal").classList.remove("hidden");
    };
    det.onmousedown = resolverMental;
    det.ontouchstart = resolverMental;
  }

  function stopOverload() {
    state.overloadActive = false;
    clearTimeout(state.overloadSpawnerId);
    clearInterval(state.overloadMoveId);
    state.overloadSpawnerId = null;
    state.overloadMoveId = null;
    const zone = document.getElementById("overloadZone");
    if (zone) zone.innerHTML = "";
    const det = document.getElementById("detenerBtn");
    if (det) {
      det.classList.add("hidden");
      det.style.transition = "";
    }
  }
  document.getElementById("btnBackHub2").addEventListener("click", () => goScene(2));

  /* ================================================================
     ESCENA 5: VISUAL
     ================================================================ */
  function setupVisual() {
    if (state.visualLoopStarted) return;
    state.visualLoopStarted = true;
    setInterval(() => {
      if (state.currentScene !== 5 || state.puzzlesCompleted.visual) return;
      state.briValue = Math.max(0, state.briValue - 1.2);
      // Ampliamos la franja verde (60 a 90) para que sea un ~30% más grande
      const inGreen = state.briValue >= 60 && state.briValue <= 90;
      if (inGreen) state.stabilityMs += 50; else state.stabilityMs = 0;
      
      document.getElementById("briFill").style.width = state.briValue + "%";
      document.getElementById("briNum").textContent = Math.floor(state.briValue) + "%";
      document.getElementById("stabilityTimer").textContent = `${(state.stabilityMs/1000).toFixed(1)}s / 5.0s`;

      const monitor = document.getElementById("excelMonitor");
      if (monitor) {
        const opacity = 0.2 + (state.briValue / 100) * 0.8;
        monitor.style.opacity = opacity.toString();
        monitor.style.filter = `brightness(${0.4 + (state.briValue / 100) * 0.6})`;
      }

      if (state.stabilityMs >= 5000) {
        state.puzzlesCompleted.visual = true;
        updateHud();
        document.getElementById("fatigueClueReveal").classList.remove("hidden");
      }
    }, 50);

    window.addEventListener("keydown", e => {
      if (e.code === "Space" && state.currentScene === 5) {
        e.preventDefault();
        state.briValue = Math.min(100, state.briValue + 6);
      }
    });
    document.getElementById("btnBackHub3").addEventListener("click", () => goScene(2));
  }

  /* ================================================================
     ESCENA 6: TESTIMONIO (REWRITE)
     ================================================================ */
  function setupHealthNotes() {
    const zone = document.getElementById("healthNotesZone");
    const mask = document.getElementById("flashlightMask");
    const phase1 = document.getElementById("healthPhase1");
    const mail = document.getElementById("testimonyMail");
    
    zone.innerHTML = "";
    state.collectedNotes = [];
    phase1.classList.remove("hidden");
    mail.classList.add("hidden");

    window.onmousemove = e => {
      if (state.currentScene === 6) {
        mask.style.setProperty("--mx", e.clientX + "px");
        mask.style.setProperty("--my", e.clientY + "px");
      }
    };

    const notes = [
      { key: "mood", label: "Agobiada", x: 20, y: 30 },
      { key: "posture", label: "hormigueo en las piernas", x: 70, y: 40 },
      { key: "vision", label: "borrosa", x: 45, y: 70 }
    ];

    notes.forEach(n => {
      const el = document.createElement("div");
      el.className = "health-note";
      el.style.left = n.x + "%";
      el.style.top = n.y + "%";
      el.textContent = n.label;
      el.onclick = () => {
        if (!el.classList.contains("collected")) {
          el.classList.add("collected");
          state.collectedNotes.push(n);
          if (state.collectedNotes.length === 3) startEmailPhase();
        }
      };
      zone.appendChild(el);
    });
  }

  function startEmailPhase() {
    const phase1 = document.getElementById("healthPhase1");
    const mail = document.getElementById("testimonyMail");
    const wordBank = document.getElementById("mailWordBank");
    const slots = document.querySelectorAll(".drop-slot");
    const mask = document.getElementById("flashlightMask");

    phase1.classList.add("hidden");
    mail.classList.remove("hidden");
    if (mask) mask.classList.add("hidden");
    wordBank.innerHTML = "";

    slots.forEach(slot => {
      slot.onclick = () => {
        if (slot.dataset.value) {
          const bankBtn = wordBank.querySelector(`button[data-key='${slot.dataset.value}']`);
          if (bankBtn) {
            bankBtn.style.opacity = "1";
            bankBtn.disabled = false;
          }
          slot.textContent = "__________";
          slot.classList.remove("filled");
          delete slot.dataset.value;
        }
      };
    });

    const shuffled = [...state.collectedNotes].sort(() => Math.random() - 0.5);
    shuffled.forEach(note => {
      const btn = document.createElement("button");
      btn.className = "final-word-btn";
      btn.textContent = note.label;
      btn.dataset.key = note.key;
      btn.onclick = () => {
        const nextSlot = Array.from(slots).find(s => s.textContent.includes("___"));
        if (nextSlot) {
          nextSlot.textContent = note.label;
          nextSlot.classList.add("filled");
          nextSlot.dataset.value = note.key;
          btn.style.opacity = "0.3";
          btn.disabled = true;

          const filled = Array.from(slots).filter(s => s.dataset.value);
          if (filled.length === 3) {
            const correct = Array.from(slots).every(s => s.dataset.value === s.dataset.key);
            if (correct) {
              state.puzzlesCompleted.health = true;
              updateHud();
              setTimeout(() => document.getElementById("healthClueReveal").classList.remove("hidden"), 800);
            } else {
              showGameAlert("El testimonio no parece correcto. Inténtalo de nuevo.");
              slots.forEach(s => { s.textContent = "__________"; delete s.dataset.value; });
              wordBank.querySelectorAll("button").forEach(b => { b.style.opacity = "1"; b.disabled = false; });
            }
          }
        }
      };
      wordBank.appendChild(btn);
    });
  }
  document.getElementById("btnBackHub4").addEventListener("click", () => goScene(2));

  /* ================================================================
     ESCENA 7: FINAL
     ================================================================ */
  function setupFinal() {
    const slots = document.querySelectorAll(".word-slot");
    const btns = document.querySelectorAll(".final-word-btn");
    const solution = ["COMUNICAR", "TAMBIÉN", "ES", "PREVENIR"];

    btns.forEach(btn => {
      btn.onclick = () => {
        const word = btn.dataset.word;
        const next = Array.from(slots).find(s => s.textContent === "?");
        if (next) {
          next.textContent = word;
          btn.style.opacity = "0.3";
          btn.disabled = true;
          
          const currentArr = Array.from(slots).map(s => s.textContent);
          if (!currentArr.includes("?")) {
            if (currentArr.join("|") === solution.join("|")) {
              document.getElementById("finalPhase1").classList.add("hidden");
              document.getElementById("finalPhase2").classList.remove("hidden");
              if (state.timerId) clearInterval(state.timerId); // Stop timer on win
              
              // Juego Completado - Guardar datos
              if (!state.endTime) {
                state.endTime = new Date();
                enviarDatosASheets();
              }
              
            } else {
              showGameAlert("El mensaje no es correcto. Inténtalo de nuevo.");
              slots.forEach(s => s.textContent = "?");
              btns.forEach(b => { b.style.opacity = "1"; b.disabled = false; });
            }
          }
        }
      };
    });

    // Sonido tranquilizador sintetizado (tonos suaves)
    function playCalmTone() {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        function playNote(freq, startTime, duration, vol) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, startTime);
          gain.gain.setValueAtTime(0, startTime);
          gain.gain.linearRampToValueAtTime(vol, startTime + 0.3);
          gain.gain.setValueAtTime(vol, startTime + duration - 0.4);
          gain.gain.linearRampToValueAtTime(0, startTime + duration);
          osc.start(startTime);
          osc.stop(startTime + duration);
        }
        // Acorde suave: Do-Mi-Sol (solo primer grupo, sin repetición)
        const t = ctx.currentTime;
        playNote(261.6, t,      3.5, 0.12); // Do
        playNote(329.6, t+0.4, 3.0, 0.10); // Mi
        playNote(392.0, t+0.8, 3.0, 0.08); // Sol
        playNote(523.2, t+1.2, 2.5, 0.07); // Do alta
      } catch(e){}
    }

    // Event listeners for the new final phases
    document.getElementById("btnShowConclusion").onclick = () => {
      document.getElementById("finalPhase2").classList.add("hidden");
      document.getElementById("finalPhase3").classList.remove("hidden");
      playCalmTone();
    };

    document.getElementById("btnGetCert").onclick = () => {
      document.getElementById("finalPhase3").classList.add("hidden");
      document.getElementById("finalPhaseCert").classList.remove("hidden");
      
      const name = state.teamName || "Participante";
      document.getElementById("certNameDisplay").textContent = name;

      // Confetti Animation
      if (window.confetti) {
        var duration = 3000;
        var end = Date.now() + duration;

        (function frame() {
          confetti({
            particleCount: 5, angle: 60, spread: 55, origin: { x: 0 },
            colors: ['#F5C842', '#2563EB', '#ffffff']
          });
          confetti({
            particleCount: 5, angle: 120, spread: 55, origin: { x: 1 },
            colors: ['#F5C842', '#2563EB', '#ffffff']
          });
          if (Date.now() < end) requestAnimationFrame(frame);
        }());
      }
    };

    document.getElementById("btnDownloadActualCert").onclick = () => {
      const btn = document.getElementById("btnDownloadActualCert");
      const originalText = btn.textContent;
      btn.innerHTML = "⏳ GENERANDO...";
      btn.disabled = true;

      // Cargar imagen fresca para evitar taint del canvas
      const freshImg = new Image();
      freshImg.crossOrigin = "anonymous";
      freshImg.src = "CERTIFICADO/DIPLOMA.png?" + Date.now();

      freshImg.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = freshImg.naturalWidth || 1024;
        canvas.height = freshImg.naturalHeight || 720;
        const ctx = canvas.getContext("2d");

        try {
          ctx.drawImage(freshImg, 0, 0, canvas.width, canvas.height);

          // Texto sobre barra dorada (~54% del alto del certificado)
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#0D2257";
          const fontSize = Math.floor(canvas.height * 0.07);
          ctx.font = `900 ${fontSize}px Inter, Arial, sans-serif`;
          const maxWidth = canvas.width * 0.72;
          const yPos = canvas.height * 0.54;
          ctx.fillText(state.teamName || "Participante", canvas.width / 2, yPos, maxWidth);

          const url = canvas.toDataURL("image/png");
          const a = document.createElement("a");
          a.href = url;
          a.download = `Certificado_SSO_Carla_${(state.teamName || "Participante").replace(/\s+/g, '_')}.png`;
          a.click();

          btn.innerHTML = originalText;
          btn.disabled = false;
        } catch (err) {
          // Fallback: descargar versión sin nombre si falla el canvas por restricciones locales
          const aFallback = document.createElement("a");
          aFallback.href = "CERTIFICADO/DIPLOMA.png";
          aFallback.download = `Certificado_SSO_Carla_Base.png`;
          aFallback.click();
          
          showGameAlert("Aviso: Por seguridad local, se descargó el certificado base.");
          btn.innerHTML = originalText;
          btn.disabled = false;
        }
      };

      freshImg.onerror = () => {
        showGameAlert("No se pudo cargar el certificado. Intenta desde la plataforma.");
        btn.innerHTML = originalText;
        btn.disabled = false;
      };
    };
  }

  window.onload = () => {
    setupIntro();
    setupHub();
    setupErgo();
    setupVisual();
    // Pre-initialize these to avoid missing listeners
    setupHealthNotes();
    setupFinal();
    updateHud();
  };

})();