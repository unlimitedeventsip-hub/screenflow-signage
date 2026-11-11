(function () {
  'use strict';

  // Local assets must be external files: Tizen CSP disallows inline script/style.
  var remote = 'https://screenflow-signagead.unlimited-events-ip.workers.dev/connect?sf_tizen=1';
  var status = document.getElementById('status');
  var retry = document.getElementById('retry');
  var launchTimer = null;

  function message(text, canRetry) {
    status.textContent = text;
    retry.hidden = !canRetry;
  }

  function connect() {
    if (launchTimer !== null) {
      clearTimeout(launchTimer);
      launchTimer = null;
    }
    if (navigator.onLine === false) {
      message('Fără internet. Verifică rețeaua televizorului.', true);
      return;
    }
    message('Se conectează la panoul Screenflow...', false);
    try {
      // Navigation to this exact hostname is authorized by config.xml.
      window.location.replace(remote);
    } catch (err) {
      message('Nu am putut deschide Screenflow. Apasă Reîncearcă.', true);
      if (window.console && console.error) console.error('Screenflow navigation:', err);
    }
  }

  function scheduleConnect(delay) {
    if (launchTimer !== null) clearTimeout(launchTimer);
    launchTimer = setTimeout(connect, delay);
  }

  retry.addEventListener('click', connect);
  window.addEventListener('offline', function () {
    if (launchTimer !== null) clearTimeout(launchTimer);
    launchTimer = null;
    message('Fără internet. Verifică rețeaua televizorului.', true);
  });
  window.addEventListener('online', function () { scheduleConnect(1200); });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) scheduleConnect(1200);
  });
  document.addEventListener('keydown', function (event) {
    if (event.keyCode === 10009 || event.keyCode === 27) {
      try { window.tizen.application.getCurrentApplication().exit(); } catch (err) {}
    }
  });

  scheduleConnect(750);
}());
