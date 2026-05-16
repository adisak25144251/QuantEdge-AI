import https from 'https';

const symbols = ['AAPL', '^DJI', '^NDX', '^GSPC', 'GC=F', 'SI=F', 'CL=F', 'BZ=F', 'DX-Y.NYB', '^FTSE', '^N225'];

symbols.forEach(sym => {
  https.get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.chart && json.chart.result) {
                console.log(`${sym}: OK`);
            } else {
                console.log(`${sym}: Error`);
            }
        } catch(e) {
             console.log(`${sym}: Parse Error ${data}`);
        }
    });
  });
});
