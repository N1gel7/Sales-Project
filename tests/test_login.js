import handler from '../api/login.js';

const req = {
  method: 'POST',
  body: {
    email: 'rep1@example.com',
    password: 'Rep#123'
  }
};

const res = {
  status: (code) => {
    console.log('Status:', code);
    return res;
  },
  json: (data) => {
    console.log('JSON:', JSON.stringify(data, null, 2));
    return res;
  }
};

handler(req, res).catch(err => console.error('Caught error:', err));
