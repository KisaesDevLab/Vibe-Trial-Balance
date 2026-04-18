/**
 * Migration: OCR provider selector
 *
 * Adds llm.ocr_provider to switch the OCR backend between:
 *   - 'llamacpp'      → llama.cpp server's OpenAI-compatible /v1/chat/completions
 *   - 'ollama-openai' → Ollama's OpenAI-compatible /v1/chat/completions
 *
 * Both providers use the same OpenAI chat-completions wire format, so a single
 * client implementation serves both. The prior Ollama-native /api/generate path
 * is retired in favor of the OpenAI-compatible endpoint.
 */
exports.up = async function (knex) {
  const defaults = [
    { key: 'llm.ocr_provider', value: 'llamacpp' },
  ];

  for (const row of defaults) {
    const exists = await knex('settings').where({ key: row.key }).first('key');
    if (!exists) {
      await knex('settings').insert({ key: row.key, value: row.value });
    }
  }
};

exports.down = async function (knex) {
  await knex('settings').whereIn('key', ['llm.ocr_provider']).delete();
};
