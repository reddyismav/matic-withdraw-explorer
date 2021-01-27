const mongoose = require('mongoose');

const withdrawsUnmappedSchema = new mongoose.Schema({
    withdrawTxHash: {
        type: String,
        required: true
    },
});

module.exports = mongoose.model('WithdrawsUnmapped', withdrawsUnmappedSchema);