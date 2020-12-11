const http = require('http');
const fetch =  require('node-fetch');
const querystring=require('querystring');

function httpRequest(opts, data) {
    return new Promise((resolve, reject) => {
        const options = Object.assign({}, {
            hostname: '',
            path: '',
            method: 'GET',
            headers: { "Content-Type": "application/x-www-form-urlencoded" }
        }, opts)

        let resData = '';
        console.log(options, 'options');
        const req = http.request(options, res => {
            res.setEncoding('utf-8');
            res.on('data',function(chun){
                resData += chun;
            });
            res.on('end',function(){
                console.log(resData, 'resData');
                resolve(resData);
            });
        })
        
        req.on('error',function(err){
            reject(err);
        });
        
        req.write(querystring.stringify(data));
        
        req.end();
    })
}

function promiseFetch(url, object) {
    const params = querystring.stringify(object.params);
    return new Promise((resolve, reject) => {
      fetch(`${url}?${params}`, {
        method: object.method,
        headers: { 'Content-Type': 'application/json' }
      })
        .then(res => res.json())
        .then(json => resolve(json))
        .catch(err => {
          reject(err);
        });
    });
  }

module.exports = {
    httpRequest,
    promiseFetch
};
