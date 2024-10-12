"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventEmitter = exports.CB = void 0;
const CB = (msg) => { };
exports.CB = CB;
class EventEmitter {
    constructor() {
        this.eventListeners = new Map();
        this.init();
    }
    init() {
        /*
        addEventListener("message", (event)=>{
            let {data:msg} = event;
            if(!msg || !msg.op)
                return
            console.log("event", event)

            let {op, data} = msg;
            this.emit(op, data);
        })
        */
    }
    on(eventName, fn) {
        let list = this.eventListeners.get(eventName);
        if (!list) {
            list = [];
            this.eventListeners.set(eventName, list);
        }
        list.push(fn);
    }
    emit(eventName, data) {
        let list = this.eventListeners.get(eventName);
        if (!list)
            return;
        list.map(fn => {
            fn(data);
        });
    }
    postMessage(op, data = {}) {
        //@ts-ignore
        postMessage({ op, data });
    }
}
exports.EventEmitter = EventEmitter;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnQtZW1pdHRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi9ldmVudC1lbWl0dGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFPLE1BQU0sRUFBRSxHQUFHLENBQUMsR0FBTyxFQUFDLEVBQUUsR0FBQyxDQUFDLENBQUM7QUFBbkIsUUFBQSxFQUFFLE1BQWlCO0FBR2hDLE1BQWEsWUFBWTtJQUV4QjtRQURBLG1CQUFjLEdBQTBCLElBQUksR0FBRyxFQUFFLENBQUM7UUFFakQsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ2IsQ0FBQztJQUNELElBQUk7UUFDSDs7Ozs7Ozs7OztVQVVFO0lBQ0gsQ0FBQztJQUNELEVBQUUsQ0FBQyxTQUFnQixFQUFFLEVBQVU7UUFDOUIsSUFBSSxJQUFJLEdBQXVCLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ2xFLElBQUcsQ0FBQyxJQUFJLEVBQUM7WUFDUixJQUFJLEdBQUcsRUFBRSxDQUFDO1lBQ1YsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQ3pDO1FBQ0QsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQTtJQUNkLENBQUM7SUFDRCxJQUFJLENBQUMsU0FBZ0IsRUFBRSxJQUFRO1FBQzlCLElBQUksSUFBSSxHQUF1QixJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNsRSxJQUFHLENBQUMsSUFBSTtZQUNQLE9BQU07UUFDUCxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQSxFQUFFO1lBQ1osRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ1YsQ0FBQyxDQUFDLENBQUE7SUFDSCxDQUFDO0lBQ0QsV0FBVyxDQUFDLEVBQVMsRUFBRSxPQUFTLEVBQUU7UUFDakMsWUFBWTtRQUNaLFdBQVcsQ0FBQyxFQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUMsQ0FBQyxDQUFDO0lBQ3pCLENBQUM7Q0FDRDtBQXRDRCxvQ0FzQ0MiLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgY29uc3QgQ0IgPSAobXNnOmFueSk9Pnt9O1xyXG5leHBvcnQgdHlwZSBDQl9GVU5DID0gdHlwZW9mIENCO1xyXG5cclxuZXhwb3J0IGNsYXNzIEV2ZW50RW1pdHRlcntcclxuXHRldmVudExpc3RlbmVyczpNYXA8c3RyaW5nLCBDQl9GVU5DW10+ID0gbmV3IE1hcCgpO1xyXG5cdGNvbnN0cnVjdG9yKCl7XHJcblx0XHR0aGlzLmluaXQoKTtcclxuXHR9XHJcblx0aW5pdCgpe1xyXG5cdFx0LypcclxuXHRcdGFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIChldmVudCk9PntcclxuXHRcdFx0bGV0IHtkYXRhOm1zZ30gPSBldmVudDtcclxuXHRcdFx0aWYoIW1zZyB8fCAhbXNnLm9wKVxyXG5cdFx0XHRcdHJldHVyblxyXG5cdFx0XHRjb25zb2xlLmxvZyhcImV2ZW50XCIsIGV2ZW50KVxyXG5cclxuXHRcdFx0bGV0IHtvcCwgZGF0YX0gPSBtc2c7XHJcblx0XHRcdHRoaXMuZW1pdChvcCwgZGF0YSk7XHJcblx0XHR9KVxyXG5cdFx0Ki9cclxuXHR9XHJcblx0b24oZXZlbnROYW1lOnN0cmluZywgZm46Q0JfRlVOQyl7XHJcblx0XHRsZXQgbGlzdDpDQl9GVU5DW118dW5kZWZpbmVkID0gdGhpcy5ldmVudExpc3RlbmVycy5nZXQoZXZlbnROYW1lKTtcclxuXHRcdGlmKCFsaXN0KXtcclxuXHRcdFx0bGlzdCA9IFtdO1xyXG5cdFx0XHR0aGlzLmV2ZW50TGlzdGVuZXJzLnNldChldmVudE5hbWUsIGxpc3QpO1xyXG5cdFx0fVxyXG5cdFx0bGlzdC5wdXNoKGZuKVxyXG5cdH1cclxuXHRlbWl0KGV2ZW50TmFtZTpzdHJpbmcsIGRhdGE6YW55KXtcclxuXHRcdGxldCBsaXN0OkNCX0ZVTkNbXXx1bmRlZmluZWQgPSB0aGlzLmV2ZW50TGlzdGVuZXJzLmdldChldmVudE5hbWUpO1xyXG5cdFx0aWYoIWxpc3QpXHJcblx0XHRcdHJldHVyblxyXG5cdFx0bGlzdC5tYXAoZm49PntcclxuXHRcdFx0Zm4oZGF0YSk7XHJcblx0XHR9KVxyXG5cdH1cclxuXHRwb3N0TWVzc2FnZShvcDpzdHJpbmcsIGRhdGE6YW55PXt9KXtcclxuXHRcdC8vQHRzLWlnbm9yZVxyXG5cdFx0cG9zdE1lc3NhZ2Uoe29wLCBkYXRhfSk7XHJcblx0fVxyXG59XHJcbiJdfQ==