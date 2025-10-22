/**
 * Tests for sanitize module
 */

import { test } from "node:test";
import assert from "node:assert";
import { sanitizeText, normalizeForLookup } from "../sanitize.js";

test("sanitizeText removes BOM", () => {
  const input = "\uFEFFHello World";
  const result = sanitizeText(input);
  assert.strictEqual(result, "Hello World");
});

test("sanitizeText replaces NBSP with space", () => {
  const input = "Hello\u00A0World";
  const result = sanitizeText(input);
  assert.strictEqual(result, "Hello World");
});

test("sanitizeText removes zero-width characters", () => {
  const input = "Hello\u200B\u200C\u200DWorld";
  const result = sanitizeText(input);
  assert.strictEqual(result, "HelloWorld");
});

test("sanitizeText normalizes line endings", () => {
  const input = "Line1\r\nLine2\rLine3";
  const result = sanitizeText(input);
  assert.strictEqual(result, "Line1\nLine2\nLine3");
});

test("sanitizeText replaces smart quotes", () => {
  const input = "\u2018Hello\u2019 \u201CWorld\u201D";
  const result = sanitizeText(input);
  assert.strictEqual(result, "'Hello' \"World\"");
});

test("normalizeForLookup converts to lowercase", () => {
  const input = "Software Development";
  const result = normalizeForLookup(input);
  assert.strictEqual(result, "software development");
});

test("normalizeForLookup trims whitespace", () => {
  const input = "  Software Development  ";
  const result = normalizeForLookup(input);
  assert.strictEqual(result, "software development");
});

