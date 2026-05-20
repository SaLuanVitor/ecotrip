window.EcoTrip = window.EcoTrip || {};
window.EcoTrip.utils = {

  formatNumber: function(num, decimals) {
    if (num === null || num === undefined || isNaN(num)) return '\u2014';
    var d = decimals !== undefined ? decimals : (Math.abs(num) < 1 ? 2 : 1);
    return Number(num.toFixed(d)).toLocaleString('pt-BR');
  },

  formatCurrency: function(value) {
    if (value === null || value === undefined || isNaN(value)) return '\u2014';
    return 'R$ ' + Number(value).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },

  formatDuration: function(minutes) {
    if (minutes === null || minutes === undefined || isNaN(minutes)) return '\u2014';
    var h = Math.floor(minutes / 60);
    var m = Math.round(minutes % 60);
    if (h > 0 && m > 0) return h + 'h ' + m + 'min';
    if (h > 0) return h + 'h';
    return m + 'min';
  },

  swapOriginDest: function() {
    var origin = document.getElementById('origin');
    var dest = document.getElementById('destination');
    if (origin && dest) {
      var temp = origin.value;
      origin.value = dest.value;
      dest.value = temp;
    }
  },

  getModeLabel: function(modeId) {
    var modes = window.EcoTrip.config.transportModes;
    for (var i = 0; i < modes.length; i++) {
      if (modes[i].id === modeId) return modes[i].label;
    }
    return modeId;
  },

  getModeIcon: function(modeId) {
    var modes = window.EcoTrip.config.transportModes;
    for (var i = 0; i < modes.length; i++) {
      if (modes[i].id === modeId) return modes[i].icon;
    }
    return '';
  },

  showLoading: function() {
    var overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('active');
  },

  hideLoading: function() {
    var overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('active');
  },

  showError: function(message) {
    var container = document.getElementById('errorContainer');
    if (container) {
      container.textContent = message;
      container.classList.add('visible');
      clearTimeout(container._timeout);
      container._timeout = setTimeout(function() {
        container.classList.remove('visible');
      }, 5000);
    }
  },

  debounce: function(fn, delay) {
    var timer = null;
    var debounced = function () {
      var context = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, delay);
    };
    debounced.cancel = function () {
      clearTimeout(timer);
      timer = null;
    };
    return debounced;
  },

  fetchWithTimeout: function(url, options, timeoutMs) {
    var controller = new AbortController();
    var timeoutId = setTimeout(function () {
      controller.abort();
    }, timeoutMs);

    var opts = options || {};
    opts.signal = controller.signal;

    return fetch(url, opts).then(function (response) {
      clearTimeout(timeoutId);
      return response;
    }).catch(function (err) {
      clearTimeout(timeoutId);
      throw err;
    });
  },

  retryFetch: function(url, options, retries, timeoutMs) {
    var self = this;
    return self.fetchWithTimeout(url, options, timeoutMs).then(function (response) {
      if (response.status >= 500 && response.status < 600 && retries > 0) {
        var delay = Math.pow(2, 3 - retries) * 1000;
        return new Promise(function (resolve) {
          setTimeout(function () {
            resolve(self.retryFetch(url, options, retries - 1, timeoutMs));
          }, delay);
        });
      }
      if (!response.ok) {
        return response.text().then(function (text) {
          var err = new Error(text || 'HTTP ' + response.status);
          err.status = response.status;
          throw err;
        });
      }
      return response.json();
    });
  },

  getErrorMessage: function(err, fallback) {
    if (!err) return fallback || 'Erro desconhecido.';
    var msg = err.message || String(err);
    var status = err.status;

    if (err.name === 'AbortError') return 'Tempo de resposta excedido.';
    if (status === 429 || msg.indexOf('429') !== -1) return 'Muitas requisições. Tente novamente em alguns segundos.';
    if (status === 502 || status === 503 || status === 504) return 'Serviço temporariamente indisponível.';
    if (msg.indexOf('Endereço') !== -1) return 'Endereço não encontrado.';
    if (msg.indexOf('rota') !== -1 || msg.indexOf('Route') !== -1) return 'Serviço de rotas temporariamente indisponível.';
    if (msg.indexOf('Failed to fetch') !== -1 || msg.indexOf('NetworkError') !== -1 || msg.indexOf('network') !== -1) return 'Erro de conexão.';
    if (msg.indexOf('timeout') !== -1 || msg.indexOf('Timeout') !== -1) return 'Tempo de resposta excedido.';

    return fallback || msg || 'Erro desconhecido.';
  },

  setCalculateEnabled: function(enabled) {
    var btn = document.getElementById('calculateBtn');
    if (!btn) return;
    btn.disabled = !enabled;
    btn.textContent = enabled ? 'Calcular Impacto' : 'Calculando...';
  }
};
