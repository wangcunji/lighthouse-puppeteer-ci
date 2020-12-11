const puppeteer = require('puppeteer');
const lighthouse = require('lighthouse');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {URL} = require('url');
const {
    runCommandAndWaitForPattern,
    killProcessTree,
} = require('./child-process-helper.js');
const getLoginToken = require('./token');
const buildFolder = [
    'dist',
    'build',
    'lib'
];

/**
 * @param {import('yargs').Argv} yargs
 */
function buildCommand(yargs) {
    return yargs.options({
        method: {type: 'string', choices: ['node'], default: 'node'},
        headful: {type: 'boolean', description: 'Run with a headful Chrome'},
        additive: {type: 'boolean', description: 'Skips clearing of previous collect data'},
        port: {
            default: '12306'
        },
        url: {
            description:
            'A URL to run Lighthouse on. Use this flag multiple times to evaluate multiple URLs.',
        },
        reportDir: {
            description: 'The report directory',
            default: 'lhreport'
        },
        startServerCommand: {
            description: 'The command to run to start the server.',
        },
        startServerReadyPattern: {
            description: 'String pattern to listen for started server.',
            type: 'string',
            default: 'listen|ready',
        },
        settings: {description: 'The Lighthouse settings and flags to use when collecting'},
        numberOfRuns: {
            alias: 'n',
            description: 'The number of times to run Lighthouse.',
            default: 3,
            type: 'number',
        },
    });
}

function findBuildDir() {
    for (const dir of buildFolder) {
        const fullDirPath = path.join(process.cwd(), dir);
        if (!fs.existsSync(fullDirPath)) continue;
        if (!fs.statSync(fullDirPath).isDirectory()) continue;
        const contents = fs.readdirSync(fullDirPath);
        if (contents.some(file => file.endsWith('.html'))) {
            process.stdout.write(`Automatically determined ./${dir} as \`staticDistDir\`.\n`);
            process.stdout.write(`Set it explicitly in lighthouserc.json if incorrect.\n\n`);
            return `./${dir}/`;
        }
    }

    throw new Error('Unable to determine `staticDistDir`; Set it explicitly in lighthouserc.json');
}

async function startServerAndDetermineUrls(options) {
    let close = async () => undefined;
    let startServerCommand = options.startServerCommand ? options.startServerCommand : `http-server-spa ${findBuildDir()} index.html`;
    startServerCommand += ` ${options.port}`;
    const regexPattern = new RegExp(options.startServerReadyPattern, 'i');
    const {child, patternMatch, stdout, stderr} = await runCommandAndWaitForPattern(
        startServerCommand,
        regexPattern,
        {timeout: 10000}
    );
    process.stdout.write(`Started a web server with "${startServerCommand}"...\n`);
    close = () => killProcessTree(child.pid);

    if (!patternMatch) {
        // This is only for readability.
        const message = `Ensure the server prints a pattern that matches ${regexPattern} when it is ready.\n`;
        process.stdout.write(`WARNING: Timed out waiting for the server to start listening.\n`);
        process.stdout.write(`         ${message}`);
        if (process.env.CI) process.stderr.write(`\nServer Output:\n${stdout}\n${stderr}\n`);
    }
  
      return close;
}

async function runCommand (options) {
    const close = await startServerAndDetermineUrls(options);

    let url = options.url;

    const packagePath = path.join(process.cwd(), 'package.json');
    let projectName = '';
    let settingData = {};
    if (fs.existsSync(packagePath)) {
        const packageInfo = fs.readFileSync(packagePath, 'utf-8');
        projectName = JSON.parse(packageInfo).name;
        settingData = await getLoginToken(projectName);
        if (settingData && settingData.pageUrl) {
            url += settingData.pageUrl;
        }
    }

    
    // Use Puppeteer to launch headful Chrome and don't use its default 800x600 viewport.
    const browser = await puppeteer.launch({
        defaultViewport: null,
        args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox']
    });
    
    // Wait for Lighthouse to open url, then customize network conditions.
    // Note: this will re-establish these conditions when LH reloads the page. Think that's ok....
    browser.on('targetchanged', async target => {
        const page = await target.page();

        function addStyleContent(content) {
            const style = document.createElement('style');
            style.type = 'text/css';
            style.appendChild(document.createTextNode(content));
            document.head.appendChild(style);
        }
        
        const css = '* {color: red}';
        
        if (page && page.url() === url) {
            // 设置登录cookie
            console.log('settingDatasettingData', settingData);
            if (settingData && settingData.token) {
                const cookies = [
                    {
                        name: 'lhtoken',
                        value: settingData.token
                    }
                ];
                await page.setCookie(...cookies);
                console.log('设置登录token成功！');
            }
            // Note: can't use page.addStyleTag due to github.com/GoogleChrome/puppeteer/issues/1955.
            // Do it ourselves.
            const client = await page.target().createCDPSession();
            await client.send('Runtime.evaluate', {
                expression: `(${addStyleContent.toString()})('${css}')`
            });
        }
    });
    
    // Lighthouse will open URL. Puppeteer observes `targetchanged` and sets up network conditions.
    // Possible race condition.
    const result = await lighthouse(url, {
        port: (new URL(browser.wsEndpoint())).port,
        output: 'html',
        logLevel: 'info',
    });

    const reportDir = options.reportDir;
    const times = new Date().getTime();

    if (!fs.existsSync(path.join(process.cwd(), reportDir))) {
        execSync(`mkdir ${reportDir}`);
    }

    fs.writeFileSync(`${reportDir}/lhpci-${times}-${projectName}.json`, JSON.stringify(result.lhr));
    fs.writeFileSync(`${reportDir}/lhpci-${times}-${projectName}.html`, result.report);
    
    process.stdout.write(`Lighthouse Done`)

    await close();
    await browser.close();
}

module.exports = {buildCommand, runCommand};
