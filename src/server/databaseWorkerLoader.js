/**
 * Worker Loader (CommonJS)
 *
 * This loader requires tsx at runtime to enable TypeScript support
 * in the worker thread during development.
 */

// Register tsx for TypeScript support in CommonJS mode
require('tsx/cjs');

// Load and re-export the TypeScript worker
module.exports = require('./databaseWorker.ts');
