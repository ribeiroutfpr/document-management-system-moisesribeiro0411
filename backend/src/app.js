const express = require('express');
const documentsRouter = require('./routes/documents.routes');
const handleError = require('./controllers/error.controller');
const DocumentError = require('./errors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '100kb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(documentsRouter);
app.use((req, res, next) => {
  next(new DocumentError('ROUTE_NOT_FOUND', 'Rota não encontrada.'));
});
app.use(handleError);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`DMS backend ouvindo na porta ${PORT}`);
  });
}

module.exports = app;
