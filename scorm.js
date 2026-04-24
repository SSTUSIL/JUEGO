/*
  Integracion SCORM 1.2 orientada a pipwerks wrapper.
  Si el LMS no expone API SCORM (modo navegador local), se crea un fallback
  para que el juego pueda probarse sin errores.
*/
(function (window) {
  "use strict";

  function createLocalFallback() {
    var memory = {};
    return {
      version: "1.2",
      handleCompletionStatus: true,
      init: function () {
        return true;
      },
      get: function (key) {
        return memory[key] || "";
      },
      set: function (key, value) {
        memory[key] = String(value);
        return true;
      },
      save: function () {
        return true;
      },
      quit: function () {
        return true;
      },
    };
  }

  if (!window.pipwerks) {
    window.pipwerks = {};
  }

  if (!window.pipwerks.SCORM) {
    window.pipwerks.SCORM = createLocalFallback();
  }

  var ScormService = {
    connected: false,

    init: function () {
      // Llamadas esperadas por SCORM 1.2 con wrapper estilo pipwerks.
      this.connected = !!window.pipwerks.SCORM.init();

      // Marcar intento en progreso desde el inicio.
      window.pipwerks.SCORM.set("cmi.core.lesson_status", "incomplete");
      window.pipwerks.SCORM.set("cmi.core.score.min", "0");
      window.pipwerks.SCORM.set("cmi.core.score.max", "100");
      window.pipwerks.SCORM.save();

      return this.connected;
    },

    saveProgress: function (payload) {
      var data = typeof payload === "string" ? payload : JSON.stringify(payload || {});
      window.pipwerks.SCORM.set("cmi.suspend_data", data);
      window.pipwerks.SCORM.save();
    },

    getLearnerName: function () {
      var fromScorm = window.pipwerks.SCORM.get("cmi.core.student_name");
      return String(fromScorm || "").trim();
    },

    complete: function () {
      // Se marca completado al cerrar el juego con codigo correcto.
      window.pipwerks.SCORM.set("cmi.core.score.raw", "100");
      window.pipwerks.SCORM.set("cmi.core.lesson_status", "completed");
      window.pipwerks.SCORM.save();
    },

    quit: function () {
      // Cierre de sesion SCORM al salir de la pagina.
      window.pipwerks.SCORM.quit();
      this.connected = false;
    },
  };

  window.ScormService = ScormService;
})(window);
