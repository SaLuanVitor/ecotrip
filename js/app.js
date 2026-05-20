(function () {
  'use strict';

  var state = {
    origin: null,
    destination: null,
    selectedMode: 'car',
    results: null,
    distances: null,
    mapReady: false,
    geocodeOrigin: null,
    geocodeDest: null,
    mapPoints: [],
    selectMode: 'origin',
    calculating: false
  };

  function init() {
    setupModeButtons();
    setupEventListeners();
    initMap();
    setDefaultMode();
  }

  function setDefaultMode() {
    var defaultBtn = document.querySelector('.mode-btn[data-mode="car"]');
    if (defaultBtn) defaultBtn.classList.add('active');
  }

  function setupModeButtons() {
    var buttons = document.querySelectorAll('.mode-btn');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function () {
        var allBtns = document.querySelectorAll('.mode-btn');
        for (var j = 0; j < allBtns.length; j++) {
          allBtns[j].classList.remove('active');
        }
        this.classList.add('active');
        state.selectedMode = this.getAttribute('data-mode');
        updateModeHelpText(state.selectedMode);
        if (!state.calculating && state.geocodeOrigin && state.geocodeDest) {
          handleCalculate();
        }
      });
    }
  }

  function updateModeHelpText(mode) {
    var el = document.getElementById('modeHelpText');
    if (!el) return;
    var texts = window.EcoTrip.config.modeHelpTexts;
    el.textContent = texts[mode] || 'Selecione um modo de transporte.';
  }

  function setupEventListeners() {
    var calculateBtn = document.getElementById('calculateBtn');
    if (calculateBtn) {
      calculateBtn.addEventListener('click', handleCalculate);
    }

    var swapBtn = document.getElementById('swapBtn');
    if (swapBtn) {
      swapBtn.addEventListener('click', function () {
        window.EcoTrip.utils.swapOriginDest();
        window.EcoTripMap.clearGeocodeCache();
      });
    }

    var clearBtn = document.getElementById('clearPointsBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', clearPoints);
    }

    var exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportToPDF);
    }

    function enterHandler(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCalculate();
      }
    }

    var geoDebounce = window.EcoTrip.utils.debounce(function (inputId) {
      var el = document.getElementById(inputId);
      if (!el) return;
      var val = el.value.trim();
      if (val.length < 3) return;
      window.EcoTripMap.geocodeAddress(val).catch(function () {});
    }, window.EcoTrip.config.GEOCODE_DEBOUNCE_MS);

    var originInput = document.getElementById('origin');
    var destInput = document.getElementById('destination');

    if (originInput) {
      originInput.addEventListener('keydown', enterHandler);
      originInput.addEventListener('input', function () {
        geoDebounce('origin');
      });
    }

    if (destInput) {
      destInput.addEventListener('keydown', enterHandler);
      destInput.addEventListener('input', function () {
        geoDebounce('destination');
      });
    }
  }

  function initMap() {
    var container = document.getElementById('mapView');
    if (!container) return;

    if (typeof L === 'undefined') {
      container.innerHTML =
        '<div class="map-placeholder"><span class="map-placeholder-icon">\uD83D\uDDFA\uFE0F</span><p>Carregando mapa...</p></div>';
      return;
    }

    window.EcoTripMap
      .init('mapView')
      .then(function () {
        state.mapReady = true;
        window.EcoTripMap.onMapDblClick(function (coords) {
          handleMapDblClick(coords);
        });
        setTimeout(function () {
          window.EcoTripMap.invalidateSize();
        }, 200);
      })
      .catch(function () {
        container.innerHTML =
          '<div class="map-placeholder"><span class="map-placeholder-icon">\uD83D\uDDFA\uFE0F</span><p>N\u00E3o foi poss\u00EDvel carregar o mapa.</p></div>';
      });
  }

  function validateInputs() {
    var origin = document.getElementById('origin').value.trim();
    var dest = document.getElementById('destination').value.trim();

    if (!origin) {
      window.EcoTrip.utils.showError('Informe a origem.');
      return null;
    }
    if (!dest) {
      window.EcoTrip.utils.showError('Informe o destino.');
      return null;
    }
    if (origin.toLowerCase() === dest.toLowerCase()) {
      window.EcoTrip.utils.showError('Origem e destino devem ser diferentes.');
      return null;
    }

    return { origin: origin, dest: dest };
  }

  function handleCalculate() {
    var inputs = validateInputs();
    if (!inputs) return;

    state.calculating = true;
    window.EcoTrip.utils.setCalculateEnabled(false);
    window.EcoTrip.utils.showLoading();
    hidePreviousResults();

    var originAddr = inputs.origin;
    var destAddr = inputs.dest;
    var mode = state.selectedMode;
    var utils = window.EcoTrip.utils;
    var mapAPI = window.EcoTripMap;

    Promise.all([
      mapAPI.geocodeAddress(originAddr),
      mapAPI.geocodeAddress(destAddr)
    ])
      .then(function (results) {
        var origin = results[0];
        var dest = results[1];
        state.geocodeOrigin = origin;
        state.geocodeDest = dest;

        var geodesicDist = mapAPI.geodesicDistance(
          origin.lat, origin.lng, dest.lat, dest.lng
        );

        var fallbackRoad = {
          distance: geodesicDist * 1.3,
          duration: (geodesicDist * 1.3 * 60) / 50,
          geometry: null
        };
        var fallbackWalk = {
          distance: geodesicDist * 1.2,
          duration: (geodesicDist * 1.2 * 60) / 5,
          geometry: null
        };
        var fallbackCycle = {
          distance: geodesicDist * 1.3,
          duration: (geodesicDist * 1.3 * 60) / 18,
          geometry: null
        };

        var drivingRoute = mapAPI.calculateRoute(origin, dest, 'car').catch(function () {
          return fallbackRoad;
        });
        var walkingRoute = mapAPI.calculateRoute(origin, dest, 'walking').catch(function () {
          return fallbackWalk;
        });
        var cyclingRoute = mapAPI.calculateRoute(origin, dest, 'bicycle').catch(function () {
          return fallbackCycle;
        });

        return Promise.all([
          drivingRoute, walkingRoute, cyclingRoute, Promise.resolve(geodesicDist)
        ]);
      })
      .then(function (data) {
        var drivingResult = data[0];
        var walkingResult = data[1];
        var cyclingResult = data[2];
        var geodesicDist = data[3];

        state.distances = {
          road: drivingResult.distance,
          walking: walkingResult.distance,
          cycling: cyclingResult.distance,
          geodesic: geodesicDist
        };

        var mode = state.selectedMode;

        var selectedDist;
        var displayGeometry;
        var displayDuration;

        if (mode === 'walking') {
          selectedDist = walkingResult.distance;
          displayGeometry = walkingResult.geometry;
          displayDuration = walkingResult.duration;
        } else if (mode === 'bicycle') {
          selectedDist = cyclingResult.distance;
          displayGeometry = cyclingResult.geometry;
          displayDuration = cyclingResult.duration;
        } else if (mode === 'airplane') {
          selectedDist = geodesicDist;
          displayGeometry = null;
          displayDuration = (geodesicDist / 800) * 60 + window.EcoTrip.config.airplaneExtraTime;
        } else {
          selectedDist = drivingResult.distance;
          displayGeometry = drivingResult.geometry;
          displayDuration = drivingResult.duration;
        }

        var co2 = window.EcoTrip.emissions.calculateEmissions(selectedDist, mode);
        var credits = window.EcoTrip.emissions.calculateCarbonCredits(co2);
        var trees = window.EcoTrip.emissions.calculateTreesRequired(co2);
        var cost = window.EcoTrip.emissions.calculateOffsetCost(credits);
        var time = window.EcoTrip.comparison.calculateEstimatedTime(selectedDist, mode);

        state.results = {
          mode: mode,
          distance: selectedDist,
          co2: co2,
          credits: credits,
          trees: trees,
          cost: cost,
          time: time,
          routeGeometry: displayGeometry,
          routeDuration: displayDuration
        };

        updateResultsUI(state.results);
        updateRecommendationUI();
        updateComparisonUI();
        updateMap();

        state.calculating = false;
        window.EcoTrip.utils.hideLoading();
        window.EcoTrip.utils.setCalculateEnabled(true);
      })
      .catch(function (err) {
        state.calculating = false;
        window.EcoTrip.utils.hideLoading();
        window.EcoTrip.utils.setCalculateEnabled(true);
        window.EcoTrip.utils.showError(
          utils.getErrorMessage(err, 'Erro ao processar.')
        );
        console.error(err);
      });
  }

  function showStatusMessage(msg) {
    var el = document.getElementById('statusMessage');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('visible');
    clearTimeout(el._hideTimeout);
    el._hideTimeout = setTimeout(function () {
      el.classList.remove('visible');
    }, 5000);
  }

  function handleMapDblClick(coords) {
    if (state.calculating) return;

    if (state.mapPoints.length >= 2) {
      showStatusMessage('Limpe os pontos para selecionar novos locais.');
      return;
    }

    window.EcoTripMap.reverseGeocode(coords.lat, coords.lng)
      .then(function (result) {
        state.mapPoints.push(result);

        if (state.mapPoints.length === 1) {
          var originInput = document.getElementById('origin');
          if (originInput) originInput.value = result.address;
          state.selectMode = 'dest';
          showStatusMessage('Origem definida. Selecione o destino no mapa.');
          if (state.mapReady) {
            window.EcoTripMap.clearMap();
            window.EcoTripMap.addMarkers(state.mapPoints[0], null);
          }
        } else if (state.mapPoints.length === 2) {
          var destInput = document.getElementById('destination');
          if (destInput) destInput.value = result.address;
          state.selectMode = 'complete';
          showStatusMessage('Destino definido. Calculando rota...');
          handleCalculate();
        }
      })
      .catch(function () {
        showStatusMessage('N\u00E3o foi poss\u00EDvel obter o endere\u00E7o.');
      });
  }

  function clearPoints() {
    state.mapPoints = [];
    state.selectMode = 'origin';
    state.geocodeOrigin = null;
    state.geocodeDest = null;
    state.results = null;
    state.distances = null;

    var originInput = document.getElementById('origin');
    var destInput = document.getElementById('destination');
    if (originInput) originInput.value = '';
    if (destInput) destInput.value = '';

    window.EcoTripMap.clearMap();
    hidePreviousResults();
    showStatusMessage('Pontos removidos.');
  }

  function hidePreviousResults() {
    var sections = [
      'resultsSection',
      'comparisonSection',
      'recommendationBanner'
    ];
    for (var i = 0; i < sections.length; i++) {
      var el = document.getElementById(sections[i]);
      if (el) el.classList.remove('visible');
    }
  }

  function updateMap() {
    if (!state.mapReady || !state.geocodeOrigin || !state.geocodeDest) return;

    window.EcoTripMap.clearMap();
    window.EcoTripMap.addMarkers(state.geocodeOrigin, state.geocodeDest);

    if (state.selectedMode === 'airplane') {
      window.EcoTripMap.drawDashedLine(state.geocodeOrigin, state.geocodeDest);
    } else {
      var geometry = state.results ? state.results.routeGeometry : null;
      if (geometry) {
        window.EcoTripMap.drawRoute(geometry);
      }
    }
    window.EcoTripMap.fitToExtent(state.geocodeOrigin, state.geocodeDest);
  }

  function updateResultsUI(results) {
    var section = document.getElementById('resultsSection');
    if (section) section.classList.add('visible');

    var utils = window.EcoTrip.utils;
    setCardValue('resultDistance', utils.formatNumber(results.distance, 1) + ' km');
    setCardValue('resultCO2', utils.formatNumber(results.co2, 1) + ' kg');
    setCardValue('resultCredits', results.credits > 0 ? results.credits : '0');
    setCardValue('resultTrees', results.trees);
    setCardValue('resultCost', utils.formatCurrency(results.cost));
  }

  function setCardValue(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function updateRecommendationUI() {
    var banner = document.getElementById('recommendationBanner');
    if (!banner) return;

    var comparisonData = window.EcoTrip.comparison.generateComparison(state.distances);
    var recommendation = window.EcoTrip.comparison.getBestAlternative(
      comparisonData,
      state.selectedMode
    );

    if (recommendation) {
      banner.innerHTML =
        '<div class="rec-content">' +
        '<div class="rec-icon">\uD83C\uDF3F</div>' +
        '<div class="rec-text">' +
        '<strong>' +
        recommendation.title +
        '</strong><br>' +
        recommendation.message +
        '</div>' +
        '</div>';
      banner.classList.add('visible');
    }
  }

  function updateComparisonUI() {
    var tableBody = document.getElementById('comparisonBody');
    if (!tableBody) return;

    var comparisonData = window.EcoTrip.comparison.generateComparison(state.distances);

    var rows = window.EcoTrip.comparison.generateTableRows(comparisonData);
    tableBody.innerHTML = rows;

    var section = document.getElementById('comparisonSection');
    if (section) section.classList.add('visible');
  }

  function exportToPDF() {
    var btn = document.getElementById('exportBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Gerando PDF...';
    }

    var element = document.getElementById('results-dashboard');
    if (!element) {
      if (btn) { btn.disabled = false; btn.textContent = '\uD83D\uDCC4 Exportar PDF'; }
      return;
    }

    var hidden = [];

    var exportWrapper = document.querySelector('.export-wrapper');
    var compensationBtn = document.querySelector('.compensation-card .btn-primary');

    if (exportWrapper) { exportWrapper.style.display = 'none'; hidden.push(exportWrapper); }
    if (compensationBtn) { compensationBtn.style.display = 'none'; hidden.push(compensationBtn); }

    function restoreUI() {
      for (var i = 0; i < hidden.length; i++) {
        hidden[i].style.display = '';
      }
      if (btn) { btn.disabled = false; btn.textContent = '\uD83D\uDCC4 Exportar PDF'; }
    }

    var opt = {
      margin: 10,
      filename: 'ecotrip-impact-report.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save()
      .then(restoreUI)
      .catch(function (err) {
        restoreUI();
        window.EcoTrip.utils.showError('Erro ao gerar PDF.');
        console.error(err);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
