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
exports.RPC = exports.Client = exports.UID = void 0;
const UID = () => (Math.random() * 100000).toFixed(0) + Date.now();
exports.UID = UID;
class Client {
    constructor(core, options = {}) {
        this.callbacks = new Map();
        this.subscribers = new Map();
        this.pending = new Map();
        this.verbose = false;
        this.core = core;
        this.log = Function.prototype.bind.call(console.log, console, `[Zua gRPCProxy]:`);
        //seperate callback for direct function
        this.core.on('rpc-direct', (msg) => {
            const { rid, result } = msg;
            let CB = this.callbacks.get(rid);
            this.log("rpc-direct", rid, result, CB);
            if (!CB)
                return;
            CB(result);
        });
        this.core.on('rpc-response', (msg) => {
            const { rid, result, error } = msg;
            let pending = this.pending.get(rid);
            if (!pending)
                return;
            pending.cb(error, result);
            this.pending.delete(rid);
        });
        this.core.on('rpc-publish', (msg) => {
            const { result, method } = msg;
            let eventName = this.subject2EventName(method);
            this.verbose && this.log("subscribe:eventName", eventName);
            let subscribers = this.subscribers.get(eventName);
            if (!subscribers || !subscribers.length)
                return;
            subscribers.map(subscriber => {
                subscriber.callback(result);
            });
        });
    }
    cleanup() {
        this.callbacks.clear();
        this.subscribers.clear();
        this.pending.clear();
    }
    addCB(key, cb) {
        let uid = exports.UID();
        this.callbacks.set(uid, cb);
        return uid;
    }
    req(fn, args, rid = '') {
        this.core.postMessage("rpc-request", { fn, args, rid });
    }
    call(method, data = {}, type = "request", uid = undefined) {
        return new Promise((resolve, reject) => {
            let rid = uid || exports.UID();
            this.pending.set(rid, {
                method,
                cb: (error, result = undefined) => {
                    if (error)
                        return reject(error);
                    resolve(result);
                }
            });
            this.req(type, [method, data], rid);
        });
    }
    onConnect(callback) {
        let rid = this.addCB("onConnect", callback);
        this.req("onConnect", [], rid);
    }
    onDisconnect(callback) {
        let rid = this.addCB("onDisconnect", callback);
        this.req("onDisconnect", [], rid);
    }
    onConnectFailure(callback) {
        let rid = this.addCB("onConnectFailure", callback);
        this.req("onConnectFailure", [], rid);
    }
    onError(callback) {
        let rid = this.addCB("onError", callback);
        this.req("onError", [], rid);
    }
    disconnect() {
        this.req("disconnect", []);
    }
    connect() {
        this.req("connect", []);
    }
    subscribe(subject, data, callback) {
        let eventName = this.subject2EventName(subject);
        this.verbose && this.log("subscribe:eventName", eventName);
        let subscribers = this.subscribers.get(eventName);
        if (!subscribers) {
            subscribers = [];
            this.subscribers.set(eventName, subscribers);
        }
        let uid = exports.UID();
        subscribers.push({ uid, callback });
        let p = this.call(subject, data, "subscribe", uid);
        p.uid = uid;
        return p;
    }
    subject2EventName(subject) {
        let eventName = subject.replace("notify", "").replace("Request", "Notification");
        return eventName[0].toLowerCase() + eventName.substr(1);
    }
    unSubscribe(subject, uid = '') {
        this.req("unSubscribe", [subject, uid]);
        let eventName = this.subject2EventName(subject);
        let subscribers = this.subscribers.get(eventName);
        if (!subscribers)
            return;
        if (!uid) {
            this.subscribers.delete(eventName);
        }
        else {
            subscribers = subscribers.filter(sub => sub.uid != uid);
            this.subscribers.set(eventName, subscribers);
        }
    }
}
exports.Client = Client;
class RPC {
    constructor(options = {}) {
        this.client = options.client;
    }
    cleanup() {
        this.client.cleanup();
    }
    onConnect(callback) {
        this.client.onConnect(callback);
    }
    onConnectFailure(callback) {
        this.client.onConnectFailure(callback);
    }
    onError(callback) {
        this.client.onError(callback);
    }
    onDisconnect(callback) {
        this.client.onDisconnect(callback);
    }
    disconnect() {
        var _a;
        (_a = this.client) === null || _a === void 0 ? void 0 : _a.disconnect();
    }
    connect() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            return (_a = this.client) === null || _a === void 0 ? void 0 : _a.connect();
        });
    }
    unSubscribe(method, uid = '') {
        return this.client.unSubscribe(method, uid);
    }
    subscribe(method, data, callback) {
        return this.client.subscribe(method, data, callback);
    }
    request(method, data) {
        return this.client.call(method, data);
    }
    subscribeChainChanged(callback) {
        return this.subscribe("notifyChainChangedRequest", {}, callback);
    }
    subscribeBlockAdded(callback) {
        return this.subscribe("notifyBlockAddedRequest", {}, callback);
    }
    subscribeVirtualSelectedParentBlueScoreChanged(callback) {
        return this.subscribe("notifyVirtualSelectedParentBlueScoreChangedRequest", {}, callback);
    }
    subscribeUtxosChanged(addresses, callback) {
        return this.subscribe("notifyUtxosChangedRequest", { addresses }, callback);
    }
    unSubscribeUtxosChanged(uid = '') {
        this.unSubscribe("notifyUtxosChangedRequest", uid);
    }
    getBlock(hash) {
        return this.request('getBlockRequest', { hash, includeBlockVerboseData: true });
    }
    getTransactionsByAddresses(startingBlockHash, addresses) {
        return this.request('getTransactionsByAddressesRequest', {
            startingBlockHash, addresses
        });
    }
    getUtxosByAddresses(addresses) {
        return this.request('getUtxosByAddressesRequest', { addresses });
    }
    submitTransaction(tx) {
        return this.request('submitTransactionRequest', tx);
    }
    getVirtualSelectedParentBlueScore() {
        return this.request('getVirtualSelectedParentBlueScoreRequest', {});
    }
    getBlockDagInfo() {
        return this.request('getBlockDagInfoRequest', {});
    }
    subscribeVirtualDaaScoreChanged(callback) {
        return this.subscribe("notifyVirtualDaaScoreChangedRequest", {}, callback);
    }
}
exports.RPC = RPC;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnBjLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3JwYy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFHTyxNQUFNLEdBQUcsR0FBRyxHQUFFLEVBQUUsQ0FBQSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBQXZELFFBQUEsR0FBRyxPQUFvRDtBQUlwRSxNQUFhLE1BQU07SUFTbEIsWUFBWSxJQUFlLEVBQUUsVUFBWSxFQUFFO1FBUjNDLGNBQVMsR0FBeUIsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUM1QyxnQkFBVyxHQUFxQixJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQzFDLFlBQU8sR0FBNkMsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUU5RCxZQUFPLEdBQVcsS0FBSyxDQUFDO1FBS3ZCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxHQUFHLEdBQUcsUUFBUSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUN0QyxPQUFPLENBQUMsR0FBRyxFQUNYLE9BQU8sRUFDUCxvQkFBb0IsQ0FDcEIsQ0FBQztRQUVGLHVDQUF1QztRQUN2QyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxHQUE0QixFQUFDLEVBQUU7WUFDMUQsTUFBTSxFQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUMsR0FBRyxHQUFHLENBQUM7WUFDMUIsSUFBSSxFQUFFLEdBQXNCLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ3BELElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsRUFBRSxDQUFDLENBQUE7WUFDdkMsSUFBRyxDQUFDLEVBQUU7Z0JBQ0wsT0FBTTtZ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O0lBRUQsdUJBQXVCLENBQUMsTUFBVyxFQUFFO1FBQ3BDLElBQUksQ0FBQyxXQUFXLENBQUMsMkJBQTJCLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUVELFFBQVEsQ0FBQyxJQUFXO1FBQ25CLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBb0IsaUJBQWlCLEVBQUUsRUFBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUMsSUFBSSxFQUFDLENBQUMsQ0FBQztJQUNqRyxDQUFDO0lBQ0QsMEJBQTBCLENBQUMsaUJBQXdCLEVBQUUsU0FBa0I7UUFDdEUsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFzQyxtQ0FBbUMsRUFBRTtZQUM3RixpQkFBaUIsRUFBRSxTQUFTO1NBQzVCLENBQUMsQ0FBQztJQUNKLENBQUM7SUFDRCxtQkFBbUIsQ0FBQyxTQUFrQjtRQUNyQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQStCLDRCQUE0QixFQUFFLEVBQUMsU0FBUyxFQUFDLENBQUMsQ0FBQztJQUM5RixDQUFDO0lBQ0QsaUJBQWlCLENBQUMsRUFBZ0M7UUFDakQsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFnQywwQkFBMEIsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUNwRixDQUFDO0lBRUQsaUNBQWlDO1FBQ2hDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBNkMsMENBQTBDLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDakgsQ0FBQztJQUVELGVBQWU7UUFDZCxPQUFPLElBQUksQ0FBQyxPQUFPLENBQThCLHdCQUF3QixFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ2hGLENBQUM7SUFDRCwrQkFBK0IsQ0FBQyxRQUE2RDtRQUM1RixPQUFPLElBQUksQ0FBQyxTQUFTLENBQW1GLHFDQUFxQyxFQUFFLEVBQUUsRUFBRSxRQUFRLENBQUMsQ0FBQztJQUM5SixDQUFDO0NBQ0Q7QUEvRUQsa0JBK0VDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtJUlBDLCBSUEMgYXMgUnBjLCBTdWJzY3JpYmVySXRlbSwgU3Vic2NyaWJlckl0ZW1NYXB9IGZyb20gJy4uL3R5cGVzL2N1c3RvbS10eXBlcyc7XHJcbmltcG9ydCB7V29ya2VyQ29yZX0gZnJvbSAnLi93b3JrZXItY29yZSc7XHJcbmV4cG9ydCB0eXBlIENCSXRlbSA9IHt1aWQ/OnN0cmluZywgY2I6RnVuY3Rpb259O1xyXG5leHBvcnQgY29uc3QgVUlEID0gKCk9PihNYXRoLnJhbmRvbSgpKjEwMDAwMCkudG9GaXhlZCgwKStEYXRlLm5vdygpO1xyXG5cclxuZXhwb3J0IHtJUlBDfTtcclxuXHJcbmV4cG9ydCBjbGFzcyBDbGllbnR7XHJcblx0Y2FsbGJhY2tzOk1hcDxzdHJpbmcsIEZ1bmN0aW9uPiA9IG5ldyBNYXAoKTtcclxuXHRzdWJzY3JpYmVyczpTdWJzY3JpYmVySXRlbU1hcCA9IG5ldyBNYXAoKTtcclxuXHRwZW5kaW5nOk1hcDxzdHJpbmcsIHttZXRob2Q6c3RyaW5nLCBjYjpGdW5jdGlvbn0+ID0gbmV3IE1hcCgpO1xyXG5cclxuXHR2ZXJib3NlOmJvb2xlYW4gPSBmYWxzZTtcclxuXHRsb2c6RnVuY3Rpb247XHJcblx0Y29yZTpXb3JrZXJDb3JlO1xyXG5cclxuXHRjb25zdHJ1Y3Rvcihjb3JlOldvcmtlckNvcmUsIG9wdGlvbnM6YW55PXt9KXtcclxuXHRcdHRoaXMuY29yZSA9IGNvcmU7XHJcblx0XHR0aGlzLmxvZyA9IEZ1bmN0aW9uLnByb3RvdHlwZS5iaW5kLmNhbGwoXHJcblx0XHRcdGNvbnNvbGUubG9nLFxyXG5cdFx0XHRjb25zb2xlLFxyXG5cdFx0XHRgW0thc3BhIGdSUENQcm94eV06YFxyXG5cdFx0KTtcclxuXHJcblx0XHQvL3NlcGVyYXRlIGNhbGxiYWNrIGZvciBkaXJlY3QgZnVuY3Rpb25cclxuXHRcdHRoaXMuY29yZS5vbigncnBjLWRpcmVjdCcsIChtc2c6e3JpZDpzdHJpbmcsIHJlc3VsdDphbnl9KT0+e1xyXG5cdFx0XHRjb25zdCB7cmlkLCByZXN1bHR9ID0gbXNnO1xyXG5cdFx0XHRsZXQgQ0I6RnVuY3Rpb258dW5kZWZpbmVkID0gdGhpcy5jYWxsYmFja3MuZ2V0KHJpZCk7XHJcblx0XHRcdHRoaXMubG9nKFwicnBjLWRpcmVjdFwiLCByaWQsIHJlc3VsdCwgQ0IpXHJcblx0XHRcdGlmKCFDQilcclxuXHRcdFx0XHRyZXR1cm5cclxuXHRcdFx0Q0IocmVzdWx0KTtcclxuXHRcdH0pXHJcblxyXG5cdFx0dGhpcy5jb3JlLm9uKCdycGMtcmVzcG9uc2UnLCAobXNnOntyaWQ6c3RyaW5nLCByZXN1bHQ6YW55LCBlcnJvcjphbnl9KT0+e1xyXG5cdFx0XHRjb25zdCB7cmlkLCByZXN1bHQsIGVycm9yfSA9IG1zZztcclxuXHRcdFx0bGV0IHBlbmRpbmc6e21ldGhvZDpzdHJpbmcsIGNiOkZ1bmN0aW9ufXx1bmRlZmluZWQgPSB0aGlzLnBlbmRpbmcuZ2V0KHJpZCk7XHJcblx0XHRcdGlmKCFwZW5kaW5nKVxyXG5cdFx0XHRcdHJldHVyblxyXG5cdFx0XHRwZW5kaW5nLmNiKGVycm9yLCByZXN1bHQpO1xyXG5cdFx0XHRcclxuXHRcdFx0dGhpcy5wZW5kaW5nLmRlbGV0ZShyaWQpO1xyXG5cdFx0fSlcclxuXHJcblx0XHR0aGlzLmNvcmUub24oJ3JwYy1wdWJsaXNoJywgKG1zZzp7cmVzdWx0OmFueSwgbWV0aG9kOnN0cmluZ30pPT57XHJcblx0XHRcdGNvbnN0IHtyZXN1bHQsIG1ldGhvZH0gPSBtc2c7XHJcblx0XHRcdGxldCBldmVudE5hbWUgPSB0aGlzLnN1YmplY3QyRXZlbnROYW1lKG1ldGhvZCk7XHJcblx0XHRcdHRoaXMudmVyYm9zZSAmJiB0aGlzLmxvZyhcInN1YnNjcmliZTpldmVudE5hbWVcIiwgZXZlbnROYW1lKVxyXG5cclxuXHRcdFx0bGV0IHN1YnNjcmliZXJzOlN1YnNjcmliZXJJdGVtW118dW5kZWZpbmVkID0gdGhpcy5zdWJzY3JpYmVycy5nZXQoZXZlbnROYW1lKTtcclxuXHRcdFx0aWYoIXN1YnNjcmliZXJzIHx8ICFzdWJzY3JpYmVycy5sZW5ndGgpXHJcblx0XHRcdFx0cmV0dXJuXHJcblxyXG5cdFx0XHRzdWJzY3JpYmVycy5tYXAoc3Vic2NyaWJlcj0+e1xyXG5cdFx0XHRcdHN1YnNjcmliZXIuY2FsbGJhY2socmVzdWx0KVxyXG5cdFx0XHR9KVxyXG5cdFx0fSlcclxuXHR9XHJcblxyXG5cdGNsZWFudXAoKXtcclxuXHRcdHRoaXMuY2FsbGJhY2tzLmNsZWFyKCk7XHJcblx0XHR0aGlzLnN1YnNjcmliZXJzLmNsZWFyKCk7XHJcblx0XHR0aGlzLnBlbmRpbmcuY2xlYXIoKTtcclxuXHR9XHJcblxyXG5cdGFkZENCKGtleTpzdHJpbmcsIGNiOkZ1bmN0aW9uKXtcclxuXHRcdGxldCB1aWQgPSBVSUQoKTtcclxuXHRcdHRoaXMuY2FsbGJhY2tzLnNldCh1aWQsIGNiKTtcclxuXHRcdHJldHVybiB1aWQ7XHJcblx0fVxyXG5cclxuXHRyZXEoZm46c3RyaW5nLCBhcmdzOmFueVtdLCByaWQ6c3RyaW5nPScnKXtcclxuXHRcdHRoaXMuY29yZS5wb3N0TWVzc2FnZShcInJwYy1yZXF1ZXN0XCIsIHtmbiwgYXJncywgcmlkfSlcclxuXHR9XHJcblxyXG5cdGNhbGwobWV0aG9kOnN0cmluZywgZGF0YTphbnk9e30sIHR5cGU6c3RyaW5nPVwicmVxdWVzdFwiLCB1aWQ6c3RyaW5nfHVuZGVmaW5lZD11bmRlZmluZWQpe1xyXG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT57XHJcblx0XHRcdGxldCByaWQgPSB1aWQgfHwgVUlEKCk7XHJcblx0XHRcdHRoaXMucGVuZGluZy5zZXQocmlkLCB7XHJcblx0XHRcdFx0bWV0aG9kLFxyXG5cdFx0XHRcdGNiOihlcnJvcjphbnksIHJlc3VsdDphbnk9dW5kZWZpbmVkKT0+e1xyXG5cdFx0XHRcdFx0aWYoZXJyb3IpXHJcblx0XHRcdFx0XHRcdHJldHVybiByZWplY3QoZXJyb3IpO1xyXG5cdFx0XHRcdFx0cmVzb2x2ZShyZXN1bHQpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSlcclxuXHRcdFx0dGhpcy5yZXEodHlwZSwgW21ldGhvZCwgZGF0YV0sIHJpZCk7XHJcblx0XHR9KVxyXG5cdH1cclxuXHJcblx0b25Db25uZWN0KGNhbGxiYWNrOkZ1bmN0aW9uKXtcclxuXHRcdGxldCByaWQgPSB0aGlzLmFkZENCKFwib25Db25uZWN0XCIsIGNhbGxiYWNrKTtcclxuXHRcdHRoaXMucmVxKFwib25Db25uZWN0XCIsIFtdLCByaWQpO1xyXG5cdH1cclxuXHRvbkRpc2Nvbm5lY3QoY2FsbGJhY2s6RnVuY3Rpb24pe1xyXG5cdFx0bGV0IHJpZCA9IHRoaXMuYWRkQ0IoXCJvbkRpc2Nvbm5lY3RcIiwgY2FsbGJhY2spO1xyXG5cdFx0dGhpcy5yZXEoXCJvbkRpc2Nvbm5lY3RcIiwgW10sIHJpZCk7XHJcblx0fVxyXG5cdG9uQ29ubmVjdEZhaWx1cmUoY2FsbGJhY2s6RnVuY3Rpb24pe1xyXG5cdFx0bGV0IHJpZCA9IHRoaXMuYWRkQ0IoXCJvbkNvbm5lY3RGYWlsdXJlXCIsIGNhbGxiYWNrKTtcclxuXHRcdHRoaXMucmVxKFwib25Db25uZWN0RmFpbHVyZVwiLCBbXSwgcmlkKTtcclxuXHR9XHJcblx0b25FcnJvcihjYWxsYmFjazpGdW5jdGlvbil7XHJcblx0XHRsZXQgcmlkID0gdGhpcy5hZGRDQihcIm9uRXJyb3JcIiwgY2FsbGJhY2spO1xyXG5cdFx0dGhpcy5yZXEoXCJvbkVycm9yXCIsIFtdLCByaWQpO1xyXG5cdH1cclxuXHJcblx0ZGlzY29ubmVjdCgpe1xyXG5cdFx0dGhpcy5yZXEoXCJkaXNjb25uZWN0XCIsIFtdKTtcclxuXHR9XHJcblx0Y29ubmVjdCgpe1xyXG5cdFx0dGhpcy5yZXEoXCJjb25uZWN0XCIsIFtdKTtcclxuXHR9XHJcblxyXG5cdHN1YnNjcmliZTxUPihzdWJqZWN0OiBzdHJpbmcsIGRhdGE6IGFueSwgY2FsbGJhY2s6IEZ1bmN0aW9uKTogUnBjLlN1YlByb21pc2U8VD57XHJcblx0XHRsZXQgZXZlbnROYW1lID0gdGhpcy5zdWJqZWN0MkV2ZW50TmFtZShzdWJqZWN0KTtcclxuXHRcdHRoaXMudmVyYm9zZSAmJiB0aGlzLmxvZyhcInN1YnNjcmliZTpldmVudE5hbWVcIiwgZXZlbnROYW1lKVxyXG5cclxuXHRcdGxldCBzdWJzY3JpYmVyczpTdWJzY3JpYmVySXRlbVtdfHVuZGVmaW5lZCA9IHRoaXMuc3Vic2NyaWJlcnMuZ2V0KGV2ZW50TmFtZSk7XHJcblx0XHRpZighc3Vic2NyaWJlcnMpe1xyXG5cdFx0XHRzdWJzY3JpYmVycyA9IFtdO1xyXG5cdFx0XHR0aGlzLnN1YnNjcmliZXJzLnNldChldmVudE5hbWUsIHN1YnNjcmliZXJzKTtcclxuXHRcdH1cclxuXHRcdGxldCB1aWQgPSBVSUQoKTtcclxuXHRcdHN1YnNjcmliZXJzLnB1c2goe3VpZCwgY2FsbGJhY2t9KTtcclxuXHJcblx0XHRsZXQgcCA9IHRoaXMuY2FsbChzdWJqZWN0LCBkYXRhLCBcInN1YnNjcmliZVwiLCB1aWQpIGFzIFJwYy5TdWJQcm9taXNlPFQ+O1xyXG5cclxuXHRcdHAudWlkID0gdWlkO1xyXG5cdFx0cmV0dXJuIHA7XHJcblx0fVxyXG5cclxuXHRzdWJqZWN0MkV2ZW50TmFtZShzdWJqZWN0OnN0cmluZyl7XHJcblx0XHRsZXQgZXZlbnROYW1lID0gc3ViamVjdC5yZXBsYWNlKFwibm90aWZ5XCIsIFwiXCIpLnJlcGxhY2UoXCJSZXF1ZXN0XCIsIFwiTm90aWZpY2F0aW9uXCIpXHJcblx0XHRyZXR1cm4gZXZlbnROYW1lWzBdLnRvTG93ZXJDYXNlKCkrZXZlbnROYW1lLnN1YnN0cigxKTtcclxuXHR9XHJcblxyXG5cdHVuU3Vic2NyaWJlKHN1YmplY3Q6c3RyaW5nLCB1aWQ6c3RyaW5nPScnKXtcclxuXHRcdHRoaXMucmVxKFwidW5TdWJzY3JpYmVcIiwgW3N1YmplY3QsIHVpZF0pXHJcblx0XHRsZXQgZXZlbnROYW1lID0gdGhpcy5zdWJqZWN0MkV2ZW50TmFtZShzdWJqZWN0KTtcclxuXHRcdGxldCBzdWJzY3JpYmVyczpTdWJzY3JpYmVySXRlbVtdfHVuZGVmaW5lZCA9IHRoaXMuc3Vic2NyaWJlcnMuZ2V0KGV2ZW50TmFtZSk7XHJcblx0XHRpZighc3Vic2NyaWJlcnMpXHJcblx0XHRcdHJldHVyblxyXG5cdFx0aWYoIXVpZCl7XHJcblx0XHRcdHRoaXMuc3Vic2NyaWJlcnMuZGVsZXRlKGV2ZW50TmFtZSk7XHJcblx0XHR9ZWxzZXtcclxuXHRcdFx0c3Vic2NyaWJlcnMgPSBzdWJzY3JpYmVycy5maWx0ZXIoc3ViPT5zdWIudWlkIT11aWQpXHJcblx0XHRcdHRoaXMuc3Vic2NyaWJlcnMuc2V0KGV2ZW50TmFtZSwgc3Vic2NyaWJlcnMpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBSUEMgaW1wbGVtZW50cyBJUlBDe1xyXG5cdGNsaWVudDpDbGllbnQ7XHJcblx0Y2xlYW51cCgpe1xyXG5cdFx0dGhpcy5jbGllbnQuY2xlYW51cCgpO1xyXG5cdH1cclxuXHRjb25zdHJ1Y3RvcihvcHRpb25zOmFueT17fSl7XHJcblx0XHR0aGlzLmNsaWVudCA9IG9wdGlvbnMuY2xpZW50O1xyXG5cdH1cclxuXHRvbkNvbm5lY3QoY2FsbGJhY2s6RnVuY3Rpb24pe1xyXG5cdFx0dGhpcy5jbGllbnQub25Db25uZWN0KGNhbGxiYWNrKTtcclxuXHR9XHJcblx0b25Db25uZWN0RmFpbHVyZShjYWxsYmFjazpGdW5jdGlvbil7XHJcblx0XHR0aGlzLmNsaWVudC5vbkNvbm5lY3RGYWlsdXJlKGNhbGxiYWNrKTtcclxuXHR9XHJcblx0b25FcnJvcihjYWxsYmFjazpGdW5jdGlvbil7XHJcblx0XHR0aGlzLmNsaWVudC5vbkVycm9yKGNhbGxiYWNrKTtcclxuXHR9XHJcblx0b25EaXNjb25uZWN0KGNhbGxiYWNrOkZ1bmN0aW9uKXtcclxuXHRcdHRoaXMuY2xpZW50Lm9uRGlzY29ubmVjdChjYWxsYmFjayk7XHJcblx0fVxyXG5cdGRpc2Nvbm5lY3QoKXtcclxuXHRcdHRoaXMuY2xpZW50Py5kaXNjb25uZWN0KCk7XHJcblx0fVxyXG5cdGFzeW5jIGNvbm5lY3QoKXtcclxuXHRcdHJldHVybiB0aGlzLmNsaWVudD8uY29ubmVjdCgpO1xyXG5cdH1cclxuXHR1blN1YnNjcmliZShtZXRob2Q6c3RyaW5nLCB1aWQ6c3RyaW5nPScnKXtcclxuXHRcdHJldHVybiB0aGlzLmNsaWVudC51blN1YnNjcmliZShtZXRob2QsIHVpZCk7XHJcblx0fVxyXG5cdHN1YnNjcmliZTxULCBSPihtZXRob2Q6c3RyaW5nLCBkYXRhOmFueSwgY2FsbGJhY2s6UnBjLmNhbGxiYWNrPFI+KXtcclxuXHRcdHJldHVybiB0aGlzLmNsaWVudC5zdWJzY3JpYmU8VD4obWV0aG9kLCBkYXRhLCBjYWxsYmFjayk7XHJcblx0fVxyXG5cdHJlcXVlc3Q8VD4obWV0aG9kOnN0cmluZywgZGF0YTphbnkpe1xyXG5cdFx0cmV0dXJuIHRoaXMuY2xpZW50LmNhbGwobWV0aG9kLCBkYXRhKSBhcyBQcm9taXNlPFQ+O1xyXG5cdH1cclxuXHJcblx0c3Vic2NyaWJlQ2hhaW5DaGFuZ2VkKGNhbGxiYWNrOlJwYy5jYWxsYmFjazxScGMuQ2hhaW5DaGFuZ2VkTm90aWZpY2F0aW9uPil7XHJcblx0XHRyZXR1cm4gdGhpcy5zdWJzY3JpYmU8UnBjLk5vdGlmeUNoYWluQ2hhbmdlZFJlc3BvbnNlLCBScGMuQ2hhaW5DaGFuZ2VkTm90aWZpY2F0aW9uPihcIm5vdGlmeUNoYWluQ2hhbmdlZFJlcXVlc3RcIiwge30sIGNhbGxiYWNrKTtcclxuXHR9XHJcblx0c3Vic2NyaWJlQmxvY2tBZGRlZChjYWxsYmFjazpScGMuY2FsbGJhY2s8UnBjLkJsb2NrQWRkZWROb3RpZmljYXRpb24+KXtcclxuXHRcdHJldHVybiB0aGlzLnN1YnNjcmliZTxScGMuTm90aWZ5QmxvY2tBZGRlZFJlc3BvbnNlLCBScGMuQmxvY2tBZGRlZE5vdGlmaWNhdGlvbj4oXCJub3RpZnlCbG9ja0FkZGVkUmVxdWVzdFwiLCB7fSwgY2FsbGJhY2spO1xyXG5cdH1cclxuXHRzdWJzY3JpYmVWaXJ0dWFsU2VsZWN0ZWRQYXJlbnRCbHVlU2NvcmVDaGFuZ2VkKGNhbGxiYWNrOlJwYy5jYWxsYmFjazxScGMuVmlydHVhbFNlbGVjdGVkUGFyZW50Qmx1ZVNjb3JlQ2hhbmdlZE5vdGlmaWNhdGlvbj4pe1xyXG5cdFx0cmV0dXJuIHRoaXMuc3Vic2NyaWJlPFJwYy5Ob3RpZnlWaXJ0dWFsU2VsZWN0ZWRQYXJlbnRCbHVlU2NvcmVDaGFuZ2VkUmVzcG9uc2UsIFJwYy5WaXJ0dWFsU2VsZWN0ZWRQYXJlbnRCbHVlU2NvcmVDaGFuZ2VkTm90aWZpY2F0aW9uPihcIm5vdGlmeVZpcnR1YWxTZWxlY3RlZFBhcmVudEJsdWVTY29yZUNoYW5nZWRSZXF1ZXN0XCIsIHt9LCBjYWxsYmFjayk7XHJcblx0fVxyXG5cclxuXHRzdWJzY3JpYmVVdHhvc0NoYW5nZWQoYWRkcmVzc2VzOnN0cmluZ1tdLCBjYWxsYmFjazpScGMuY2FsbGJhY2s8UnBjLlV0eG9zQ2hhbmdlZE5vdGlmaWNhdGlvbj4pe1xyXG5cdFx0cmV0dXJuIHRoaXMuc3Vic2NyaWJlPFJwYy5Ob3RpZnlVdHhvc0NoYW5nZWRSZXNwb25zZSwgUnBjLlV0eG9zQ2hhbmdlZE5vdGlmaWNhdGlvbj4oXCJub3RpZnlVdHhvc0NoYW5nZWRSZXF1ZXN0XCIsIHthZGRyZXNzZXN9LCBjYWxsYmFjayk7XHJcblx0fVxyXG5cclxuXHR1blN1YnNjcmliZVV0eG9zQ2hhbmdlZCh1aWQ6c3RyaW5nPScnKXtcclxuXHRcdHRoaXMudW5TdWJzY3JpYmUoXCJub3RpZnlVdHhvc0NoYW5nZWRSZXF1ZXN0XCIsIHVpZCk7XHJcblx0fVxyXG5cclxuXHRnZXRCbG9jayhoYXNoOnN0cmluZyl7XHJcblx0XHRyZXR1cm4gdGhpcy5yZXF1ZXN0PFJwYy5CbG9ja1Jlc3BvbnNlPignZ2V0QmxvY2tSZXF1ZXN0Jywge2hhc2gsIGluY2x1ZGVCbG9ja1ZlcmJvc2VEYXRhOnRydWV9KTtcclxuXHR9XHJcblx0Z2V0VHJhbnNhY3Rpb25zQnlBZGRyZXNzZXMoc3RhcnRpbmdCbG9ja0hhc2g6c3RyaW5nLCBhZGRyZXNzZXM6c3RyaW5nW10pe1xyXG5cdFx0cmV0dXJuIHRoaXMucmVxdWVzdDxScGMuVHJhbnNhY3Rpb25zQnlBZGRyZXNzZXNSZXNwb25zZT4oJ2dldFRyYW5zYWN0aW9uc0J5QWRkcmVzc2VzUmVxdWVzdCcsIHtcclxuXHRcdFx0c3RhcnRpbmdCbG9ja0hhc2gsIGFkZHJlc3Nlc1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cdGdldFV0eG9zQnlBZGRyZXNzZXMoYWRkcmVzc2VzOnN0cmluZ1tdKXtcclxuXHRcdHJldHVybiB0aGlzLnJlcXVlc3Q8UnBjLlVUWE9zQnlBZGRyZXNzZXNSZXNwb25zZT4oJ2dldFV0eG9zQnlBZGRyZXNzZXNSZXF1ZXN0Jywge2FkZHJlc3Nlc30pO1xyXG5cdH1cclxuXHRzdWJtaXRUcmFuc2FjdGlvbih0eDogUnBjLlN1Ym1pdFRyYW5zYWN0aW9uUmVxdWVzdCl7XHJcblx0XHRyZXR1cm4gdGhpcy5yZXF1ZXN0PFJwYy5TdWJtaXRUcmFuc2FjdGlvblJlc3BvbnNlPignc3VibWl0VHJhbnNhY3Rpb25SZXF1ZXN0JywgdHgpO1xyXG5cdH1cclxuXHJcblx0Z2V0VmlydHVhbFNlbGVjdGVkUGFyZW50Qmx1ZVNjb3JlKCl7XHJcblx0XHRyZXR1cm4gdGhpcy5yZXF1ZXN0PFJwYy5WaXJ0dWFsU2VsZWN0ZWRQYXJlbnRCbHVlU2NvcmVSZXNwb25zZT4oJ2dldFZpcnR1YWxTZWxlY3RlZFBhcmVudEJsdWVTY29yZVJlcXVlc3QnLCB7fSk7XHJcblx0fVxyXG5cclxuXHRnZXRCbG9ja0RhZ0luZm8oKXtcclxuXHRcdHJldHVybiB0aGlzLnJlcXVlc3Q8UnBjLkdldEJsb2NrRGFnSW5mb1Jlc3BvbnNlPignZ2V0QmxvY2tEYWdJbmZvUmVxdWVzdCcsIHt9KTtcclxuXHR9XHJcblx0c3Vic2NyaWJlVmlydHVhbERhYVNjb3JlQ2hhbmdlZChjYWxsYmFjazpScGMuY2FsbGJhY2s8UnBjLlZpcnR1YWxEYWFTY29yZUNoYW5nZWROb3RpZmljYXRpb24+KXtcclxuXHRcdHJldHVybiB0aGlzLnN1YnNjcmliZTxScGMuTm90aWZ5VmlydHVhbERhYVNjb3JlQ2hhbmdlZFJlc3BvbnNlLCBScGMuVmlydHVhbERhYVNjb3JlQ2hhbmdlZE5vdGlmaWNhdGlvbj4oXCJub3RpZnlWaXJ0dWFsRGFhU2NvcmVDaGFuZ2VkUmVxdWVzdFwiLCB7fSwgY2FsbGJhY2spO1xyXG5cdH1cclxufSJdfQ==