import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAiCopilotResponse, validateAiContents, type AiContent } from './aiCopilot';

const validContents: AiContent[] = [
  { role: 'user', parts: [{ text: 'Analyze BTCUSDT with risk controls.' }] }
];

test('validateAiContents accepts bounded user and model messages', () => {
  assert.equal(validateAiContents(validContents), true);
});

test('validateAiContents rejects empty or oversized payloads', () => {
  assert.equal(validateAiContents([]), false);
  assert.equal(validateAiContents([{ role: 'assistant', parts: [{ text: 'bad role' }] }]), false);
  assert.equal(validateAiContents([{ role: 'user', parts: [{ text: 'x'.repeat(12_001) }] }]), false);
});

test('buildAiCopilotResponse reports missing server key without calling the model', async () => {
  const result = await buildAiCopilotResponse(validContents, '', async () => {
    throw new Error('should not call model');
  });

  assert.equal(result.status, 503);
  assert.equal(result.body.error?.includes('GEMINI_API_KEY'), true);
});

test('buildAiCopilotResponse returns generated text for a valid request', async () => {
  const result = await buildAiCopilotResponse(validContents, 'test-key', async contents => {
    assert.equal(contents[0].parts[0].text, 'Analyze BTCUSDT with risk controls.');
    return 'Educational analysis response.';
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.text, 'Educational analysis response.');
});

test('buildAiCopilotResponse converts provider errors to a controlled 502', async () => {
  const result = await buildAiCopilotResponse(validContents, 'test-key', async () => {
    throw new Error('provider unavailable');
  });

  assert.equal(result.status, 502);
  assert.equal(result.body.error, 'AI backend request failed.');
});
