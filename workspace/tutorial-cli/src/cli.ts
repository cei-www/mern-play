#!/usr/bin/env node
import readline from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { createIo } from './checks/io.js';
import { runStepChecks } from './checks/index.js';
import { loadConfig, type CliConfig } from './config.js';
import { CliError, gotoStep, resetDb, resettableDatabases, resolveModule, wipe } from './commands.js';

const HELP = `tutorial: helper commands for the course

Usage
  tutorial wipe [--scope steps|all|<zone,zone>]   Replace the code of the course app with TODO stubs
  tutorial goto <step>                            Set the files to the starting point of a step (example: tutorial goto 2.3)
  tutorial reset <step>                           Same as goto: restore the files of a step
  tutorial reset-db [database|all]                Reset a database to the seed data
  tutorial check <step>                           Check your work for a step (example: tutorial check 0.4)

Options
  --module <name>   Module to use (default: the module folder you are in)
  --yes             Do not ask for confirmation
`;

async function confirm(question: string, assumeYes: boolean): Promise<boolean> {
  if (assumeYes) return true;
  if (!process.stdin.isTTY) throw new CliError('This command asks for confirmation. Run it in a terminal or add --yes.');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^y(es)?$/i.test((await rl.question(`${question} [y/N] `)).trim());
  } finally {
    rl.close();
  }
}

async function run(argv: string[], config: CliConfig): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      module: { type: 'string' },
      scope: { type: 'string' },
      yes: { type: 'boolean', short: 'y', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  const [command, ...rest] = positionals;
  if (!command || values.help || command === 'help') {
    console.log(HELP);
    return;
  }

  switch (command) {
    case 'wipe': {
      const module = resolveModule(config, process.cwd(), values.module);
      const scope = values.scope === undefined || values.scope === 'steps' || values.scope === 'all' ? values.scope : values.scope.split(',');
      if (!(await confirm(`This replaces your code in module "${module}" with TODO stubs (files and database stay). Continue?`, values.yes))) {
        console.log('Cancelled. Nothing was changed.');
        return;
      }
      const result = wipe(config, module, { scope });
      if (result.files.length === 0) console.log('Nothing to wipe: the code is already cleared.');
      for (const f of result.files) console.log(`  cleared ${f.zones.join(', ')} in ${f.path}`);
      return;
    }

    case 'goto':
    case 'reset': {
      const step = rest[0];
      if (!step) throw new CliError(`Which step? Example: tutorial ${command} 2.3`);
      const module = resolveModule(config, process.cwd(), values.module);
      if (!(await confirm(`This overwrites the files of step ${step} in module "${module}" (your exercise work is kept). Continue?`, values.yes))) {
        console.log('Cancelled. Nothing was changed.');
        return;
      }
      const result = gotoStep(config, module, step);
      for (const f of result.written) console.log(`  restored ${f}`);
      console.log(result.written.length === 0 ? `Step ${step} is already in place.` : `Done. Your files are at the starting point of step ${step}.`);
      return;
    }

    case 'reset-db': {
      const available = resettableDatabases(config);
      const target = rest[0] ?? (available.includes('taskapp') ? 'taskapp' : available[0]);
      if (!target) throw new CliError('This workspace cannot reset databases.');
      const targets = target === 'all' ? available : [target];
      if (!(await confirm(`This deletes all data in ${targets.join(', ')} and restores the seed data. Continue?`, values.yes))) {
        console.log('Cancelled. Nothing was changed.');
        return;
      }
      for (const db of targets) {
        await resetDb(config, db);
        console.log(`  reset ${db}`);
      }
      return;
    }

    case 'check': {
      const step = rest[0];
      if (!step) throw new CliError('Which step? Example: tutorial check 0.4');
      const module = resolveModule(config, process.cwd(), values.module);
      const report = await runStepChecks(config, module, step, createIo(config));
      console.log(`Checking step ${report.step.id}: ${report.step.title}\n`);
      if (report.results.length === 0) {
        console.log('This step has nothing to check. When you are ready, press "Mark as done" on the tutorial page.');
        return;
      }
      for (const r of report.results) {
        console.log(`  ${r.passed ? '\u2714' : '\u2716'} ${r.message}`);
        for (const line of r.detail ?? []) console.log(`      - ${line}`);
      }
      const failed = report.results.filter((r) => !r.passed).length;
      console.log('');
      if (failed === 0) {
        console.log('All checks passed. Go back to the tutorial and press "Mark as done".');
        return;
      }
      console.log(`${failed} of ${report.results.length} checks did not pass. Fix the first problem, save, and run "tutorial check ${report.step.id}" again.`);
      process.exitCode = 1;
      return;
    }

    default:
      throw new CliError(`Unknown command "${command}". Run "tutorial help" to see the commands.`);
  }
}

run(process.argv.slice(2), loadConfig()).catch((err: unknown) => {
  if (err instanceof CliError) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
  if (err instanceof Error && err.name === 'TypeError' && 'code' in err) {
    // parseArgs problems (unknown option and similar)
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
  console.error(err);
  process.exit(2);
});
