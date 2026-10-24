import type { Language } from "./engine/types";

export interface Preset {
  id: string;
  name: string;
  lang: Language;
  code: string;
}

// The first four are the exact programs from the original sound test, so they play the songs the
// project was chosen on. The AST tracer handles several statements on one line.
const bubbleSort = `let arr = [5, 2, 8, 1, 9, 3, 7, 4];
let n = arr.length;
for (let i = 0; i < n - 1; i++) {
  for (let j = 0; j < n - i - 1; j++) {
    if (arr[j] > arr[j + 1]) {
      let tmp = arr[j];
      arr[j] = arr[j + 1];
      arr[j + 1] = tmp;
    }
  }
}
`;

const quicksort = `let arr = [5, 2, 8, 1, 9, 3, 7, 4];
function quickSort(a, lo, hi) {
  if (lo >= hi) return;
  let p = a[hi];
  let i = lo;
  for (let j = lo; j < hi; j++) {
    if (a[j] < p) {
      let t = a[i]; a[i] = a[j]; a[j] = t;
      i++;
    }
  }
  let t = a[i]; a[i] = a[hi]; a[hi] = t;
  quickSort(a, lo, i - 1);
  quickSort(a, i + 1, hi);
}
quickSort(arr, 0, arr.length - 1);
`;

const cForLoop = `int n = 8;
int total = 0;
for (int i = 0; i < n; i++) {
  if (i % 2 == 0) {
    total = total + i;
  } else {
    total = total - 1;
  }
}
`;

// Deliberately buggy: i never changes, so the loop never ends.
const infiniteLoop = `let i = 0;
while (i < 5) {
  console.log(i);
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
