#!/usr/bin/env node

'use strict';

const yargs = require('yargs');
const pkg = require('./package.json');
const collectCmd = require('./collect');
async function run() {
    /** @type {any} */
    const argv = yargs
        .help('help')
        .version(pkg.version)
        .usage('lhpci <command> <options>')
        .env('LHPCI')
        .demand(1)
        .command('collect', 'Run Lighthouse and save the results to a local folder', commandYargs =>
            collectCmd.buildCommand(commandYargs)
        ).argv
    console.log('argvargv', argv._);
    if (argv._[0] === 'collect') {
        await collectCmd.runCommand(argv);
    } else {
        throw new Error(`Unrecognized command ${argv._[0]}`);
    }
  
    process.exit(0);
}
  
run().catch(err => {
    process.stderr.write(err.stack);
    if (err.stdout) process.stderr.write('\n' + err.stdout.slice(0, 4000));
    if (err.stderr) process.stderr.write('\n' + err.stderr);
    process.exit(1);
});

