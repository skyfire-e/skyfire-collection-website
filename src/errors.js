class ValidationError extends Error {
  constructor(message, details) { super(message); this.name = 'ValidationError'; this.status = 400; this.details = details; }
}
class DataCorruptionError extends Error {
  constructor(message) { super(message); this.name = 'DataCorruptionError'; this.status = 500; }
}

module.exports = { ValidationError, DataCorruptionError };
