const axios = require('axios');
const BurnTxEvent = require('../models/BurnTxEvent');
const { BRIDGE_API_WITHDRAW_ENDPOINT } = require('../constants/constants');

const checkStatusOfPendingBurnTxHashes = async () => {
    checkStatusOfBurnTxHashes('Pending');
};

const checkStatusOfBurntBurnTxHashes = async () => {
    checkStatusOfBurnTxHashes('Burnt');
}

const checkStatusOfBurnTxHashes = async (transactionStatus) => {
    try {
        const pendingBurnEvents = await BurnTxEvent.find({ status: transactionStatus });
        if (pendingBurnEvents.length < 2) {
            return;
        }
        const withdrawTxObjectArray = await pendingBurnEvents.map((burnEvent) => {
            const { burnTxHash, isPos } = burnEvent;
            const requestData = { 
                txHash: burnTxHash,
                isPoS: isPos,
            };
            return requestData;
        });
        const requestJson = { withdrawTxObjectArray };
        const response = await axios.post(BRIDGE_API_WITHDRAW_ENDPOINT, requestJson);

        if (response.status === 200) {
            const { withdrawTxStatus } = response.data;
            pendingBurnEvents.forEach((burnEvent) => {
                const { burnTxHash } = burnEvent;
                const statusData = withdrawTxStatus[burnTxHash];
                const { msg } = statusData;
                BurnTxEvent.findOneAndUpdate({ burnTxHash }, { status: msg });
            })
        }
    } catch (error) {
        console.log("error in checkStatusOfPendingBurnTx", error);
    }
};

module.exports = {
    checkStatusOfPendingBurnTxHashes,
    checkStatusOfBurntBurnTxHashes
}