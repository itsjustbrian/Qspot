export const API_URL = window.location.hostname === 'localhost' ?
  'http://localhost:5000/queuespot-917af/us-central1/api' :
  'https://us-central1-queuespot-917af.cloudfunctions.net';

export const API_HEAVY_DUTY_URL = window.location.hostname === 'localhost' ?
  'http://localhost:5000/queuespot-917af/us-central1/api_heavy_duty' :
  'https://us-central1-queuespot-917af.cloudfunctions.net';