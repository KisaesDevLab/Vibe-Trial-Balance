/**
 * Migration: LLM provider settings keys
 *
 * Adds settings keys for Ollama and OpenAI-compatible provider support.
 * Existing keys (claude_api_key, ai_model_fast, ai_model_primary) are unchanged.
 */
exports.up = async function (knex) {
  const defaults = [
    { key: 'llm.provider',               value: 'claude'  }, // 'claude' | 'ollama' | 'openai-compat'
    { key: 'llm.ollama_base_url',         value: ''        },
    { key: 'llm.ollama_vision_model',     value: 'qwen3-vl:8b' },
    { key: 'llm.ollama_reasoning_model',  value: 'qwq:32b' },
    { key: 'llm.openai_compat_base_url',  value: ''        },
    { key: 'llm.openai_compat_api_key',   value: ''        },
    { key: 'llm.openai_compat_model',     value: ''        },
    { key: 'llm.timeout_ms',              value: '120000'  },
  ];

  for (const row of defaults) {
    const exists = await knex('settings').where({ key: row.key }).first('key');
    if (!exists) {
      await knex('settings').insert({ key: row.key, value: row.value });
    }
  }
};

exports.down = async function (knex) {
  await knex('settings').whereIn('key', [
    'llm.provider',
    'llm.ollama_base_url',
    'llm.ollama_vision_model',
    'llm.ollama_reasoning_model',
    'llm.openai_compat_base_url',
    'llm.openai_compat_api_key',
    'llm.openai_compat_model',
    'llm.timeout_ms',
  ]).delete();
};
