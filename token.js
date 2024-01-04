const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the painting schema
const tokenSchema = new Schema({
  name: {
    type: String,
    required: true
  },
    token: {
        type: String,
        required: true
    }
});

// Create a model from the schema
const Token = mongoose.model('Token', tokenSchema);

module.exports = Token;
