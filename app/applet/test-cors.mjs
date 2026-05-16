import https from 'https';

https.get('https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=15m', (res) => {
  console.log('headers:', res.headers);
});
