import * as S from "fp-ts/lib/ReadonlySet";
import * as A from "fp-ts/lib/ReadonlyArray";
import * as M from "fp-ts/lib/ReadonlyMap";
import * as R from "fp-ts/lib/Record";
import * as Eq from "fp-ts/lib/Eq";
import * as O from "fp-ts/lib/Option";
import * as IO from "fp-ts/lib/IO";
import { Show } from "fp-ts/lib/Show";
import now from "performance-now";
import {
  Monoid,
  getTupleMonoid,
  getStructMonoid,
  monoidAll,
  monoidSum
} from "fp-ts/lib/Monoid";
import { getLastSemigroup } from "fp-ts/lib/Semigroup";
import { pipe, identity } from "fp-ts/lib/function";
import { random } from "fp-ts/lib/Random";

const NUMBER_OF_ITEMS = 100000;

const testArray = pipe(Array.from({ length: NUMBER_OF_ITEMS }), A.map(random));
const testSet = pipe(testArray, S.fromArray(Eq.eqNumber));
const testMap = pipe(
  new Map(
    pipe(
      testArray,
      A.map(val => [String(val), val])
    )
  ),
  M.fromMap
);
const testRecord = R.fromFoldableMap(
  getLastSemigroup<number>(),
  A.readonlyArray
)(testArray, key => [String(key), key]);

const testValue = pipe(
  testArray,
  A.last,
  O.fold(() => -1, identity)
);

const runTestArray: IO.IO<boolean> = () => testArray.includes(testValue);
const runTestSet: IO.IO<boolean> = () => testSet.has(testValue);
const runTestMap: IO.IO<boolean> = () => testMap.has(String(testValue));
const runTestRecord: IO.IO<boolean> = () => pipe(testRecord[String(testValue)], Boolean);

const timeTestK = (io: IO.IO<boolean>): IO.IO<[boolean, number]> => () => {
  const startTime = now();
  const result = io();
  const endTime = now();
  return [result, endTime - startTime];
};

type TimedTest = [boolean, number];

interface TestResults {
  array: TimedTest;
  set: TimedTest;
  map: TimedTest;
  record: TimedTest;
}

const runTest: IO.IO<TestResults> = pipe(
  IO.Do,
  IO.bind("array", () => timeTestK(runTestArray)),
  IO.bind("set", () => timeTestK(runTestSet)),
  IO.bind("map", () => timeTestK(runTestMap)),
  IO.bind("record", () => timeTestK(runTestRecord))
);

const monoidTestResults: Monoid<TestResults> = getStructMonoid({
  array: getTupleMonoid(monoidAll, monoidSum),
  set: getTupleMonoid(monoidAll, monoidSum),
  map: getTupleMonoid(monoidAll, monoidSum),
  record: getTupleMonoid(monoidAll, monoidSum)
});

const NUMBER_OF_TRIALS = 10000;

const program: IO.IO<TestResults> = () =>
  pipe(
    Array.from({ length: NUMBER_OF_TRIALS }),
    A.reduce(monoidTestResults.empty, acc => monoidTestResults.concat(acc, runTest()))
  );

const showTestResults: Show<TestResults> = {
  show: ({ array: [, array], set: [, set], map: [, map], record: [, record] }) =>
    `  Array average: ${array / NUMBER_OF_TRIALS}ms
  Set average: ${set / NUMBER_OF_TRIALS}ms
  Map Average: ${map / NUMBER_OF_TRIALS}ms
  Record Average: ${record / NUMBER_OF_TRIALS}ms`
};

console.log(pipe(program(), showTestResults.show));
