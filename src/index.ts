import 'reflect-metadata';

import Application from './application';

export const PRODUCTION = process.env.NODE_ENV === 'production';

export let application: Application;

async function main() {
  application = new Application();
  await application.connect();
  await application.seedDb();
  await application.init();
}

main();
