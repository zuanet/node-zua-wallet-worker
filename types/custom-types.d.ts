export * from '@zua/wallet/types/rpc';

import {RPC} from '@zua/wallet/types/rpc';

export interface SubscriberItem{
  uid:string;
  callback:function;
}

export declare type SubscriberItemMap = Map<string, SubscriberItem[]>;
