const NodeGeocoder = require('node-geocoder');

const options = {
  provider: 'openstreetmap',
  // Optionally, you can add httpAdapter, apiKey, formatter, etc.
};

const geocoder = NodeGeocoder(options);

module.exports = geocoder;