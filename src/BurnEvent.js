const utils = require('web3-utils');
const BurnTxEvent = require('./models/BurnTxEvent');
const WithdrawsUnmapped = require('./models/WithdrawsUnmapped');
const {
    PLASMA_BURN_EVENT_SIGNATURE,
    POS_BURN_EVENT_SIGNATURE,
    ETTE_EVENT_URL,
    ETTE_API_KEY,
} = require('./constants/constants');
const abiDecoder = require('abi-decoder');
const rlp = require('rlp');
const axios = require('axios');

const saveBurnEventWithWithdrawTransactionHash = async (burnEvent, withdrawTxHash) => {
    try {
        const { txHash, blockHash } = burnEvent;
        //Map withdrawTxHash to burnTxHash
        const burnTxEvent = await BurnTxEvent.findOne({ burnTxHash: txHash, blockHash });
        if (burnTxEvent) {
            await BurnTxEvent.findOneAndUpdate({ burnTxHash: txHash, blockHash }, { withdrawTxHash }, {new: true});
        } else {
            saveUnmappedWithdraws(withdrawTxHash);
        }
        
    } catch (error) {
        console.log("error in  saveBurnEvent", error);
    }
};

const saveUnmappedWithdraws = async (withdrawTxHash) => {
    try {
        const unmappedWithdraw = new WithdrawsUnmapped({
            withdrawTxHash,
        });
        await unmappedWithdraw.save();
    } catch (error) {
        console.log("error in saving unmapped withdraws", error);
    }
};

const mapWithdrawTxToBurnTx = async (event, web3, abi) => {
    try {
        const { transactionHash } = event;

        //Get Transaction from transaction hash
        const confirmWithdrawTransaction = await web3.eth.getTransaction(transactionHash);
        const { input } = confirmWithdrawTransaction;
        
        //Decode the data using abi decoder
        const decodedAbiDataResponse = await getParsedTxDataFromAbiDecoder(input, abi);
        if (!decodedAbiDataResponse.success) throw new Error("error in decoding abi");
        const decodedInputData = decodedAbiDataResponse.result;

        //RLP decode the decoded abi data
        const rlpDecodedDataResponse = await rlpDecodeData(decodedInputData);
        if (!rlpDecodedDataResponse.success) throw new Error("error in rlp decoding the input data");
        const blockNumber = rlpDecodedDataResponse.result.blockNumber;
        const logIndex = rlpDecodedDataResponse.result.logIndex;

        console.log("blockNumber", blockNumber, "logIndex", logIndex);

        //Get event from ette using block number and logIndex
        const burnEventResponse = await getEventFromBlockNumberAndLogIndex(blockNumber, logIndex);
        if (!burnEventResponse.success) throw new Error("error in getting the burn event");
        const burnEvent = burnEventResponse.result;

        //Save Burn event along with withdraw transaction hash
        await saveBurnEventWithWithdrawTransactionHash(burnEvent, transactionHash);
    } catch (error) {
        console.log("error in mapwithdrawTxtoBurnTx", error);
    }
};

//Get decoded input data to pass for rlp decode
const getParsedTxDataFromAbiDecoder = async (inputData, abi) => {
    try {
        abiDecoder.addABI(abi);
        const decodedData = abiDecoder.decodeMethod(inputData);
        return {
            success: true,
            result: decodedData,
        }
    } catch (error) {
        console.log("error in getParsedTxDataFromAbiDecoder", error);
        return {
            success: false,
        }
    }
};

//RLP decode the input data for log index and blocknumber
const rlpDecodeData = async (data) => {
    try {
        const decodedBuffer = rlp.decode(data.params[0].value);
        const blockNumber = parseInt(decodedBuffer[2].toString('hex'), 16);
        let logIndex;
        if (decodedBuffer[9].toString().length === 0) {
            logIndex = 0;
        } else {
            logIndex = parseInt(decodedBuffer[9].toString('hex'), 16);
        }
        return {
            success: true,
            result: {
                logIndex,
                blockNumber,
            }
        }
    } catch (error) {
        console.log("error in rlpDecodeData", error);
        return {
            success: false,
        }
    }
};

//Query ette for events based on block number and log index
const getEventFromBlockNumberAndLogIndex = async (blockNumber, logIndex) => {
    try {
        const url = `${ETTE_EVENT_URL}blockNumber=${blockNumber}&logIndex=${logIndex}`
        const headers = {
            APIKey: ETTE_API_KEY,
        };
        let response;
        const eventResult = await axios.get(url,{
            headers: headers,
        });
        if (eventResult.status === 200) {
            response = {
                success: true,
                result: eventResult.data,
            };
        } else {
            response = {
                success: false,
            };
        }
        return response;
    } catch (error) {
        console.log("error in getEventFromBlockNumberAndLogIndex", error);
        return {
            success: false,
        }
    }
};

//Save Burn Event
const saveBurnTxEvent = async (burnEvent, maticWeb3) => {
    try {
        const { data, origin, topics, txHash, blockHash } = burnEvent;
        let isPos = false;
        let isPlasma = false;
        let userAddress;

        //timestamp if the transaction
        const blockInfo = await maticWeb3.eth.getBlock(blockHash);
        const { timestamp } = blockInfo;

        //TODO-get gas used for the transaction

        //Amount converted to string
        const amount = utils.hexToNumberString(data);
        if (topics[0] === PLASMA_BURN_EVENT_SIGNATURE) {
            isPlasma = true;
            userAddress = topics[2];
        }
        if (topics[0] === POS_BURN_EVENT_SIGNATURE) {
            isPos = true;
            userAddress = topics[1];
        }
        const burnTxEvent = new BurnTxEvent({
            data,
            originContract: origin,
            burnTxHash: txHash,
            blockHash,
            fromAddress: topics[1],
            toAddress: topics[2],
            userAddress,
            amount,
            isPos,
            isPlasma,
            burnTimestamp: timestamp.toString(),
        });
        await burnTxEvent.save();
    } catch (error) {
        console.log("error in saveBurnTxEvent", error);
    }
};

module.exports = {
    mapWithdrawTxToBurnTx,
    saveBurnTxEvent,
    getEventFromBlockNumberAndLogIndex
}