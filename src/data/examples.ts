export interface CodeExample {
  id: string;
  title: string;
  description: string;
  code: string;
}

export const codeExamples: CodeExample[] = [
  {
    id: "basic-timers",
    title: "Basic Timers",
    description: "setTimeout vs setImmediate execution order",
    code: `setTimeout(() => console.log('timeout 1'), 0);
setTimeout(() => console.log('timeout 2'), 100);
setImmediate(() => console.log('immediate'));`,
  },
  {
    id: "microtasks-priority",
    title: "Microtasks Priority",
    description: "nextTick and Promise execution before macrotasks",
    code: `setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));
Promise.resolve().then(() => console.log('promise'));
process.nextTick(() => console.log('nextTick'));`,
  },
  {
    id: "io-callbacks",
    title: "I/O Callbacks",
    description: "File system operations in poll phase",
    code: `fs.readFile('file.txt', () => {
  console.log('file read');
  setImmediate(() => console.log('immediate in I/O'));
  setTimeout(() => console.log('timeout in I/O'), 0);
});`,
  },
  {
    id: "setimmediate-io-cycle",
    title: "setImmediate in I/O Cycle",
    description:
      "setImmediate always executes before setTimeout(0) in I/O callbacks",
    code: `fs.readFile('file.txt', () => {
  setImmediate(() => console.log('immediate'));
  setTimeout(() => console.log('timeout'), 0);
});`,
  },
  {
    id: "mixed-operations",
    title: "Mixed Async Operations",
    description: "Complex example with multiple async operations",
    code: `console.log('start');

setTimeout(() => console.log('timeout 1'), 0);
setTimeout(() => console.log('timeout 2'), 100);

setImmediate(() => {
  console.log('immediate 1');
  process.nextTick(() => console.log('nextTick in immediate'));
});

Promise.resolve().then(() => {
  console.log('promise 1');
  Promise.resolve().then(() => console.log('promise 2'));
});

process.nextTick(() => {
  console.log('nextTick 1');
  process.nextTick(() => console.log('nextTick 2'));
});

console.log('end');`,
  },
];

export const getExampleById = (id: string): CodeExample | undefined => {
  return codeExamples.find((example) => example.id === id);
};

export const getExampleTitles = (): Array<{ id: string; title: string }> => {
  return codeExamples.map((example) => ({
    id: example.id,
    title: example.title,
  }));
};
