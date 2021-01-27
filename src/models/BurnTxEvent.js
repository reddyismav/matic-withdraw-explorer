const mongoose = require('mongoose');

const burnTxEventSchema = new mongoose.Schema({
    originContract: {
        type: String,
        required: true,
    },
    burnTxHash: {
        type: String,
        required: true,
    },
    withdrawTxHash: {
        type: String,
        required: false,
    },
    fromAddress: {
        type: String,
        required: true,
    },
    toAddress: {
        type: String,
        required: true,
    },
    userAddress: {
        type: String,
        required: true,
    },
    amount: {
        type: String,
        required: true,
    },
    data: {
        type: String,
        required: true,
    },
    blockHash: {
        type: String,
        required: true,
    },
    isPos: {
        type: Boolean,
        required: true,
    },
    isPlasma: {
        type: Boolean,
        required: true,
    },
    burnTimeStamp: {
        type: String,
        required: false,
    },
    withdrawTimeStamp: {
        type: String,
        required: false,
    },
    status: {
        type: String,
        required: true,
        default: "Pending"
    }
});

module.exports = mongoose.model('BurnTxEvent', burnTxEventSchema);