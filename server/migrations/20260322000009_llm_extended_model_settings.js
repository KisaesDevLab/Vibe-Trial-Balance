/**
 * Migration: Extended LLM model settings
 *
 * Adds:
 *   llm.ollama_vision_override    — 'true'/'false' manual override for vision capability
 *                                    (heuristic detection fails for new model name patterns)
 *   llm.openai_compat_fast_model  — separate fast/cheap model for OpenAI-compat provider
 *                                    (falls back to llm.openai_compat_model if blank)
 *   llm.openai_compat_vision_override — same vision override for openai-compat
 */
exports.up = async function (knex) {
  const newKeys = [
    { key: 'llm.ollama_vision_override',         value: '' },  // '' = auto-detect, 'true'/'false' = manual
    { key: 'llm.openai_compat_fast_model',        value: '' },  // blank = use primary model for both roles
    { key: 'llm.openai_compat_vision_override',   value: '' },
  ];

  for (const row of newKeys) {
    const exists = await knex('settings').where({ key: row.key }).first('key');
    if (!exists) {
      await knex('settings').insert({ key: row.key, value: row.value });
    }
  }
};

exports.down = async function (knex) {
  await knex('settings').whereIn('key', [
    'llm.ollama_vision_override',
    'llm.openai_compat_fast_model',
    'llm.openai_compat_vision_override',
  ]).delete();
};
