(function () {
  'use strict';

  var mapInstance = null;
  var routeLayer = null;
  var markerLayer = null;
  var routePolyline = null;
  var geocodeCache = {};

  var osrmProfiles = {
    walking: 'foot',
    bicycle: 'cycling',
    motorcycle: 'driving',
    car: 'driving',
    bus: 'driving',
    truck: 'driving'
  };

  var mapAPI = {
    init: function (containerId) {
      return new Promise(function (resolve) {
        mapInstance = L.map(containerId, {
          center: [-14, -55],
          zoom: 4,
          zoomControl: true,
          attributionControl: true
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19
        }).addTo(mapInstance);

        routeLayer = L.layerGroup().addTo(mapInstance);
        markerLayer = L.layerGroup().addTo(mapInstance);

        resolve(mapInstance);
      });
    },

    clearGeocodeCache: function () {
      geocodeCache = {};
    },

    geocodeAddress: function (address) {
      var utils = window.EcoTrip.utils;
      var config = window.EcoTrip.config;
      var cacheKey = address.toLowerCase().trim();

      if (geocodeCache[cacheKey]) {
        return Promise.resolve(geocodeCache[cacheKey]);
      }

      return new Promise(function (resolve, reject) {
        var email = config.CONTACT_EMAIL || 'your-email@example.com';
        var url =
          'https://nominatim.openstreetmap.org/search' +
          '?format=jsonv2' +
          '&q=' + encodeURIComponent(address) +
          '&limit=5' +
          '&addressdetails=1' +
          '&email=' + encodeURIComponent(email);

        utils.retryFetch(url, {
          headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          }
        }, 2, config.REQUEST_TIMEOUT_MS)
          .then(function (data) {
            if (data && data.length > 0) {
              var result = {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon),
                address: data[0].display_name
              };
              geocodeCache[cacheKey] = result;
              resolve(result);
            } else {
              reject(new Error('Endere\u00E7o n\u00E3o encontrado: ' + address));
            }
          })
          .catch(reject);
      });
    },

    calculateRoute: function (origin, dest, mode) {
      var utils = window.EcoTrip.utils;
      var config = window.EcoTrip.config;

      var profile = osrmProfiles[mode] || 'driving';

      var url =
        'https://router.project-osrm.org/route/v1/' +
        profile +
        '/' +
        origin.lng +
        ',' +
        origin.lat +
        ';' +
        dest.lng +
        ',' +
        dest.lat +
        '?overview=full&geometries=geojson&steps=false';

      return utils.retryFetch(url, {}, 2, config.REQUEST_TIMEOUT_MS)
        .then(function (data) {
          if (
            data &&
            data.code === 'Ok' &&
            data.routes &&
            data.routes.length > 0
          ) {
            var route = data.routes[0];
            var coords = route.geometry.coordinates.map(function (c) {
              return [c[1], c[0]];
            });
            return {
              distance: route.distance / 1000,
              duration: route.duration / 60,
              geometry: coords
            };
          } else {
            throw new Error('Nenhuma rota encontrada');
          }
        });
    },

    geodesicDistance: function (lat1, lon1, lat2, lon2) {
      var R = 6371;
      var dLat = ((lat2 - lat1) * Math.PI) / 180;
      var dLon = ((lon2 - lon1) * Math.PI) / 180;
      var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    },

    drawRoute: function (geometry) {
      if (!routeLayer) return;
      routeLayer.clearLayers();
      if (!geometry || geometry.length < 2) return;

      routePolyline = L.polyline(geometry, {
        color: '#16A34A',
        weight: 4,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round'
      });
      routeLayer.addLayer(routePolyline);
    },

    addMarkers: function (origin, dest) {
      if (!markerLayer) return;
      markerLayer.clearLayers();

      if (origin) {
        var origMarker = L.circleMarker([origin.lat, origin.lng], {
          color: '#16A34A',
          fillColor: '#16A34A',
          fillOpacity: 1,
          radius: 8,
          weight: 2,
          className: 'marker-origin'
        });
        origMarker.bindTooltip('Origem', { direction: 'top' });
        markerLayer.addLayer(origMarker);
      }

      if (dest) {
        var destMarker = L.circleMarker([dest.lat, dest.lng], {
          color: '#DC2626',
          fillColor: '#DC2626',
          fillOpacity: 1,
          radius: 8,
          weight: 2,
          className: 'marker-dest'
        });
        destMarker.bindTooltip('Destino', { direction: 'top' });
        markerLayer.addLayer(destMarker);
      }
    },

    fitToExtent: function (origin, dest) {
      if (!mapInstance || !origin || !dest) return;
      var bounds = L.latLngBounds(
        [origin.lat, origin.lng],
        [dest.lat, dest.lng]
      );
      mapInstance.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    },

    invalidateSize: function () {
      if (mapInstance) {
        mapInstance.invalidateSize();
      }
    },

    clearMap: function () {
      if (routeLayer) routeLayer.clearLayers();
      if (markerLayer) markerLayer.clearLayers();
      routePolyline = null;
    }
  };

  window.EcoTripMap = mapAPI;
})();
