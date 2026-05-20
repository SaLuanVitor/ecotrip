window.EcoTrip = window.EcoTrip || {};
window.EcoTrip.comparison = {

  getEfficiencyLabel: function(co2Kg) {
    var thresholds = window.EcoTrip.config.efficiencyThresholds;
    for (var i = 0; i < thresholds.length; i++) {
      if (co2Kg <= thresholds[i].max) {
        return { label: thresholds[i].label, class: thresholds[i].class };
      }
    }
    return { label: 'Cr\u00EDtica', class: 'critica' };
  },

  calculateEstimatedTime: function(distanceKm, mode) {
    var speeds = window.EcoTrip.config.avgSpeeds;
    var speed = speeds[mode];
    var minutes;

    if (mode === 'airplane') {
      minutes = (distanceKm / 800) * 60 + window.EcoTrip.config.airplaneExtraTime;
    } else {
      minutes = (distanceKm / speed) * 60;
    }

    return window.EcoTrip.utils.formatDuration(minutes);
  },

  generateComparison: function(distances) {
    var modes = window.EcoTrip.config.transportModes;
    var data = [];

    for (var i = 0; i < modes.length; i++) {
      var mode = modes[i];
      var d;
      if (mode.id === 'walking') {
        d = distances.walking || distances.road;
      } else if (mode.id === 'bicycle') {
        d = distances.cycling || distances.road;
      } else if (mode.id === 'airplane') {
        d = distances.geodesic;
      } else {
        d = distances.road;
      }

      var co2 = window.EcoTrip.emissions.calculateEmissions(d, mode.id);
      var time = this.calculateEstimatedTime(d, mode.id);
      var efficiency = this.getEfficiencyLabel(co2);

      data.push({
        mode: mode,
        distance: d,
        co2: co2,
        time: time,
        efficiency: efficiency
      });
    }

    return data;
  },

  getBestAlternative: function(comparisonData, selectedMode) {
    var best = null;
    var bestCo2 = Infinity;

    for (var i = 0; i < comparisonData.length; i++) {
      var item = comparisonData[i];
      if (item.co2 > 0 && item.co2 < bestCo2) {
        bestCo2 = item.co2;
        best = item;
      }
    }

    var selectedCo2 = 0;
    for (var i = 0; i < comparisonData.length; i++) {
      if (comparisonData[i].mode.id === selectedMode) {
        selectedCo2 = comparisonData[i].co2;
        break;
      }
    }

    if (best && selectedCo2 > 0 && bestCo2 < selectedCo2) {
      var reduction = ((selectedCo2 - bestCo2) / selectedCo2) * 100;
      return {
        title: 'Escolha Sustent\u00E1vel',
        message: best.mode.label + ' reduz sua pegada em ' + reduction.toFixed(0) + '% comparado a ' + window.EcoTrip.utils.getModeLabel(selectedMode) + '.'
      };
    }

    return {
      title: 'Escolha Sustent\u00E1vel',
      message: window.EcoTrip.utils.getModeLabel(selectedMode) + ' \u00E9 a op\u00E7\u00E3o mais sustent\u00E1vel dispon\u00EDvel.'
    };
  },

  generateTableRows: function(comparisonData) {
    var html = '';
    var utils = window.EcoTrip.utils;

    for (var i = 0; i < comparisonData.length; i++) {
      var item = comparisonData[i];
      html += '<tr>' +
        '<td class="mode-cell"><span class="mode-icon-sm">' + item.mode.icon + '</span> ' + item.mode.label + '</td>' +
        '<td>' + item.time + '</td>' +
        '<td>' + utils.formatNumber(item.co2, 1) + ' kg</td>' +
        '<td><span class="badge badge-' + item.efficiency.class + '">' + item.efficiency.label + '</span></td>' +
      '</tr>';
    }

    return html;
  }
};
