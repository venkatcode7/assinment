const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { connectDB } = require('./db');
const identityRoutes = require('./routes/identityRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

// Connect to MongoDB
connectDB();

app.use('/', identityRoutes);

app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    error: {
      message: 'An internal server error occurred',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});