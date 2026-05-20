window.EcoTrip = window.EcoTrip || {};
window.EcoTrip.emissions = {

  calculateEmissions: function(distanceKm, mode) {
    var factors = window.EcoTrip.config.emissionFactors;
    return distanceKm * (factors[mode] || 0);
  },

  calculateCarbonCredits: function(co2Kg) {
    return Math.ceil(co2Kg / window.EcoTrip.config.creditFactor);
  },

  calculateTreesRequired: function(co2Kg) {
    return Math.ceil(co2Kg / window.EcoTrip.config.treesFactor);
  },

  calculateOffsetCost: function(credits) {
    return credits * window.EcoTrip.config.costPerCredit;
  },

  calculateAll: function(distances) {
    var modes = window.EcoTrip.config.transportModes;
    var results = {};

    for (var i = 0; i < modes.length; i++) {
      var modeId = modes[i].id;
      var distance;

      if (modeId === 'walking') {
        distance = distances.walking || distances.road;
      } else if (modeId === 'airplane') {
        distance = distances.geodesic;
      } else {
        distance = distances.road;
      }

      var co2 = this.calculateEmissions(distance, modeId);
      var credits = this.calculateCarbonCredits(co2);
      var trees = this.calculateTreesRequired(co2);
      var cost = this.calculateOffsetCost(credits);

      results[modeId] = {
        distance: distance,
        co2: co2,
        credits: credits,
        trees: trees,
        cost: cost
      };
    }

    return results;
  }
};
