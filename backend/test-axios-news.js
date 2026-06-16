const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });
axios.get('https://news.google.com/rss/search?q=OpenAI+when:1d', { 
  httpsAgent: agent,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  }
})
  .then(r => console.log(r.data.substring(0,200)))
  .catch(e => console.log(e.message));
