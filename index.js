const express = require('express')
const app = express()
const { client } = require('websocket');
const server = require('http').createServer(app);
const mongoose = require('mongoose');
const Web3 = require('web3');

//Constants
const {
    MONGO_URI,
    INFURA_ENDPOINT,
    WITHDRAW_MANAGER_PROXY_ADDRESS,
    EXIT_STARTED_EVENT_SIGNATURE,
    ERC20_ABI,
    WITHDRAW_MANAGER_ABI,
    POS_BURN_EVENT,
    PLASMA_BURN_EVENT,
    ETTE_WEBSOCKET_URL,
    ETTE_API_KEY,
    MATIC_RPC_ENDPOINT
} = require('./src/constants/constants');

// Save And Map Tx
const {
    mapWithdrawTxToBurnTx,
    saveBurnTxEvent,
} = require('./src/BurnEvent');

//Cron Jobs
const { checkStatusOfBurntBurnTxHashes,
    checkStatusOfPendingBurnTxHashes
} = require('./src/cronjobs/BurnTxPoll');
const { schedule } = require('node-cron');

//initiate web3 ethereum instance and matic web3 instance
const web3 = new Web3(INFURA_ENDPOINT);
const maticWeb3 = new Web3(MATIC_RPC_ENDPOINT);

//Connect to mongo
mongoose.connect(MONGO_URI, {useNewUrlParser: true});
const mongoConnection = mongoose.connection;
mongoConnection.on('open', () =>{ console.log("mongo connected")});

// Establish Plasma and POS clients
const etteClient = new client();

//Listen for burn events on POS and Plasma
etteClient.on('connect', c => {
    c.on('close', d => {
        console.log("Connection closed on ette client", d);
    })
    c.on('message', d => {
        const event = JSON.parse(d.utf8Data);
        if (event.topics) {
            saveBurnTxEvent(event, maticWeb3);
        }
    })
    c.send(JSON.stringify({ name: POS_BURN_EVENT, type: 'subscribe', apiKey: ETTE_API_KEY}));
    c.send(JSON.stringify({ name: PLASMA_BURN_EVENT, type: 'subscribe', apiKey: ETTE_API_KEY}));
});

// Connect to ette
etteClient.connect(ETTE_WEBSOCKET_URL, null)

//Withdraw Manager Contract to listen for plasma withdraw txHashes
const withdrawManagerContract = new web3.eth.Contract(WITHDRAW_MANAGER_ABI.abi, WITHDRAW_MANAGER_PROXY_ADDRESS);

//Listen for ExitStarted Event for plasma exits
withdrawManagerContract.events.ExitStarted({
    topics: [
        EXIT_STARTED_EVENT_SIGNATURE
    ]
}).on("connected", (subscriptionId) => { 
    console.log("Listening for the ExitStarted Event on withdraw manager proxy");
    console.log("subscriptionId", subscriptionId);

}).on("data", (event) => {
   //Decode and map the withdraw event to the burn event 
   mapWithdrawTxToBurnTx(event, web3, ERC20_ABI.abi);
}).on("error", (error, receipt) => { 
    console.log("error in ExitStarted", error);
    //Can be used to catch the receipt of failed transactions.
});

//CRON JOBS
checkStatusOfPendingBurnTxHashes();
checkStatusOfBurntBurnTxHashes();
schedule('*/12 * * * * *', checkStatusOfPendingBurnTxHashes)
schedule('*/12 * * * * *',checkStatusOfBurntBurnTxHashes)

//Listen for POS Withdraw Event on all tokens using their respective contracts.
//TODO

server.listen(3000, () => console.log(`Lisening on port :3000`))



