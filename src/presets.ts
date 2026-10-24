import type { Language } from "./engine/types";

export interface Preset {
  id: string;
  name: string;
  lang: Language;
  code: string;
}

// One statement per line keeps the line-based tracer (skills/execution-tracing) happy.
const bubbleSort = `const arr = [5, 2, 9, 1, 7, 3, 8];
for (let i = 0; i < arr.length; i++) {
  for (let j = 0; j < arr.length - i - 1; j++) {
    if (arr[j] > arr[j + 1]) {
      let tmp = arr[j];
      arr[j] = arr[j + 1];
      arr[j + 1] = tmp;
    }
  }
}
`;

const quicksort = `function swap(a, i, j) {
  const t = a[i];
  a[i] = a[j];
  a[j] = t;
}

function partition(a, lo, hi) {
  const pivot = a[hi];
  let i = lo;
  for (let j = lo; j < hi; j++) {
    if (a[j] < pivot) {
      swap(a, i, j);
      i++;
    }
  }
  swap(a, i, hi);
  return i;
}

function quicksort(a, lo, hi) {
  if (lo >= hi) {
    return;
  }
  const p = partition(a, lo, hi);
  quicksort(a, lo, p - 1);
  quicksort(a, p + 1, hi);
}

const nums = [6, 3, 8, 1, 9, 2, 7, 4];
quicksort(nums, 0, nums.length - 1);
`;

const cForLoop = `int n = 8;
int total = 0;
for (int i = 0; i < n; i++) {
  int square = i * i;
  total += square;
  printf("%d\\n", total);
}
`;

// Deliberately buggy: i never changes, so the loop never ends.
const infiniteLoop = `let i = 0;
let total = 0;
while (i < 5) {
  total = total + i;
}
`;

const fibonacci = `function fib(n) {
  if (n < 2) {
    return n;
  }
  return fib(n - 1) + fib(n - 2);
}

const result = fib(7);
`;

export const PRESETS: readonly Preset[] = [
  { id: "bubble-sort", name: "Bubble sort", lang: "js", code: bubbleSort },
  { id: "quicksort", name: "Quicksort", lang: "js", code: quicksort },
  { id: "c-for-loop", name: "C-style for loop", lang: "c", code: cForLoop },
  { id: "infinite-loop", name: "Buggy infinite loop", lang: "js", code: infiniteLoop },
  { id: "fibonacci", name: "Recursive fibonacci", lang: "js", code: fibonacci },
];
