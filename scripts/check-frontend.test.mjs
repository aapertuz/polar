import test from "node:test";
import assert from "node:assert/strict";
import { analyze } from "./check-frontend.mjs";
const file = "/repo/native/src/pages/home/components/Example.tsx";
test("frontend checker rejects local relative imports", () =>
  assert.ok(
    analyze(file, 'import { Icon } from "../../../components/ui/Icon";').some((item) =>
      item.includes("Use an @/ alias"),
    ),
  ));
test("frontend checker rejects inline handlers", () =>
  assert.ok(
    analyze(file, "export const Example = () => <button onClick={(event) => save(event)} />;").some(
      (item) => item.includes("named handler"),
    ),
  ));
test("frontend checker rejects inline ref callbacks", () =>
  assert.ok(
    analyze(file, "export const Example = () => <button ref={(node) => save(node)} />;").some(
      (item) => item.includes("ref callback"),
    ),
  ));
test("frontend checker permits named handlers and simple rendering", () =>
  assert.deepEqual(
    analyze(
      file,
      'import { Icon } from "@/components/ui/Icon"; export const Example = ({items, onClick}) => <>{items.map(item => <Icon key={item.id} onClick={onClick} />)}{items.length ? <span/> : null}</>;',
    ),
    [],
  ));
test("frontend checker rejects overlay switch rendering", () =>
  assert.ok(
    analyze(file, "switch (request.kind) { case 'search': return <input/>; }").some((item) =>
      item.includes("overlayRegistry"),
    ),
  ));
test("frontend checker rejects component state hooks and follows imported aliases", () =>
  assert.ok(
    analyze(
      file,
      'import { useState as usePanelState } from "react"; export function Example(){ usePanelState(0); return <div/>; }',
    ).some((item) => item.includes("through one focused master hook")),
  ));
test("frontend checker requires one master hook per behavioral component", () =>
  assert.ok(
    analyze(
      file,
      'import { useSelection, useTimeline } from "@/hooks"; export function Example(){ useSelection(); useTimeline(); return <div/>; }',
    ).some((item) => item.includes("one master hook")),
  ));
test("frontend checker permits one master hook in a component", () =>
  assert.deepEqual(
    analyze(
      file,
      'import { useScreen } from "@/hooks"; export function Example(){ useScreen(); return <div/>; }',
    ),
    [],
  ));
test("frontend checker rejects JSX-returning switches and IIFEs", () => {
  assert.ok(
    analyze(file, "function Example(){ switch (mode) { case 'a': return <div/>; } }").some((item) =>
      item.includes("JSX-returning switch"),
    ),
  );
  assert.ok(
    analyze(file, "function Example(){ return (() => <div/>)(); }").some((item) =>
      item.includes("immediately invoked"),
    ),
  );
});
