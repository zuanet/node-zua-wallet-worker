"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletWrapper = exports.initZuaFramework = exports.COINBASE_CFM_COUNT = exports.CONFIRMATION_COUNT = exports.workerLog = void 0;
//@ts-ignore
const IS_NODE_CLI = typeof window == 'undefined';
const logger_1 = require("./logger");
Object.defineProperty(exports, "workerLog", { enumerable: true, get: function () { return logger_1.workerLog; } });
const wallet_1 = require("@zua/wallet");
Object.defineProperty(exports, "CONFIRMATION_COUNT", { enumerable: true, get: function () { return wallet_1.CONFIRMATION_COUNT; } });
Object.defineProperty(exports, "COINBASE_CFM_COUNT", { enumerable: true, get: function () { return wallet_1.COINBASE_CFM_COUNT; } });
const { HDPrivateKey } = wallet_1.zuacore;
let Worker_ = IS_NODE_CLI ? require('@aspectron/web-worker') : Worker;
logger_1.workerLog.info("Worker:", (Worker_ + "").substr(0, 32) + "....");
const rpc_1 = require("./rpc");
let worker, workerReady = wallet_1.helper.Deferred();
let onWorkerMessage = (op, data) => {
    logger_1.workerLog.info("abstract onWorkerMessage");
};
const initZuaFramework = (opt = {}) => {
    return new Promise((resolve, reject) => {
        wallet_1.helper.dpc(2000, () => {
            let url, baseURL;
            if (IS_NODE_CLI) {
                baseURL = 'file://' + __dirname + '/';
                url = new URL('worker.js', baseURL);
            }
            else {
                baseURL = window.location.origin;
                let { workerPath = "/node_modules/@zua/wallet-worker/worker.js" } = opt;
                url = new URL(workerPath, baseURL);
            }
            logger_1.workerLog.info("initZuaFramework", url, baseURL);
            try {
                worker = new Worker_(url, { type: 'module' });
            }
            catch (e) {
                logger_1.workerLog.info("Worker error", e);
            }
            logger_1.workerLog.info("worker instance created", worker + "");
            worker.onmessage = (msg) => {
                const { op, data } = msg.data;
                if (op == 'ready') {
                    logger_1.workerLog.info("worker.onmessage", op, data);
                    workerReady.resolve();
                    resolve();
                    return;
                }
                onWorkerMessage(op, data);
            };
        });
    });
};
exports.initZuaFramework = initZuaFramework;
class WalletWrapper extends wallet_1.EventTargetImpl {
    constructor(privKey, seedPhrase, networkOptions, options = {}) {
        var _a;
        super();
        this.isWorkerReady = false;
        this._pendingCB = new Map();
        this.workerReady = workerReady;
        this.balance = { available: 0, pending: 0, total: 0 };
        this._rid2subUid = new Map();
        this.grpcFlags = {};
        let { rpc } = networkOptions;
        if (rpc) {
            this.rpc = rpc;
            if (options.checkGRPCFlags) {
                this.checkGRPCFlags();
            }
        }
        delete networkOptions.rpc;
        if (privKey && seedPhrase) {
            this.HDWallet = new wallet_1.zuacore.HDPrivateKey(privKey);
        }
        else {
            const temp = new wallet_1.Wallet.Mnemonic(wallet_1.Wallet.Mnemonic.Words.ENGLISH);
            this.HDWallet = new wallet_1.zuacore.HDPrivateKey(temp.toHDPrivateKey().toString());
        }
        this.uid = this.createUID(networkOptions.network);
        //@ts-ignore
        (_a = rpc === null || rpc === void 0 ? void 0 : rpc.setStreamUid) === null || _a === void 0 ? void 0 : _a.call(rpc, this.uid);
        console.log("wallet.uid", this.uid);
        this.initWorker();
        this.initWallet(privKey, seedPhrase, networkOptions, options);
    }
    static checkPasswordValidity(password, encryptedMnemonic) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const decrypted = yield this.Crypto.decrypt(password, encryptedMnemonic);
                const savedWallet = JSON.parse(decrypted);
                return !!(savedWallet === null || savedWallet === void 0 ? void 0 : savedWallet.privKey);
            }
            catch (e) {
                return false;
            }
        });
    }
    static setWorkerLogLevel(level) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.workerLog.setLevel(level);
            yield workerReady;
            yield this.postMessage('worker-log-level', { level });
        });
    }
    static postMessage(op, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (op != "wallet-init") {
                logger_1.workerLog.info(`postMessage:: ${op}, ${JSON.stringify(data)}`);
            }
            //@ts-ignore
            worker.postMessage({ op, data });
        });
    }
    static fromMnemonic(seedPhrase, networkOptions, options = {}) {
        if (!networkOptions || !networkOptions.network)
            throw new Error(`fromMnemonic(seedPhrase,networkOptions): missing network argument`);
        const privKey = new wallet_1.Wallet.Mnemonic(seedPhrase.trim()).toHDPrivateKey().toString();
        const wallet = new this(privKey, seedPhrase, networkOptions, options);
        return wallet;
    }
    /**
     * Creates a new Wallet from encrypted wallet data.
     * @param password the password the user encrypted their seed phrase with
     * @param encryptedMnemonic the encrypted seed phrase from local storage
     * @throws Will throw "Incorrect password" if password is wrong
     */
    static import(password, encryptedMnemonic, networkOptions, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const decrypted = yield wallet_1.Wallet.passwordHandler.decrypt(password, encryptedMnemonic);
            const savedWallet = JSON.parse(decrypted);
            const myWallet = new this(savedWallet.privKey, savedWallet.seedPhrase, networkOptions, options);
            return myWallet;
        });
    }
    checkGRPCFlags() {
        const { rpc } = this;
        if (!rpc)
            return;
        this.grpcFlagsSyncSignal = wallet_1.helper.Deferred();
        rpc.onConnect(() => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            //console.log("#####rpc onConnect#######")
            let result = yield rpc.getUtxosByAddresses([])
                .catch((err) => {
                //error = err;
            });
            if (result) {
                this.grpcFlags.utxoIndex = !((_b = (_a = result.error) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.includes('--utxoindex'));
                this.emit("grpc-flags", this.grpcFlags);
            }
            (_c = this.grpcFlagsSyncSignal) === null || _c === void 0 ? void 0 : _c.resolve();
        }));
    }
    createUID(network) {
        const { privateKey } = this.HDWallet.deriveChild(`m/44'/972/0'/1'/0'`);
        let address = privateKey.toAddress(network).toString().split(":")[1];
        return wallet_1.helper.sha256(address);
    }
    initWallet(privKey, seedPhrase, networkOptions, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.workerReady;
            this.postMessage('wallet-init', {
                privKey,
                seedPhrase,
                networkOptions,
                options
            });
        });
    }
    initWorker() {
        if (!worker)
            throw new Error("Please init zua framework using 'await initZuaFramework();'.");
        this.worker = worker;
        onWorkerMessage = (op, data) => {
            //if(op != 'rpc-request'){
            //if (data?.fn != "mnemonic"){
            //workerLog.info(`onWorkerMessage: ${op}, ${JSON.stringify(data)}`)
            //}
            //}
            switch (op) {
                case 'rpc-request':
                    return this.handleRPCRequest(data);
                case 'wallet-response':
                    return this.handleResponse(data);
                case 'wallet-events':
                    return this.handleEvents(data);
                case 'wallet-property':
                    return this.handleProperty(data);
            }
        };
    }
    handleProperty(msg) {
        //@ts-ignore
        this[name] = value;
    }
    handleEvents(msg) {
        let { name, data } = msg;
        if (name == 'balance-update') {
            this.balance = data;
        }
        this.emit(name, data);
    }
    handleResponse(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            let { rid, error, result } = msg;
            let item = this._pendingCB.get(rid);
            if (!item)
                return;
            item.cb(error, result);
            this._pendingCB.delete(rid);
        });
    }
    handleRPCRequest(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.workerLog.debug(`RPCRequest: ${JSON.stringify(msg)}`);
            const { fn, args, rid } = msg;
            const utxoRelatedFns = [
                'notifyUtxosChangedRequest',
                'getUtxosByAddressesRequest',
                'stopNotifyingUtxosChangedRequest'
            ];
            //console.log("fnfn", fn, args[0])
            if (args[0] && utxoRelatedFns.includes(args[0]) && this.grpcFlagsSyncSignal) {
                yield this.grpcFlagsSyncSignal;
                if (!this.grpcFlags.utxoIndex) {
                    this.postMessage("rpc-response", {
                        rid,
                        result: {
                            error: {
                                errorCode: "UTXOINDEX-FLAG-MISSING",
                                message: "UTXOINDEX FLAG ISSUE"
                            }
                        }
                    });
                    return;
                }
            }
            if (fn == "unSubscribe") {
                if (args[1]) {
                    args[1] = this._rid2subUid.get(args[1]); //rid to subid
                    if (!args[1])
                        return;
                }
                //@ts-ignore
                this.rpc.unSubscribe(...args);
                return;
            }
            let directFns = [
                'onConnect', 'onDisconnect', 'onConnectFailure', 'onError',
                'disconnect', 'connect'
            ];
            if (directFns.includes(fn)) {
                if (rid) {
                    args.push((result) => {
                        this.postMessage("rpc-direct", { rid, result });
                    });
                }
                //@ts-ignore
                this.rpc[fn](...args);
                return;
            }
            if (fn == 'subscribe') {
                args.push((result) => {
                    this.postMessage("rpc-publish", { method: args[0], rid, result });
                });
            }
            //@ts-ignore
            let p = this.rpc[fn](...args);
            let { uid: subUid } = p;
            let error;
            let result = yield p
                .catch((err) => {
                error = err;
            });
            if (fn == 'subscribe' && rid) {
                this._rid2subUid.set(rid, subUid);
            }
            this.postMessage("rpc-response", { rid, result, error });
        });
    }
    postMessage(op, data) {
        WalletWrapper.postMessage(op, data);
    }
    request(fn, args, callback = undefined) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.workerReady;
            let rid = undefined;
            if (callback) {
                rid = this.createPendingCall(callback);
            }
            logger_1.workerLog.debug(`wallet-request: ${fn}, ${JSON.stringify(args)},  ${rid}`);
            this.worker.postMessage({ op: "wallet-request", data: { fn, args, rid } });
        });
    }
    requestPromisify(fn, ...args) {
        return new Promise((resolve, reject) => {
            this.request(fn, args, (error, result) => {
                if (error)
                    return reject(error);
                resolve(result);
            });
        });
    }
    createPendingCall(cb) {
        const uid = rpc_1.UID();
        this._pendingCB.set(uid, { uid, cb });
        return uid;
    }
    sync(syncOnce = undefined) {
        return __awaiter(this, void 0, void 0, function* () {
            this.syncSignal = wallet_1.helper.Deferred();
            let args = [];
            if (syncOnce !== undefined)
                args.push(syncOnce);
            this.request("sync", args, () => {
                var _a;
                (_a = this.syncSignal) === null || _a === void 0 ? void 0 : _a.resolve();
            });
            return this.syncSignal;
        });
    }
    setLogLevel(level) {
        this.request("setLogLevel", [level]);
    }
    startUTXOsPolling() {
        this.request("startUTXOsPolling", []);
    }
    get(name, waitForSync = false) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            if (waitForSync)
                yield this.syncSignal;
            this.request(name, [], (error, result) => {
                if (error)
                    return reject(error);
                resolve(result);
            });
        }));
    }
    getAfterSync(name) {
        return this.get(name, true);
    }
    get mnemonic() {
        return this.get("mnemonic");
    }
    get receiveAddress() {
        return this.getAfterSync("receiveAddress");
    }
    /**
     * Send a transaction. Returns transaction id.
     * @param txParams
     * @param txParams.toAddr To address in cashaddr format (e.g. zuatest:qq0d6h0prjm5mpdld5pncst3adu0yam6xch4tr69k2)
     * @param txParams.amount Amount to send in sompis (100000000 (1e8) sompis in 1 ZUA)
     * @param txParams.fee Fee for miners in sompis
     * @throws `FetchError` if endpoint is down. API error message if tx error. Error if amount is too large to be represented as a javascript number.
     */
    submitTransaction(txParamsArg, debug = false) {
        return this.requestPromisify("submitTransaction", txParamsArg, debug);
    }
    /**
     * Send a transaction. Returns transaction id.
     * @param txParams
     * @param txParams.toAddr To address in cashaddr format (e.g. zuatest:qq0d6h0prjm5mpdld5pncst3adu0yam6xch4tr69k2)
     * @param txParams.amount Amount to send in sompis (100000000 (1e8) sompis in 1 ZUA)
     * @param txParams.fee Fee for miners in sompis
     * @throws `FetchError` if endpoint is down. API error message if tx error. Error if amount is too large to be represented as a javascript number.
     */
    estimateTransaction(txParamsArg) {
        return this.requestPromisify("estimateTransaction", txParamsArg);
    }
    /**
     * Update transcations time
     */
    startUpdatingTransactions(version = undefined) {
        return this.requestPromisify("startUpdatingTransactions", version);
    }
    /**
    * Compound UTXOs by re-sending funds to itself
    */
    compoundUTXOs(txCompoundOptions = {}, debug = false) {
        return this.requestPromisify("compoundUTXOs", txCompoundOptions, debug);
    }
    scanMoreAddresses(count = 100, debug = false, receiveStart = -1, changeStart = -1) {
        return this.requestPromisify("scanMoreAddresses", count, debug, receiveStart, changeStart);
    }
    /**
     * Generates encrypted wallet data.
     * @param password user's chosen password
     * @returns Promise that resolves to object-like string. Suggested to store as string for .import().
     */
    export(password) {
        return this.requestPromisify("export", password);
    }
    restoreCache(cache) {
        this.request("restoreCache", [cache]);
    }
    clearUsedUTXOs() {
        this.request("clearUsedUTXOs", []);
    }
}
exports.WalletWrapper = WalletWrapper;
WalletWrapper.networkTypes = wallet_1.Wallet.networkTypes;
WalletWrapper.ZUA = wallet_1.Wallet.ZUA;
WalletWrapper.networkAliases = wallet_1.Wallet.networkAliases;
WalletWrapper.Mnemonic = wallet_1.Wallet.Mnemonic;
WalletWrapper.Crypto = wallet_1.Wallet.Crypto;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2FsbGV0LXdyYXBwZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvd2FsbGV0LXdyYXBwZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUEsWUFBWTtBQUNaLE1BQU0sV0FBVyxHQUFHLE9BQU8sTUFBTSxJQUFJLFdBQVcsQ0FBQztBQUNqRCxxQ0FBbUM7QUFJM0IsMEZBSkEsa0JBQVMsT0FJQTtBQUhqQiwwQ0FBaUg7QUFHOUYsbUdBSGlDLDJCQUFrQixPQUdqQztBQUFFLG1HQUhpQywyQkFBa0IsT0FHakM7QUFGekQsTUFBTSxFQUFDLFlBQVksRUFBQyxHQUFHLGtCQUFTLENBQUM7QUFJakMsSUFBSSxPQUFPLEdBQUcsV0FBVyxDQUFBLENBQUMsQ0FBQSxPQUFPLENBQUMsdUJBQXVCLENBQUMsQ0FBQSxDQUFDLENBQUEsTUFBTSxDQUFDO0FBQ2xFLGtCQUFTLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDLE9BQU8sR0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxHQUFDLE1BQU0sQ0FBQyxDQUFBO0FBRzVELCtCQUFrQztBQUdsQyxJQUFJLE1BQWEsRUFBRSxXQUFXLEdBQTBCLGVBQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQztBQUcxRSxJQUFJLGVBQWUsR0FBRyxDQUFDLEVBQVMsRUFBRSxJQUFRLEVBQUMsRUFBRTtJQUM1QyxrQkFBUyxDQUFDLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxDQUFBO0FBQzNDLENBQUMsQ0FBQTtBQUVNLE1BQU0sa0JBQWtCLEdBQUcsQ0FBQyxNQUF5QixFQUFFLEVBQUMsRUFBRTtJQUNoRSxPQUFPLElBQUksT0FBTyxDQUFPLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBQyxFQUFFO1FBQzNDLGVBQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUUsRUFBRTtZQUdwQixJQUFJLEdBQUcsRUFBRSxPQUFPLENBQUM7WUFD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QUFDLEtBQWtCO1FBQzlCLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQTtJQUN0QyxDQUFDO0lBQ0QsY0FBYztRQUNiLElBQUksQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLEVBQUUsRUFBRSxDQUFDLENBQUE7SUFDbkMsQ0FBQzs7QUFJTSxzQ0FBYTtBQXRZYiwwQkFBWSxHQUFDLGVBQU0sQ0FBQyxZQUFZLENBQUM7QUFDakMsaUJBQUcsR0FBQyxlQUFNLENBQUMsR0FBRyxDQUFDO0FBQ2YsNEJBQWMsR0FBQyxlQUFNLENBQUMsY0FBYyxDQUFDO0FBQ3JDLHNCQUFRLEdBQUMsZUFBTSxDQUFDLFFBQVEsQ0FBQztBQUN6QixvQkFBTSxHQUFDLGVBQU0sQ0FBQyxNQUFNLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvL0B0cy1pZ25vcmVcbmNvbnN0IElTX05PREVfQ0xJID0gdHlwZW9mIHdpbmRvdyA9PSAndW5kZWZpbmVkJztcbmltcG9ydCB7d29ya2VyTG9nfSBmcm9tICcuL2xvZ2dlcic7XG5pbXBvcnQge1dhbGxldCwgRXZlbnRUYXJnZXRJbXBsLCBoZWxwZXIsIGthc3BhY29yZSwgQ09ORklSTUFUSU9OX0NPVU5ULCBDT0lOQkFTRV9DRk1fQ09VTlR9IGZyb20gJ0BrYXNwYS93YWxsZXQnO1xuY29uc3Qge0hEUHJpdmF0ZUtleX0gPSBrYXNwYWNvcmU7XG5cbmV4cG9ydCB7d29ya2VyTG9nLCBDT05GSVJNQVRJT05fQ09VTlQsIENPSU5CQVNFX0NGTV9DT1VOVH07XG5cbmxldCBXb3JrZXJfID0gSVNfTk9ERV9DTEk/cmVxdWlyZSgnQGFzcGVjdHJvbi93ZWItd29ya2VyJyk6V29ya2VyO1xud29ya2VyTG9nLmluZm8oXCJXb3JrZXI6XCIsIChXb3JrZXJfK1wiXCIpLnN1YnN0cigwLCAzMikrXCIuLi4uXCIpXG5cblxuaW1wb3J0IHtVSUQsIENCSXRlbX0gZnJvbSAnLi9ycGMnO1xuXG5cbmxldCB3b3JrZXI6V29ya2VyLCB3b3JrZXJSZWFkeTpoZWxwZXIuRGVmZXJyZWRQcm9taXNlID0gaGVscGVyLkRlZmVycmVkKCk7XG5cblxubGV0IG9uV29ya2VyTWVzc2FnZSA9IChvcDpzdHJpbmcsIGRhdGE6YW55KT0+e1xuXHR3b3JrZXJMb2cuaW5mbyhcImFic3RyYWN0IG9uV29ya2VyTWVzc2FnZVwiKVxufVxuXG5leHBvcnQgY29uc3QgaW5pdEthc3BhRnJhbWV3b3JrID0gKG9wdDp7d29ya2VyUGF0aD86c3RyaW5nfT17fSk9Pntcblx0cmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpPT57XG5cdFx0aGVscGVyLmRwYygyMDAwLCAoKT0+e1xuXHRcdFx0XG5cdFx0XHRcblx0XHRcdGxldCB1cmwsIGJhc2VVUkw7XG5cdFx0XHRpZihJU19OT0RFX0NMSSl7XG5cdFx0XHRcdGJhc2VVUkwgPSAnZmlsZTovLycrX19kaXJuYW1lKycvJ1xuXHRcdFx0XHR1cmwgPSBuZXcgVVJMKCd3b3JrZXIuanMnLCBiYXNlVVJMKVxuXHRcdFx0fVxuXHRcdFx0ZWxzZXtcblx0XHRcdFx0YmFzZVVSTCA9IHdpbmRvdy5sb2NhdGlvbi5vcmlnaW47XG5cdFx0XHRcdGxldCB7XG5cdFx0XHRcdFx0d29ya2VyUGF0aD1cIi9ub2RlX21vZHVsZXMvQGthc3BhL3dhbGxldC13b3JrZXIvd29ya2VyLmpzXCJcblx0XHRcdFx0fSA9IG9wdFxuXHRcdFx0XHR1cmwgPSBuZXcgVVJMKHdvcmtlclBhdGgsIGJhc2VVUkwpO1xuXHRcdFx0fVxuXHRcdFx0d29ya2VyTG9nLmluZm8oXCJpbml0S2FzcGFGcmFtZXdvcmtcIiwgdXJsLCBiYXNlVVJMKVxuXG5cdFx0XHR0cnl7XG5cdFx0XHRcdHdvcmtlciA9IG5ldyBXb3JrZXJfKHVybCwge3R5cGU6J21vZHVsZSd9KTtcblx0XHRcdH1jYXRjaChlKXtcblx0XHRcdFx0d29ya2VyTG9nLmluZm8oXCJXb3JrZXIgZXJyb3JcIiwgZSlcblx0XHRcdH1cblxuXHRcdFx0d29ya2VyTG9nLmluZm8oXCJ3b3JrZXIgaW5zdGFuY2UgY3JlYXRlZFwiLCB3b3JrZXIrXCJcIilcblxuXHRcdFx0d29ya2VyLm9ubWVzc2FnZSA9IChtc2c6e2RhdGE6e29wOnN0cmluZywgZGF0YTphbnl9fSk9Pntcblx0XHRcdFx0Y29uc3Qge29wLCBkYXRhfSA9IG1zZy5kYXRhO1xuXHRcdFx0XHRpZihvcD09J3JlYWR5Jyl7XG5cdFx0XHRcdFx0d29ya2VyTG9nLmluZm8oXCJ3b3JrZXIub25tZXNzYWdlXCIsIG9wLCBkYXRhKVxuXHRcdFx0XHRcdHdvcmtlclJlYWR5LnJlc29sdmUoKTtcblx0XHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdFx0cmV0dXJuXG5cdFx0XHRcdH1cblx0XHRcdFx0b25Xb3JrZXJNZXNzYWdlKG9wLCBkYXRhKTtcblx0XHRcdH1cblx0XHR9KVxuXHR9KVxufVxuXG5cbmltcG9ydCB7XG5cdE5ldHdvcmssIE5ldHdvcmtPcHRpb25zLCBTZWxlY3RlZE5ldHdvcmssIFdhbGxldFNhdmUsIEFwaSwgVHhTZW5kLCBUeFJlc3AsXG5cdFBlbmRpbmdUcmFuc2FjdGlvbnMsIFdhbGxldENhY2hlLCBJUlBDLCBSUEMsIFdhbGxldE9wdGlvbnMsXHRXYWxsZXRPcHQsIFR4SW5mbyxcblx0VHhDb21wb3VuZE9wdGlvbnMsIFNjYW5lTW9yZVJlc3VsdFxufSBmcm9tICdAa2FzcGEvd2FsbGV0L3R5cGVzL2N1c3RvbS10eXBlcyc7XG5cbmNsYXNzIFdhbGxldFdyYXBwZXIgZXh0ZW5kcyBFdmVudFRhcmdldEltcGx7XG5cblx0c3RhdGljIG5ldHdvcmtUeXBlcz1XYWxsZXQubmV0d29ya1R5cGVzO1xuXHRzdGF0aWMgS0FTPVdhbGxldC5LQVM7XG5cdHN0YXRpYyBuZXR3b3JrQWxpYXNlcz1XYWxsZXQubmV0d29ya0FsaWFzZXM7XG5cdHN0YXRpYyBNbmVtb25pYz1XYWxsZXQuTW5lbW9uaWM7XG5cdHN0YXRpYyBDcnlwdG89V2FsbGV0LkNyeXB0bztcblxuXHRzdGF0aWMgYXN5bmMgY2hlY2tQYXNzd29yZFZhbGlkaXR5KHBhc3N3b3JkOnN0cmluZywgZW5jcnlwdGVkTW5lbW9uaWM6IHN0cmluZyl7XG5cdFx0dHJ5e1xuXHRcdFx0Y29uc3QgZGVjcnlwdGVkID0gYXdhaXQgdGhpcy5DcnlwdG8uZGVjcnlwdChwYXNzd29yZCwgZW5jcnlwdGVkTW5lbW9uaWMpO1xuXHRcdFx0Y29uc3Qgc2F2ZWRXYWxsZXQgPSBKU09OLnBhcnNlKGRlY3J5cHRlZCkgYXMgV2FsbGV0U2F2ZTtcblx0XHRcdHJldHVybiAhIXNhdmVkV2FsbGV0Py5wcml2S2V5O1xuXHRcdH1jYXRjaChlKXtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRzdGF0aWMgYXN5bmMgc2V0V29ya2VyTG9nTGV2ZWwobGV2ZWw6c3RyaW5nKXtcblx0XHR3b3JrZXJMb2cuc2V0TGV2ZWwobGV2ZWwpO1xuXHRcdGF3YWl0IHdvcmtlclJlYWR5O1xuXHRcdGF3YWl0IHRoaXMucG9zdE1lc3NhZ2UoJ3dvcmtlci1sb2ctbGV2ZWwnLCB7bGV2ZWx9KTtcblx0fVxuXG5cdHN0YXRpYyBhc3luYyBwb3N0TWVzc2FnZShvcDpzdHJpbmcsIGRhdGE6YW55KXtcblx0XHRpZiAob3AhPVwid2FsbGV0LWluaXRcIil7XG5cdFx0XHR3b3JrZXJMb2cuaW5mbyhgcG9zdE1lc3NhZ2U6OiAke29wfSwgJHtKU09OLnN0cmluZ2lmeShkYXRhKX1gKVxuXHRcdH1cblx0XHQvL0B0cy1pZ25vcmVcblx0XHR3b3JrZXIucG9zdE1lc3NhZ2Uoe29wLCBkYXRhfSlcblx0fVxuXG5cdHN0YXRpYyBmcm9tTW5lbW9uaWMoc2VlZFBocmFzZTogc3RyaW5nLCBuZXR3b3JrT3B0aW9uczogTmV0d29ya09wdGlvbnMsIG9wdGlvbnM6IFdhbGxldE9wdGlvbnMgPSB7fSk6IFdhbGxldFdyYXBwZXIge1xuXHRcdGlmICghbmV0d29ya09wdGlvbnMgfHwgIW5ldHdvcmtPcHRpb25zLm5ldHdvcmspXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYGZyb21NbmVtb25pYyhzZWVkUGhyYXNlLG5ldHdvcmtPcHRpb25zKTogbWlzc2luZyBuZXR3b3JrIGFyZ3VtZW50YCk7XG5cdFx0Y29uc3QgcHJpdktleSA9IG5ldyBXYWxsZXQuTW5lbW9uaWMoc2VlZFBocmFzZS50cmltKCkpLnRvSERQcml2YXRlS2V5KCkudG9TdHJpbmcoKTtcblx0XHRjb25zdCB3YWxsZXQgPSBuZXcgdGhpcyhwcml2S2V5LCBzZWVkUGhyYXNlLCBuZXR3b3JrT3B0aW9ucywgb3B0aW9ucyk7XG5cdFx0cmV0dXJuIHdhbGxldDtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgbmV3IFdhbGxldCBmcm9tIGVuY3J5cHRlZCB3YWxsZXQgZGF0YS5cblx0ICogQHBhcmFtIHBhc3N3b3JkIHRoZSBwYXNzd29yZCB0aGUgdXNlciBlbmNyeXB0ZWQgdGhlaXIgc2VlZCBwaHJhc2Ugd2l0aFxuXHQgKiBAcGFyYW0gZW5jcnlwdGVkTW5lbW9uaWMgdGhlIGVuY3J5cHRlZCBzZWVkIHBocmFzZSBmcm9tIGxvY2FsIHN0b3JhZ2Vcblx0ICogQHRocm93cyBXaWxsIHRocm93IFwiSW5jb3JyZWN0IHBhc3N3b3JkXCIgaWYgcGFzc3dvcmQgaXMgd3Jvbmdcblx0ICovXG5cdHN0YXRpYyBhc3luYyBpbXBvcnQgKHBhc3N3b3JkOiBzdHJpbmcsIGVuY3J5cHRlZE1uZW1vbmljOiBzdHJpbmcsIG5ldHdvcmtPcHRpb25zOiBOZXR3b3JrT3B0aW9ucywgb3B0aW9uczogV2FsbGV0T3B0aW9ucyA9IHt9KTogUHJvbWlzZSA8IFdhbGxldFdyYXBwZXIgPiB7XG5cdFx0Y29uc3QgZGVjcnlwdGVkID0gYXdhaXQgV2FsbGV0LnBhc3N3b3JkSGFuZGxlci5kZWNyeXB0KHBhc3N3b3JkLCBlbmNyeXB0ZWRNbmVtb25pYyk7XG5cdFx0Y29uc3Qgc2F2ZWRXYWxsZXQgPSBKU09OLnBhcnNlKGRlY3J5cHRlZCkgYXMgV2FsbGV0U2F2ZTtcblx0XHRjb25zdCBteVdhbGxldCA9IG5ldyB0aGlzKHNhdmVkV2FsbGV0LnByaXZLZXksIHNhdmVkV2FsbGV0LnNlZWRQaHJhc2UsIG5ldHdvcmtPcHRpb25zLCBvcHRpb25zKTtcblx0XHRyZXR1cm4gbXlXYWxsZXQ7XG5cdH1cblxuXHQvL0B0cy1pZ25vcmVcblx0d29ya2VyOldvcmtlcjtcblx0aXNXb3JrZXJSZWFkeT1mYWxzZTtcblx0cnBjOklSUEN8dW5kZWZpbmVkO1xuXHRfcGVuZGluZ0NCOk1hcDxzdHJpbmcsIENCSXRlbT4gPSBuZXcgTWFwKCk7XG5cdHN5bmNTaWduYWw6aGVscGVyLkRlZmVycmVkUHJvbWlzZXx1bmRlZmluZWQ7XG5cdGdycGNGbGFnc1N5bmNTaWduYWw6aGVscGVyLkRlZmVycmVkUHJvbWlzZXx1bmRlZmluZWQ7XG5cdHdvcmtlclJlYWR5OmhlbHBlci5EZWZlcnJlZFByb21pc2UgPSB3b3JrZXJSZWFkeTtcblx0YmFsYW5jZTp7YXZhaWxhYmxlOm51bWJlciwgcGVuZGluZzpudW1iZXIsIHRvdGFsOm51bWJlcn0gPSB7YXZhaWxhYmxlOjAsIHBlbmRpbmc6MCwgdG90YWw6MH07XG5cdF9yaWQyc3ViVWlkOk1hcDxzdHJpbmcsIHN0cmluZz4gPSBuZXcgTWFwKCk7XG5cdHVpZDpzdHJpbmc7XG5cdEhEV2FsbGV0OiBrYXNwYWNvcmUuSERQcml2YXRlS2V5O1xuXHRncnBjRmxhZ3M6e3V0eG9JbmRleD86Qm9vbGVhbn0gPSB7fTtcblxuXHRjb25zdHJ1Y3Rvcihwcml2S2V5OiBzdHJpbmcsIHNlZWRQaHJhc2U6IHN0cmluZywgbmV0d29ya09wdGlvbnM6IE5ldHdvcmtPcHRpb25zLCBvcHRpb25zOiBXYWxsZXRPcHRpb25zID0ge30pe1xuXHRcdHN1cGVyKCk7XG5cblx0XHRsZXQge3JwY30gPSBuZXR3b3JrT3B0aW9ucztcblx0XHRpZihycGMpe1xuXHRcdFx0dGhpcy5ycGMgPSBycGM7XG5cdFx0XHRpZihvcHRpb25zLmNoZWNrR1JQQ0ZsYWdzKXtcblx0XHRcdFx0dGhpcy5jaGVja0dSUENGbGFncygpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRkZWxldGUgbmV0d29ya09wdGlvbnMucnBjO1xuXG5cdFx0aWYgKHByaXZLZXkgJiYgc2VlZFBocmFzZSkge1xuXHRcdFx0dGhpcy5IRFdhbGxldCA9IG5ldyBrYXNwYWNvcmUuSERQcml2YXRlS2V5KHByaXZLZXkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCB0ZW1wID0gbmV3IFdhbGxldC5NbmVtb25pYyhXYWxsZXQuTW5lbW9uaWMuV29yZHMuRU5HTElTSCk7XG5cdFx0XHR0aGlzLkhEV2FsbGV0ID0gbmV3IGthc3BhY29yZS5IRFByaXZhdGVLZXkodGVtcC50b0hEUHJpdmF0ZUtleSgpLnRvU3RyaW5nKCkpO1xuXHRcdH1cblxuXHRcdHRoaXMudWlkID0gdGhpcy5jcmVhdGVVSUQobmV0d29ya09wdGlvbnMubmV0d29yayk7XG5cdFx0Ly9AdHMtaWdub3JlXG5cdFx0cnBjPy5zZXRTdHJlYW1VaWQ/Lih0aGlzLnVpZCk7XG5cdFx0Y29uc29sZS5sb2coXCJ3YWxsZXQudWlkXCIsIHRoaXMudWlkKVxuXG5cblx0XHR0aGlzLmluaXRXb3JrZXIoKTtcblxuXHRcdHRoaXMuaW5pdFdhbGxldChwcml2S2V5LCBzZWVkUGhyYXNlLCBuZXR3b3JrT3B0aW9ucywgb3B0aW9ucyk7XG5cdH1cblxuXHRjaGVja0dSUENGbGFncygpe1xuXHRcdGNvbnN0IHtycGN9ID0gdGhpcztcblx0XHRpZighcnBjKVxuXHRcdFx0cmV0dXJuXG5cdFx0dGhpcy5ncnBjRmxhZ3NTeW5jU2lnbmFsID0gaGVscGVyLkRlZmVycmVkKCk7XG5cdFx0cnBjLm9uQ29ubmVjdChhc3luYygpPT57XG5cdFx0XHQvL2NvbnNvbGUubG9nKFwiIyMjIyNycGMgb25Db25uZWN0IyMjIyMjI1wiKVxuXHRcdFx0bGV0IHJlc3VsdCA9IGF3YWl0IHJwYy5nZXRVdHhvc0J5QWRkcmVzc2VzKFtdKVxuXHRcdFx0LmNhdGNoKChlcnIpPT57XG5cdFx0XHRcdC8vZXJyb3IgPSBlcnI7XG5cdFx0XHR9KVxuXG5cdFx0XHRpZihyZXN1bHQpe1xuXHRcdFx0XHR0aGlzLmdycGNGbGFncy51dHhvSW5kZXggPSAhcmVzdWx0LmVycm9yPy5tZXNzYWdlPy5pbmNsdWRlcygnLS11dHhvaW5kZXgnKTtcblx0XHRcdFx0dGhpcy5lbWl0KFwiZ3JwYy1mbGFnc1wiLCB0aGlzLmdycGNGbGFncylcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5ncnBjRmxhZ3NTeW5jU2lnbmFsPy5yZXNvbHZlKCk7XG5cdFx0fSlcblx0fVxuXG5cdGNyZWF0ZVVJRChuZXR3b3JrOnN0cmluZyl7XG5cdFx0Y29uc3Qge3ByaXZhdGVLZXl9ID0gdGhpcy5IRFdhbGxldC5kZXJpdmVDaGlsZChgbS80NCcvOTcyLzAnLzEnLzAnYCk7XG5cdFx0bGV0IGFkZHJlc3MgPSBwcml2YXRlS2V5LnRvQWRkcmVzcyhuZXR3b3JrKS50b1N0cmluZygpLnNwbGl0KFwiOlwiKVsxXVxuXHRcdHJldHVybiBoZWxwZXIuc2hhMjU2KGFkZHJlc3MpO1xuXHR9XG5cblx0YXN5bmMgaW5pdFdhbGxldChwcml2S2V5OiBzdHJpbmcsIHNlZWRQaHJhc2U6IHN0cmluZywgbmV0d29ya09wdGlvbnM6IE5ldHdvcmtPcHRpb25zLCBvcHRpb25zOiBXYWxsZXRPcHRpb25zID0ge30pe1xuXHRcdGF3YWl0IHRoaXMud29ya2VyUmVhZHk7XG5cdFx0dGhpcy5wb3N0TWVzc2FnZSgnd2FsbGV0LWluaXQnLCB7XG5cdFx0XHRwcml2S2V5LFxuXHRcdFx0c2VlZFBocmFzZSxcblx0XHRcdG5ldHdvcmtPcHRpb25zLFxuXHRcdFx0b3B0aW9uc1xuXHRcdH0pO1xuXHR9XG5cblx0aW5pdFdvcmtlcigpe1xuXHRcdGlmKCF3b3JrZXIpXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJQbGVhc2UgaW5pdCBrYXNwYSBmcmFtZXdvcmsgdXNpbmcgJ2F3YWl0IGluaXRLYXNwYUZyYW1ld29yaygpOycuXCIpXG5cdFx0dGhpcy53b3JrZXIgPSB3b3JrZXI7XG5cdFx0b25Xb3JrZXJNZXNzYWdlID0gKG9wOnN0cmluZywgZGF0YTphbnkpPT57XG5cdFx0XHQvL2lmKG9wICE9ICdycGMtcmVxdWVzdCcpe1xuXHRcdFx0XHQvL2lmIChkYXRhPy5mbiAhPSBcIm1uZW1vbmljXCIpe1xuXHRcdFx0XHRcdC8vd29ya2VyTG9nLmluZm8oYG9uV29ya2VyTWVzc2FnZTogJHtvcH0sICR7SlNPTi5zdHJpbmdpZnkoZGF0YSl9YClcblx0XHRcdFx0Ly99XG5cdFx0XHQvL31cblx0XHRcdHN3aXRjaChvcCl7XG5cdFx0XHRcdGNhc2UgJ3JwYy1yZXF1ZXN0Jzpcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5oYW5kbGVSUENSZXF1ZXN0KGRhdGEpO1xuXHRcdFx0XHRjYXNlICd3YWxsZXQtcmVzcG9uc2UnOlxuXHRcdFx0XHRcdHJldHVybiB0aGlzLmhhbmRsZVJlc3BvbnNlKGRhdGEpO1xuXHRcdFx0XHRjYXNlICd3YWxsZXQtZXZlbnRzJzpcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5oYW5kbGVFdmVudHMoZGF0YSk7XG5cdFx0XHRcdGNhc2UgJ3dhbGxldC1wcm9wZXJ0eSc6XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuaGFuZGxlUHJvcGVydHkoZGF0YSk7XG5cdFx0XHR9XG5cblx0XHR9XG5cdH1cblxuXHRoYW5kbGVQcm9wZXJ0eShtc2c6e25hbWU6c3RyaW5nLCB2YWx1ZTphbnl9KXtcblx0XHQvL0B0cy1pZ25vcmVcblx0XHR0aGlzW25hbWVdID0gdmFsdWU7XG5cdH1cblxuXHRoYW5kbGVFdmVudHMobXNnOntuYW1lOnN0cmluZywgZGF0YTphbnl9KXtcblx0XHRsZXQge25hbWUsIGRhdGF9ID0gbXNnO1xuXHRcdGlmKG5hbWUgPT0gJ2JhbGFuY2UtdXBkYXRlJyl7XG5cdFx0XHR0aGlzLmJhbGFuY2UgPSBkYXRhO1xuXHRcdH1cblx0XHR0aGlzLmVtaXQobmFtZSwgZGF0YSk7XG5cdH1cblxuXHRhc3luYyBoYW5kbGVSZXNwb25zZShtc2c6e3JpZDpzdHJpbmcsIGVycm9yPzphbnksIHJlc3VsdD86YW55fSl7XG5cdFx0bGV0IHtyaWQsIGVycm9yLCByZXN1bHR9ID0gbXNnO1xuXHRcdGxldCBpdGVtOkNCSXRlbXx1bmRlZmluZWQgPSB0aGlzLl9wZW5kaW5nQ0IuZ2V0KHJpZCk7XG5cdFx0aWYoIWl0ZW0pXG5cdFx0XHRyZXR1cm5cblx0XHRcblx0XHRpdGVtLmNiKGVycm9yLCByZXN1bHQpO1xuXHRcdHRoaXMuX3BlbmRpbmdDQi5kZWxldGUocmlkKTtcblx0fVxuXHRhc3luYyBoYW5kbGVSUENSZXF1ZXN0KG1zZzp7Zm46c3RyaW5nLCBhcmdzOmFueSwgcmlkPzpzdHJpbmd9KXtcblx0XHR3b3JrZXJMb2cuZGVidWcoYFJQQ1JlcXVlc3Q6ICR7SlNPTi5zdHJpbmdpZnkobXNnKX1gKVxuXHRcdGNvbnN0IHtmbiwgYXJncywgcmlkfSA9IG1zZztcblxuXG5cdFx0Y29uc3QgdXR4b1JlbGF0ZWRGbnMgPSBbXG5cdFx0XHQnbm90aWZ5VXR4b3NDaGFuZ2VkUmVxdWVzdCcsXG5cdFx0XHQnZ2V0VXR4b3NCeUFkZHJlc3Nlc1JlcXVlc3QnLFxuXHRcdFx0J3N0b3BOb3RpZnlpbmdVdHhvc0NoYW5nZWRSZXF1ZXN0J1xuXHRcdF07XG5cdFx0Ly9jb25zb2xlLmxvZyhcImZuZm5cIiwgZm4sIGFyZ3NbMF0pXG5cdFx0aWYoYXJnc1swXSAmJiB1dHhvUmVsYXRlZEZucy5pbmNsdWRlcyhhcmdzWzBdKSAmJiB0aGlzLmdycGNGbGFnc1N5bmNTaWduYWwpe1xuXHRcdFx0YXdhaXQgdGhpcy5ncnBjRmxhZ3NTeW5jU2lnbmFsO1xuXHRcdFx0aWYoIXRoaXMuZ3JwY0ZsYWdzLnV0eG9JbmRleCl7XG5cdFx0XHRcdHRoaXMucG9zdE1lc3NhZ2UoXCJycGMtcmVzcG9uc2VcIiwge1xuXHRcdFx0XHRcdHJpZCxcblx0XHRcdFx0XHRyZXN1bHQ6e1xuXHRcdFx0XHRcdFx0ZXJyb3I6e1xuXHRcdFx0XHRcdFx0XHRlcnJvckNvZGU6XCJVVFhPSU5ERVgtRkxBRy1NSVNTSU5HXCIsXG5cdFx0XHRcdFx0XHRcdG1lc3NhZ2U6XCJVVFhPSU5ERVggRkxBRyBJU1NVRVwiXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYoZm49PVwidW5TdWJzY3JpYmVcIil7XG5cdFx0XHRpZihhcmdzWzFdKXtcblx0XHRcdFx0YXJnc1sxXSA9IHRoaXMuX3JpZDJzdWJVaWQuZ2V0KGFyZ3NbMV0pOy8vcmlkIHRvIHN1YmlkXG5cdFx0XHRcdGlmKCFhcmdzWzFdKVxuXHRcdFx0XHRcdHJldHVyblxuXHRcdFx0fVxuXHRcdFx0Ly9AdHMtaWdub3JlXG5cdFx0XHR0aGlzLnJwYy51blN1YnNjcmliZSguLi5hcmdzKTtcblx0XHRcdHJldHVyblxuXHRcdH1cblxuXHRcdGxldCBkaXJlY3RGbnMgPSBbXG5cdFx0XHQnb25Db25uZWN0JywgJ29uRGlzY29ubmVjdCcsICdvbkNvbm5lY3RGYWlsdXJlJywgJ29uRXJyb3InLCBcblx0XHRcdCdkaXNjb25uZWN0JywgJ2Nvbm5lY3QnXG5cdFx0XTtcblxuXHRcdGlmKGRpcmVjdEZucy5pbmNsdWRlcyhmbikpe1xuXHRcdFx0aWYocmlkKXtcblx0XHRcdFx0YXJncy5wdXNoKChyZXN1bHQ6YW55KT0+e1xuXHRcdFx0XHRcdHRoaXMucG9zdE1lc3NhZ2UoXCJycGMtZGlyZWN0XCIsIHtyaWQsIHJlc3VsdH0pXG5cdFx0XHRcdH0pXG5cdFx0XHR9XG5cdFx0XHQvL0B0cy1pZ25vcmVcblx0XHRcdHRoaXMucnBjW2ZuXSguLi5hcmdzKVxuXHRcdFx0cmV0dXJuXG5cdFx0fVxuXG5cblx0XHRpZihmbj09J3N1YnNjcmliZScpe1xuXHRcdFx0YXJncy5wdXNoKChyZXN1bHQ6YW55KT0+e1xuXHRcdFx0XHR0aGlzLnBvc3RNZXNzYWdlKFwicnBjLXB1Ymxpc2hcIiwge21ldGhvZDphcmdzWzBdLCByaWQsIHJlc3VsdH0pXG5cdFx0XHR9KVxuXHRcdH1cblxuXHRcdC8vQHRzLWlnbm9yZVxuXHRcdGxldCBwID0gdGhpcy5ycGNbZm5dKC4uLmFyZ3MpXG5cdFx0bGV0IHt1aWQ6c3ViVWlkfSA9IHA7XG5cdFx0bGV0IGVycm9yO1xuXHRcdGxldCByZXN1bHQgPSBhd2FpdCBwXG5cdFx0LmNhdGNoKChlcnI6YW55KT0+e1xuXHRcdFx0ZXJyb3IgPSBlcnI7XG5cdFx0fSk7XG5cblx0XHRpZihmbj09J3N1YnNjcmliZScgJiYgcmlkKXtcblx0XHRcdHRoaXMuX3JpZDJzdWJVaWQuc2V0KHJpZCwgc3ViVWlkKTtcblx0XHR9XG5cblx0XHR0aGlzLnBvc3RNZXNzYWdlKFwicnBjLXJlc3BvbnNlXCIsIHtyaWQsIHJlc3VsdCwgZXJyb3J9KVxuXHR9XG5cblx0cG9zdE1lc3NhZ2Uob3A6c3RyaW5nLCBkYXRhOmFueSl7XG5cdFx0V2FsbGV0V3JhcHBlci5wb3N0TWVzc2FnZShvcCwgZGF0YSlcblx0fVxuXG5cdGFzeW5jIHJlcXVlc3QoZm46c3RyaW5nLCBhcmdzOmFueVtdLCBjYWxsYmFjazpGdW5jdGlvbnx1bmRlZmluZWQ9dW5kZWZpbmVkKXtcblx0XHRhd2FpdCB0aGlzLndvcmtlclJlYWR5XG5cdFx0bGV0IHJpZCA9IHVuZGVmaW5lZDtcblx0XHRpZihjYWxsYmFjayl7XG5cdFx0XHRyaWQgPSB0aGlzLmNyZWF0ZVBlbmRpbmdDYWxsKGNhbGxiYWNrKVxuXHRcdH1cblx0XHR3b3JrZXJMb2cuZGVidWcoYHdhbGxldC1yZXF1ZXN0OiAke2ZufSwgJHtKU09OLnN0cmluZ2lmeShhcmdzKX0sICAke3JpZH1gKVxuXHRcdHRoaXMud29ya2VyLnBvc3RNZXNzYWdlKHtvcDpcIndhbGxldC1yZXF1ZXN0XCIsIGRhdGE6e2ZuLCBhcmdzLCByaWR9fSlcblx0fVxuXG5cdHJlcXVlc3RQcm9taXNpZnk8VD4oZm46c3RyaW5nLCAuLi5hcmdzOmFueVtdKTpQcm9taXNlPFQ+e1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+e1xuXHRcdFx0dGhpcy5yZXF1ZXN0KGZuLCBhcmdzLCAoZXJyb3I6YW55LCByZXN1bHQ6YW55KT0+e1xuXHRcdFx0XHRpZihlcnJvcilcblx0XHRcdFx0XHRyZXR1cm4gcmVqZWN0KGVycm9yKTtcblx0XHRcdFx0cmVzb2x2ZShyZXN1bHQpO1xuXHRcdFx0fSlcblx0XHR9KVxuXHR9XG5cblx0Y3JlYXRlUGVuZGluZ0NhbGwoY2I6RnVuY3Rpb24pOnN0cmluZ3tcblx0XHRjb25zdCB1aWQgPSBVSUQoKTtcblx0XHR0aGlzLl9wZW5kaW5nQ0Iuc2V0KHVpZCwge3VpZCwgY2J9KTtcblx0XHRyZXR1cm4gdWlkO1xuXHR9XG5cblx0YXN5bmMgc3luYyhzeW5jT25jZTpib29sZWFufHVuZGVmaW5lZCA9IHVuZGVmaW5lZCl7XG5cdFx0dGhpcy5zeW5jU2lnbmFsID0gaGVscGVyLkRlZmVycmVkKCk7XG5cdFx0bGV0IGFyZ3MgPSBbXTtcblx0XHRpZihzeW5jT25jZSAhPT0gdW5kZWZpbmVkKVxuXHRcdFx0YXJncy5wdXNoKHN5bmNPbmNlKTtcblxuXHRcdHRoaXMucmVxdWVzdChcInN5bmNcIiwgYXJncywgKCk9Pntcblx0XHRcdHRoaXMuc3luY1NpZ25hbD8ucmVzb2x2ZSgpO1xuXHRcdH0pXG5cblx0XHRyZXR1cm4gdGhpcy5zeW5jU2lnbmFsO1xuXHR9XG5cblx0c2V0TG9nTGV2ZWwobGV2ZWw6IHN0cmluZyl7XG5cdFx0dGhpcy5yZXF1ZXN0KFwic2V0TG9nTGV2ZWxcIiwgW2xldmVsXSlcblx0fVxuXG5cdHN0YXJ0VVRYT3NQb2xsaW5nKCl7XG5cdFx0dGhpcy5yZXF1ZXN0KFwic3RhcnRVVFhPc1BvbGxpbmdcIiwgW10pO1xuXHR9XG5cblx0Z2V0KG5hbWU6c3RyaW5nLCB3YWl0Rm9yU3luYzpib29sZWFuPWZhbHNlKXtcblx0XHRyZXR1cm4gbmV3IFByb21pc2UoYXN5bmMocmVzb2x2ZSwgcmVqZWN0KT0+e1xuXHRcdFx0aWYod2FpdEZvclN5bmMpXG5cdFx0XHRcdGF3YWl0IHRoaXMuc3luY1NpZ25hbDtcblx0XHRcdHRoaXMucmVxdWVzdChuYW1lLCBbXSwgKGVycm9yOmFueSwgcmVzdWx0OmFueSk9Pntcblx0XHRcdFx0aWYoZXJyb3IpXG5cdFx0XHRcdFx0cmV0dXJuIHJlamVjdChlcnJvcilcblxuXHRcdFx0XHRyZXNvbHZlKHJlc3VsdCk7XG5cdFx0XHR9KVxuXHRcdH0pXG5cdH1cblxuXHRnZXRBZnRlclN5bmMobmFtZTpzdHJpbmcpe1xuXHRcdHJldHVybiB0aGlzLmdldChuYW1lLCB0cnVlKVxuXHR9XG5cblx0Z2V0IG1uZW1vbmljKCl7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0KFwibW5lbW9uaWNcIilcblx0fVxuXHRnZXQgcmVjZWl2ZUFkZHJlc3MoKXtcblx0XHRyZXR1cm4gdGhpcy5nZXRBZnRlclN5bmMoXCJyZWNlaXZlQWRkcmVzc1wiKVxuXHR9XG5cblx0LyoqXG5cdCAqIFNlbmQgYSB0cmFuc2FjdGlvbi4gUmV0dXJucyB0cmFuc2FjdGlvbiBpZC5cblx0ICogQHBhcmFtIHR4UGFyYW1zXG5cdCAqIEBwYXJhbSB0eFBhcmFtcy50b0FkZHIgVG8gYWRkcmVzcyBpbiBjYXNoYWRkciBmb3JtYXQgKGUuZy4ga2FzcGF0ZXN0OnFxMGQ2aDBwcmptNW1wZGxkNXBuY3N0M2FkdTB5YW02eGNoNHRyNjlrMilcblx0ICogQHBhcmFtIHR4UGFyYW1zLmFtb3VudCBBbW91bnQgdG8gc2VuZCBpbiBzb21waXMgKDEwMDAwMDAwMCAoMWU4KSBzb21waXMgaW4gMSBLQVMpXG5cdCAqIEBwYXJhbSB0eFBhcmFtcy5mZWUgRmVlIGZvciBtaW5lcnMgaW4gc29tcGlzXG5cdCAqIEB0aHJvd3MgYEZldGNoRXJyb3JgIGlmIGVuZHBvaW50IGlzIGRvd24uIEFQSSBlcnJvciBtZXNzYWdlIGlmIHR4IGVycm9yLiBFcnJvciBpZiBhbW91bnQgaXMgdG9vIGxhcmdlIHRvIGJlIHJlcHJlc2VudGVkIGFzIGEgamF2YXNjcmlwdCBudW1iZXIuXG5cdCAqL1xuXHRzdWJtaXRUcmFuc2FjdGlvbih0eFBhcmFtc0FyZzpUeFNlbmQsIGRlYnVnID0gZmFsc2UpOiBQcm9taXNlIDxUeFJlc3B8bnVsbD4ge1xuXHRcdHJldHVybiB0aGlzLnJlcXVlc3RQcm9taXNpZnk8VHhSZXNwfG51bGw+KFwic3VibWl0VHJhbnNhY3Rpb25cIiwgdHhQYXJhbXNBcmcsIGRlYnVnKVxuXHR9XG5cblx0LyoqXG5cdCAqIFNlbmQgYSB0cmFuc2FjdGlvbi4gUmV0dXJucyB0cmFuc2FjdGlvbiBpZC5cblx0ICogQHBhcmFtIHR4UGFyYW1zXG5cdCAqIEBwYXJhbSB0eFBhcmFtcy50b0FkZHIgVG8gYWRkcmVzcyBpbiBjYXNoYWRkciBmb3JtYXQgKGUuZy4ga2FzcGF0ZXN0OnFxMGQ2aDBwcmptNW1wZGxkNXBuY3N0M2FkdTB5YW02eGNoNHRyNjlrMilcblx0ICogQHBhcmFtIHR4UGFyYW1zLmFtb3VudCBBbW91bnQgdG8gc2VuZCBpbiBzb21waXMgKDEwMDAwMDAwMCAoMWU4KSBzb21waXMgaW4gMSBLQVMpXG5cdCAqIEBwYXJhbSB0eFBhcmFtcy5mZWUgRmVlIGZvciBtaW5lcnMgaW4gc29tcGlzXG5cdCAqIEB0aHJvd3MgYEZldGNoRXJyb3JgIGlmIGVuZHBvaW50IGlzIGRvd24uIEFQSSBlcnJvciBtZXNzYWdlIGlmIHR4IGVycm9yLiBFcnJvciBpZiBhbW91bnQgaXMgdG9vIGxhcmdlIHRvIGJlIHJlcHJlc2VudGVkIGFzIGEgamF2YXNjcmlwdCBudW1iZXIuXG5cdCAqL1xuXHRlc3RpbWF0ZVRyYW5zYWN0aW9uKHR4UGFyYW1zQXJnOlR4U2VuZCk6IFByb21pc2U8VHhJbmZvPntcblx0XHRyZXR1cm4gdGhpcy5yZXF1ZXN0UHJvbWlzaWZ5PFR4SW5mbz4oXCJlc3RpbWF0ZVRyYW5zYWN0aW9uXCIsIHR4UGFyYW1zQXJnKVxuXHR9XG5cblx0LyoqXG5cdCAqIFVwZGF0ZSB0cmFuc2NhdGlvbnMgdGltZVxuXHQgKi9cblx0c3RhcnRVcGRhdGluZ1RyYW5zYWN0aW9ucyh2ZXJzaW9uOnVuZGVmaW5lZHxudW1iZXI9dW5kZWZpbmVkKTpQcm9taXNlPGJvb2xlYW4+e1xuXHRcdHJldHVybiB0aGlzLnJlcXVlc3RQcm9taXNpZnk8Ym9vbGVhbj4oXCJzdGFydFVwZGF0aW5nVHJhbnNhY3Rpb25zXCIsIHZlcnNpb24pXG5cdH1cblxuXHQvKipcblx0KiBDb21wb3VuZCBVVFhPcyBieSByZS1zZW5kaW5nIGZ1bmRzIHRvIGl0c2VsZlxuXHQqL1x0XG5cdGNvbXBvdW5kVVRYT3ModHhDb21wb3VuZE9wdGlvbnM6VHhDb21wb3VuZE9wdGlvbnM9e30sIGRlYnVnPWZhbHNlKTogUHJvbWlzZSA8VHhSZXNwfG51bGw+IHtcblx0XHRyZXR1cm4gdGhpcy5yZXF1ZXN0UHJvbWlzaWZ5PFR4UmVzcHxudWxsPihcImNvbXBvdW5kVVRYT3NcIiwgdHhDb21wb3VuZE9wdGlvbnMsIGRlYnVnKTtcblx0fVxuXG5cdHNjYW5Nb3JlQWRkcmVzc2VzKGNvdW50PTEwMCwgZGVidWc9ZmFsc2UsIHJlY2VpdmVTdGFydD0tMSwgY2hhbmdlU3RhcnQ9LTEpOiBQcm9taXNlPFNjYW5lTW9yZVJlc3VsdHxudWxsPntcblx0XHRyZXR1cm4gdGhpcy5yZXF1ZXN0UHJvbWlzaWZ5PFNjYW5lTW9yZVJlc3VsdHxudWxsPihcInNjYW5Nb3JlQWRkcmVzc2VzXCIsIGNvdW50LCBkZWJ1ZywgcmVjZWl2ZVN0YXJ0LCBjaGFuZ2VTdGFydCk7XG5cdH1cblxuXHQvKipcblx0ICogR2VuZXJhdGVzIGVuY3J5cHRlZCB3YWxsZXQgZGF0YS5cblx0ICogQHBhcmFtIHBhc3N3b3JkIHVzZXIncyBjaG9zZW4gcGFzc3dvcmRcblx0ICogQHJldHVybnMgUHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIG9iamVjdC1saWtlIHN0cmluZy4gU3VnZ2VzdGVkIHRvIHN0b3JlIGFzIHN0cmluZyBmb3IgLmltcG9ydCgpLlxuXHQgKi9cblx0ZXhwb3J0IChwYXNzd29yZDogc3RyaW5nKTogUHJvbWlzZSA8c3RyaW5nPiB7XG5cdFx0cmV0dXJuIHRoaXMucmVxdWVzdFByb21pc2lmeTxzdHJpbmc+KFwiZXhwb3J0XCIsIHBhc3N3b3JkKVxuXHR9XG5cblx0cmVzdG9yZUNhY2hlKGNhY2hlOiBXYWxsZXRDYWNoZSl7XG5cdFx0dGhpcy5yZXF1ZXN0KFwicmVzdG9yZUNhY2hlXCIsIFtjYWNoZV0pXG5cdH1cblx0Y2xlYXJVc2VkVVRYT3MoKXtcblx0XHR0aGlzLnJlcXVlc3QoXCJjbGVhclVzZWRVVFhPc1wiLCBbXSlcblx0fVxufVxuXG5cbmV4cG9ydCB7V2FsbGV0V3JhcHBlcn0iXX0=