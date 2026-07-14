import { createServer } from 'http';

const server = createServer((req, res) => {
  console.log('Request received:', req.method, req.url);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Server is running', timestamp: new Date().toISOString() }));
});

server.listen(4000, () => {
  console.log('🚀 HTTP server running at http://localhost:4000');
  console.log('Test: curl http://localhost:4000');
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});