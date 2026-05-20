(function () {
  'use strict';

  var state = {
    selectedMode: 'car',
    results: null,
    distances: null,
    mapReady: false,
    calculating: false,
    fieldStatus: { origin: 'idle', dest: 'idle' },
    validatedOrigin: null,
    validatedDest: null,
    autocompleteIndex: { origin: -1, dest: -1 },
    _geoDebounce: { origin: null, dest: null }
  };

  function init() {
    setupModeButtons();
    setupEventListeners();
    initMap();
    setDefaultMode();
    restoreApplicationState();
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
        saveApplicationState();
        if (!state.calculating && state.fieldStatus.origin === 'valid' && state.fieldStatus.dest === 'valid') {
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
    // Individual clear buttons
    var clearBtns = document.querySelectorAll('.input-clear-btn');
    for (var i = 0; i < clearBtns.length; i++) {
      clearBtns[i].addEventListener('click', function () {
        if (this.getAttribute('data-field') === 'origin') {
          clearOriginField();
        } else {
          clearDestField();
        }
      });
    }

    // Swap button
    var swapBtn = document.getElementById('swapBtn');
    if (swapBtn) {
      swapBtn.addEventListener('click', swapFields);
    }

    // Clear points button (legacy - clears both)
    var clearBtn = document.getElementById('clearPointsBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        clearOriginField();
        clearDestField();
      });
    }

    // Calculate button
    var calculateBtn = document.getElementById('calculateBtn');
    if (calculateBtn) {
      calculateBtn.addEventListener('click', handleCalculate);
    }

    // Export button
    var exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportToPDF);
    }

    // Input events
    var originInput = document.getElementById('origin');
    var destInput = document.getElementById('destination');

    if (originInput) {
      originInput.addEventListener('input', function () { onInputChange('origin'); });
      originInput.addEventListener('keydown', function (e) { onInputKeydown(e, 'origin'); });
      originInput.addEventListener('focus', function () {
        // Re-open dropdown if suggestions exist
      });
    }

    if (destInput) {
      destInput.addEventListener('input', function () { onInputChange('dest'); });
      destInput.addEventListener('keydown', function (e) { onInputKeydown(e, 'dest'); });
    }

    // Outside click closes dropdowns
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.input-group')) {
        closeAutocomplete('origin');
        closeAutocomplete('dest');
      }
    });
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

  // --- Address formatting ---

  function formatSuggestionLabel(result) {
    var addr = result.address || {};
    var parts = [];
    var street = addr.road || addr.pedestrian || '';
    var neighborhood = addr.suburb || addr.neighbourhood || '';
    var city = addr.city || addr.town || addr.village || '';
    var state_ = addr.state || '';
    var country = addr.country || '';

    if (street && city) parts.push(street + ', ' + city);
    else if (street) parts.push(street);
    else if (neighborhood && city) parts.push(neighborhood + ', ' + city);
    else if (neighborhood) parts.push(neighborhood);
    else if (city) parts.push(city);

    if (state_ && parts.length > 0 && parts.indexOf(state_) === -1) {
      parts.push(state_);
    }
    if (country && parts.length > 0 && parts.indexOf(country) === -1) {
      parts.push(country);
    }

    // Deduplicate
    var unique = [];
    for (var i = 0; i < parts.length; i++) {
      if (unique.indexOf(parts[i]) === -1) unique.push(parts[i]);
    }

    var label = unique.join(', ');
    if (label.length > 60) label = label.substring(0, 57) + '...';
    return label;
  }

  // --- Field status ---

  function updateFieldStatus(field, status) {
    state.fieldStatus[field] = status;
    var groupId = field === 'origin' ? 'originGroup' : 'destGroup';
    var group = document.getElementById(groupId);
    if (!group) return;

    group.classList.remove('valid', 'pending', 'invalid');
    if (status === 'valid' || status === 'pending' || status === 'invalid') {
      group.classList.add(status);
    }

    var icon = group.querySelector('.input-status-icon');
    if (!icon) return;

    if (status === 'valid') {
      icon.textContent = '\u2713';
      icon.title = 'Endere\u00E7o validado.';
    } else if (status === 'pending') {
      icon.textContent = '\u23F3';
      icon.title = 'Aguardando valida\u00E7\u00E3o.';
    } else if (status === 'invalid') {
      icon.textContent = '\u26A0';
      icon.title = 'Endere\u00E7o n\u00E3o encontrado.';
    } else {
      icon.textContent = '';
      icon.title = '';
    }
  }

  // --- Clear individual fields ---

  function clearOriginField() {
    var input = document.getElementById('origin');
    if (input) input.value = '';
    state.validatedOrigin = null;
    updateFieldStatus('origin', 'idle');
    window.EcoTripMap.removeMarker('origin');
    clearAllResults();
    closeAutocomplete('origin');
    updateHasValue('origin');
    showStatusMessage('Origem removida.');
    saveApplicationState();
  }

  function clearDestField() {
    var input = document.getElementById('destination');
    if (input) input.value = '';
    state.validatedDest = null;
    updateFieldStatus('dest', 'idle');
    window.EcoTripMap.removeMarker('dest');
    clearAllResults();
    closeAutocomplete('dest');
    updateHasValue('dest');
    showStatusMessage('Destino removido.');
    saveApplicationState();
  }

  function updateHasValue(field) {
    var input = document.getElementById(field === 'origin' ? 'origin' : 'destination');
    var group = document.getElementById(field === 'origin' ? 'originGroup' : 'destGroup');
    if (group && input) {
      group.classList.toggle('has-value', input.value.trim().length > 0);
    }
  }

  // --- Swap ---

  function swapFields() {
    var originInput = document.getElementById('origin');
    var destInput = document.getElementById('destination');
    if (!originInput || !destInput) return;

    var tempVal = originInput.value;
    originInput.value = destInput.value;
    destInput.value = tempVal;

    var tempCoord = state.validatedOrigin;
    state.validatedOrigin = state.validatedDest;
    state.validatedDest = tempCoord;

    var tempStatus = state.fieldStatus.origin;
    state.fieldStatus.origin = state.fieldStatus.dest;
    state.fieldStatus.dest = tempStatus;

    updateFieldStatus('origin', state.fieldStatus.origin);
    updateFieldStatus('dest', state.fieldStatus.dest);
    updateHasValue('origin');
    updateHasValue('dest');

    clearAllResults();
    if (state.mapReady) {
      window.EcoTripMap.clearMap();
      window.EcoTripMap.addMarkers(state.validatedOrigin, state.validatedDest);
      if (state.validatedOrigin && state.validatedDest) {
        window.EcoTripMap.fitToExtent(state.validatedOrigin, state.validatedDest);
      }
    }

    saveApplicationState();

    if (state.fieldStatus.origin === 'valid' && state.fieldStatus.dest === 'valid') {
      handleCalculate();
    }
  }

  // --- Autocomplete dropdown ---

  function openAutocomplete(field, results) {
    var dropdownId = field === 'origin' ? 'originDropdown' : 'destDropdown';
    var dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    state.autocompleteIndex[field] = -1;

    if (!results || results.length === 0) {
      dropdown.innerHTML = '<li class="autocomplete-empty">Nenhum endere\u00E7o encontrado.</li>';
      dropdown.classList.add('open');
      setAriaExpanded(field, true);
      return;
    }

    var html = '';
    for (var i = 0; i < results.length; i++) {
      var label = formatSuggestionLabel(results[i]);
      var full = results[i].displayName.replace(/"/g, '&quot;');
      html += '<li class="autocomplete-item" role="option" ' +
        'data-index="' + i + '" ' +
        'data-lat="' + results[i].lat + '" ' +
        'data-lng="' + results[i].lng + '" ' +
        'data-full-address="' + full + '" ' +
        'aria-label="' + full + '" ' +
        'title="' + full + '">' +
        label +
        '</li>';
    }

    dropdown.innerHTML = html;
    dropdown.classList.add('open');
    setAriaExpanded(field, true);

    // Click handlers
    var items = dropdown.querySelectorAll('.autocomplete-item');
    for (var i = 0; i < items.length; i++) {
      items[i].addEventListener('click', function () {
        selectAutocomplete(field, parseInt(this.getAttribute('data-index')));
      });
    }
  }

  function closeAutocomplete(field) {
    var dropdownId = field === 'origin' ? 'originDropdown' : 'destDropdown';
    var dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    dropdown.classList.remove('open');
    dropdown.innerHTML = '';
    state.autocompleteIndex[field] = -1;
    setAriaExpanded(field, false);
  }

  function setAriaExpanded(field, expanded) {
    var input = document.getElementById(field === 'origin' ? 'origin' : 'destination');
    if (input) input.setAttribute('aria-expanded', String(expanded));
  }

  function selectAutocomplete(field, index) {
    var dropdownId = field === 'origin' ? 'originDropdown' : 'destDropdown';
    var dropdown = document.getElementById(dropdownId);
    if (!dropdown || !dropdown.classList.contains('open')) return;

    var items = dropdown.querySelectorAll('.autocomplete-item');
    if (index < 0 || index >= items.length) return;

    var item = items[index];
    var input = document.getElementById(field === 'origin' ? 'origin' : 'destination');
    if (!input) return;

    input.value = item.getAttribute('data-full-address');

    var result = {
      lat: parseFloat(item.getAttribute('data-lat')),
      lng: parseFloat(item.getAttribute('data-lng')),
      address: item.getAttribute('data-full-address')
    };

    if (field === 'origin') {
      state.validatedOrigin = result;
    } else {
      state.validatedDest = result;
    }
    updateFieldStatus(field, 'valid');
    updateHasValue(field);
    closeAutocomplete(field);
    saveApplicationState();

    window.EcoTripMap.addMarker(field === 'origin' ? 'origin' : 'dest', result);

    if (state.fieldStatus.origin === 'valid' && state.fieldStatus.dest === 'valid') {
      showStatusMessage('Destino validado. Calculando rota...');
      handleCalculate();
    } else {
      showStatusMessage('Origem validada. Selecione o destino.');
    }
  }

  function navigateAutocomplete(field, direction) {
    var dropdownId = field === 'origin' ? 'originDropdown' : 'destDropdown';
    var dropdown = document.getElementById(dropdownId);
    if (!dropdown || !dropdown.classList.contains('open')) return;

    var items = dropdown.querySelectorAll('.autocomplete-item');
    if (items.length === 0) return;

    var current = state.autocompleteIndex[field];
    current += direction;
    if (current < 0) current = items.length - 1;
    if (current >= items.length) current = 0;
    state.autocompleteIndex[field] = current;

    for (var i = 0; i < items.length; i++) {
      items[i].classList.remove('active');
    }
    items[current].classList.add('active');
    items[current].scrollIntoView({ block: 'nearest' });
  }

  // --- Input handling ---

  function onInputChange(field) {
    var inputId = field === 'origin' ? 'origin' : 'destination';
    var el = document.getElementById(inputId);
    if (!el) return;
    var val = el.value.trim();

    updateHasValue(field);

    // Clear validation state
    if (field === 'origin') {
      state.validatedOrigin = null;
    } else {
      state.validatedDest = null;
    }

    if (val.length === 0) {
      updateFieldStatus(field, 'idle');
      closeAutocomplete(field);
      window.EcoTripMap.removeMarker(field === 'origin' ? 'origin' : 'dest');
      clearAllResults();
      return;
    }

    updateFieldStatus(field, 'pending');
    clearAllResults();
    closeAutocomplete(field);

    // Debounce geocode
    clearTimeout(state._geoDebounce[field]);
    if (val.length < 3) return;
    state._geoDebounce[field] = setTimeout(function () {
      geocodeAndValidate(field, val);
    }, window.EcoTrip.config.GEOCODE_DEBOUNCE_MS);
  }

  function onInputKeydown(e, field) {
    var dropdownId = field === 'origin' ? 'originDropdown' : 'destDropdown';
    var dropdown = document.getElementById(dropdownId);
    var isOpen = dropdown && dropdown.classList.contains('open');

    switch (e.key) {
      case 'ArrowDown':
        if (isOpen) { e.preventDefault(); navigateAutocomplete(field, 1); }
        break;
      case 'ArrowUp':
        if (isOpen) { e.preventDefault(); navigateAutocomplete(field, -1); }
        break;
      case 'Enter':
        if (isOpen && state.autocompleteIndex[field] >= 0) {
          e.preventDefault();
          selectAutocomplete(field, state.autocompleteIndex[field]);
        }
        break;
      case 'Escape':
        if (isOpen) { e.preventDefault(); closeAutocomplete(field); }
        break;
    }
  }

  function geocodeAndValidate(field, address) {
    window.EcoTripMap.geocodeSuggestions(address)
      .then(function (results) {
        if (results.length === 0) {
          updateFieldStatus(field, 'invalid');
          openAutocomplete(field, []);
          return;
        }
        // Show dropdown with suggestions
        openAutocomplete(field, results);
      })
      .catch(function () {
        updateFieldStatus(field, 'invalid');
        openAutocomplete(field, []);
      });
  }

  // --- Map double-click ---

  function handleMapDblClick(coords) {
    if (state.calculating) return;

    // Determine which field needs a value
    var targetField = null;
    if (state.fieldStatus.origin !== 'valid') {
      targetField = 'origin';
    } else if (state.fieldStatus.dest !== 'valid') {
      targetField = 'dest';
    }

    if (!targetField) {
      showStatusMessage('Limpe apenas o campo que deseja alterar.');
      return;
    }

    setMapPoint(targetField, coords);
  }

  function setMapPoint(field, coords) {
    window.EcoTripMap.reverseGeocode(coords.lat, coords.lng)
      .then(function (result) {
        var input = document.getElementById(field === 'origin' ? 'origin' : 'destination');
        if (input) input.value = result.address;

        if (field === 'origin') {
          state.validatedOrigin = result;
        } else {
          state.validatedDest = result;
        }
        updateFieldStatus(field, 'valid');
        updateHasValue(field);

        window.EcoTripMap.addMarker(field === 'origin' ? 'origin' : 'dest', result);
        saveApplicationState();

        if (state.fieldStatus.origin === 'valid' && state.fieldStatus.dest === 'valid') {
          showStatusMessage('Destino validado. Calculando rota...');
          handleCalculate();
        } else {
          showStatusMessage((field === 'origin' ? 'Origem' : 'Destino') + ' validada. Selecione o ' +
            (field === 'origin' ? 'destino' : 'outro ponto') + '.');
        }
      })
      .catch(function () {
        // Fallback: use coordinates
        var fallback = {
          lat: coords.lat,
          lng: coords.lng,
          address: coords.lat.toFixed(4) + ', ' + coords.lng.toFixed(4)
        };
        var input = document.getElementById(field === 'origin' ? 'origin' : 'destination');
        if (input) input.value = fallback.address;

        if (field === 'origin') {
          state.validatedOrigin = fallback;
        } else {
          state.validatedDest = fallback;
        }
        updateFieldStatus(field, 'valid');
        updateHasValue(field);

        window.EcoTripMap.addMarker(field === 'origin' ? 'origin' : 'dest', fallback);

        if (state.fieldStatus.origin === 'valid' && state.fieldStatus.dest === 'valid') {
          showStatusMessage('Destino validado. Calculando rota...');
          handleCalculate();
        }
      });
  }

  // --- Calculation ---

  function handleCalculate() {
    if (!state.validatedOrigin || !state.validatedDest) {
      if (!state.validatedOrigin) showStatusMessage('Informe a origem.');
      if (!state.validatedDest) showStatusMessage('Informe o destino.');
      return;
    }

    state.calculating = true;
    window.EcoTrip.utils.setCalculateEnabled(false);
    window.EcoTrip.utils.showLoading();
    clearAllResults();

    var origin = state.validatedOrigin;
    var dest = state.validatedDest;
    var mode = state.selectedMode;
    var utils = window.EcoTrip.utils;
    var mapAPI = window.EcoTripMap;

    var geodesicDist = mapAPI.geodesicDistance(origin.lat, origin.lng, dest.lat, dest.lng);

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

    Promise.all([drivingRoute, walkingRoute, cyclingRoute, Promise.resolve(geodesicDist)])
      .then(function (data) {
        var drivingResult = data[0];
        var walkingResult = data[1];
        var cyclingResult = data[2];

        state.distances = {
          road: drivingResult.distance,
          walking: walkingResult.distance,
          cycling: cyclingResult.distance,
          geodesic: geodesicDist
        };

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

  // --- UI updates ---

  function clearAllResults() {
    var sections = ['resultsSection', 'comparisonSection', 'recommendationBanner'];
    for (var i = 0; i < sections.length; i++) {
      var el = document.getElementById(sections[i]);
      if (el) el.classList.remove('visible');
    }
    state.results = null;
    state.distances = null;
  }

  function updateMap() {
    if (!state.mapReady || !state.validatedOrigin || !state.validatedDest) return;

    window.EcoTripMap.clearMap();
    window.EcoTripMap.addMarkers(state.validatedOrigin, state.validatedDest);

    if (state.selectedMode === 'airplane') {
      window.EcoTripMap.drawDashedLine(state.validatedOrigin, state.validatedDest);
    } else {
      var geometry = state.results ? state.results.routeGeometry : null;
      if (geometry) {
        window.EcoTripMap.drawRoute(geometry);
      }
    }
    window.EcoTripMap.fitToExtent(state.validatedOrigin, state.validatedDest);
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

  // --- Status messages ---

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

  // --- Local storage ---

  function saveApplicationState() {
    try {
      var data = {
        originText: document.getElementById('origin').value,
        destText: document.getElementById('destination').value,
        originLat: state.validatedOrigin ? state.validatedOrigin.lat : null,
        originLng: state.validatedOrigin ? state.validatedOrigin.lng : null,
        originAddress: state.validatedOrigin ? state.validatedOrigin.address : null,
        destLat: state.validatedDest ? state.validatedDest.lat : null,
        destLng: state.validatedDest ? state.validatedDest.lng : null,
        destAddress: state.validatedDest ? state.validatedDest.address : null,
        selectedMode: state.selectedMode
      };
      localStorage.setItem('ecotrip_state', JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  function restoreApplicationState() {
    try {
      var raw = localStorage.getItem('ecotrip_state');
      if (!raw) return;
      var data = JSON.parse(raw);

      if (data.selectedMode) {
        state.selectedMode = data.selectedMode;
        var modeBtn = document.querySelector('.mode-btn[data-mode="' + data.selectedMode + '"]');
        if (modeBtn) {
          var allBtns = document.querySelectorAll('.mode-btn');
          for (var i = 0; i < allBtns.length; i++) {
            allBtns[i].classList.remove('active');
          }
          modeBtn.classList.add('active');
          updateModeHelpText(data.selectedMode);
        }
      }

      var originInput = document.getElementById('origin');
      var destInput = document.getElementById('destination');

      if (data.originText && originInput) {
        originInput.value = data.originText;
        if (data.originLat && data.originLng) {
          state.validatedOrigin = {
            lat: data.originLat,
            lng: data.originLng,
            address: data.originAddress || data.originText
          };
          state.fieldStatus.origin = 'valid';
          updateFieldStatus('origin', 'valid');
          updateHasValue('origin');
        }
      }

      if (data.destText && destInput) {
        destInput.value = data.destText;
        if (data.destLat && data.destLng) {
          state.validatedDest = {
            lat: data.destLat,
            lng: data.destLng,
            address: data.destAddress || data.destText
          };
          state.fieldStatus.dest = 'valid';
          updateFieldStatus('dest', 'valid');
          updateHasValue('dest');
        }
      }

      // Auto-calculate if both valid
      if (state.fieldStatus.origin === 'valid' && state.fieldStatus.dest === 'valid') {
        setTimeout(function () {
          handleCalculate();
        }, 300);
      }
    } catch (e) { /* ignore */ }
  }

  // --- PDF Export ---

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
