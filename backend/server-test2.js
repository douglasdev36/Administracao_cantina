import express from 'express';
const app = express();
const PORT = 5000; // Porta diferente

app.use(express.json());

app.post('/auth/login', (req, res) => {
  console.log('Login request received:', req.body);
  res.json({ token: 'test_token', user: { id: '1', email: 'test@test.com', role: 'super_admin' } });
});

app.get('/test', (req, res) => {
  res.json({ message: 'Server is running on port 5000' });
});

app.listen(PORT, () => {
  console.log(`Test server running at http://localhost:${PORT}`);
});