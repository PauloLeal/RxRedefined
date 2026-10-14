// Shared by the app (models.js) and by sequelize-cli (migrations and seed).
// Defaults match docker-compose.yml; docker-compose-app.yml overrides DB_HOST.
const database = {
  username: process.env.DB_USER || 'kitchen_queue',
  password: process.env.DB_PASSWORD || 'kitchen_queue',
  database: process.env.DB_NAME || 'kitchen_queue',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5433),
  dialect: 'postgres',
  logging: false,
};

module.exports = {
  development: database,
  test: database,
  production: database,
};
