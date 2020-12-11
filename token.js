const promiseFetch = require('./http').promiseFetch;

const type = (val) => Object.prototype.toString.call(val).match(/\s{1}(\w+)\]/)[1].toLocaleLowerCase();

async function getLoginParams(projectName) {
    const url = 'http://hawkeye.dasouche-inc.net/api/v1/getProjectLhciSetting'
    const params = {
        projectName
    }
    const res = await promiseFetch(url, {
        method: 'GET',
        params
    });
    return res.data;
}

async function getLoginToken(projectName) {
    const loginParams = await getLoginParams(projectName);
    if (loginParams) {
        const res = await promiseFetch(loginParams.devLoginUrl, {
            method: 'POST',
            params: JSON.parse(loginParams.loginData)
        });
        let token = '';
        if (res.data && typeof res.data === 'string') {
            token = res.data;
        } else if (type(res.data) === 'object') {
            token = res.data.token;
        }
        return {
            token: res.data,
            pageUrl: loginParams.pageUrl
        };
    }
    return {};
}

module.exports = getLoginToken;
