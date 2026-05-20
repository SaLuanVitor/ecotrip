window.EcoTrip = window.EcoTrip || {};

window.EcoTrip.config = {
  CONTACT_EMAIL: 'your-email@example.com',
  GEOCODE_DEBOUNCE_MS: 400,
  REQUEST_TIMEOUT_MS: 10000,

  emissionFactors: {
    walking: 0,
    bicycle: 0,
    motorcycle: 0.103,
    car: 0.192,
    bus: 0.105,
    truck: 0.800,
    airplane: 0.255
  },

  avgSpeeds: {
    walking: 5,
    bicycle: 18,
    motorcycle: 70,
    car: 80,
    bus: 60,
    truck: 50,
    airplane: 800
  },

  transportModes: [
    { id: 'walking',    label: 'A p\u00E9',       icon: '\u{1F6B6}' },
    { id: 'bicycle',    label: 'Bicicleta',  icon: '\u{1F6B2}' },
    { id: 'motorcycle', label: 'Moto',       icon: '\u{1F3CD}' },
    { id: 'car',        label: 'Carro',      icon: '\u{1F697}' },
    { id: 'bus',        label: '\u00D4nibus',  icon: '\u{1F68C}' },
    { id: 'truck',      label: 'Caminh\u00E3o', icon: '\u{1F69B}' },
    { id: 'airplane',   label: 'Avi\u00E3o',   icon: '\u2708' }
  ],

  efficiencyThresholds: [
    { max: 0,    label: 'Excelente',  class: 'excelente' },
    { max: 10,   label: 'Muito Boa',  class: 'muito-boa' },
    { max: 25,   label: 'Boa',        class: 'boa' },
    { max: 50,   label: 'M\u00E9dia',   class: 'media' },
    { max: 100,  label: 'Baixa',      class: 'baixa' },
    { max: Infinity, label: 'Cr\u00EDtica', class: 'critica' }
  ],

  creditFactor: 1000,
  treesFactor: 21,
  costPerCredit: 50,
  airplaneExtraTime: 60,

  modeHelpTexts: {
    walking: 'Rota otimizada para pedestres.',
    bicycle: 'Rota otimizada para ciclistas.',
    motorcycle: 'Usa a malha vi\u00E1ria padr\u00E3o com emiss\u00F5es de motocicleta.',
    car: 'Rota rodovi\u00E1ria padr\u00E3o.',
    bus: 'Usa dist\u00E2ncia rodovi\u00E1ria para estimativa ambiental.',
    truck: 'Usa dist\u00E2ncia rodovi\u00E1ria para transporte de carga.',
    airplane: 'Calcula dist\u00E2ncia em linha reta entre origem e destino.'
  }
};
