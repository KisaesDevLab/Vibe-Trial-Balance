module.exports = {
  apps: [{
    name: 'vibe-tb-server',
    script: 'server/dist/app.js',
    cwd: '/opt/vibe-tb',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
    error_file: '/var/log/vibe-tb/error.log',
    out_file: '/var/log/vibe-tb/out.log',
    merge_logs: true,
    restart_delay: 3000,
    max_restarts: 10,
  }]
};
