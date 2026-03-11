process.stdin.on('data', (d) => {
  if (d.toString().trim() === 'ping') {
    process.stdout.write('pong');
    process.stderr.write('ok');
    process.exit(0);
  }
});
