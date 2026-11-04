class DocumentError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.code = code;
  }
}

module.exports = DocumentError;
