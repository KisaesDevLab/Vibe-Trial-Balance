/**
 * Migration: MCP Support
 * - Adds mcp_token row to settings table (nullable)
 * - Adds mcp_agent system user (password_hash='!' so it can never log in)
 */

exports.up = async function (knex) {
  // Add mcp_agent user if it doesn't exist
  const existing = await knex('app_users').where({ username: 'mcp_agent' }).first('id');
  if (!existing) {
    await knex('app_users').insert({
      username: 'mcp_agent',
      display_name: 'MCP Agent',
      password_hash: '!', // Cannot log in — invalid bcrypt hash
      role: 'staff',
    });
  }
};

exports.down = async function (knex) {
  await knex('app_users').where({ username: 'mcp_agent' }).delete();
  await knex('settings').where({ key: 'mcp_token' }).delete();
};
