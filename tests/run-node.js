import { runTests } from './math.test.js';

const { fail } = runTests();
process.exit(fail ? 1 : 0);
