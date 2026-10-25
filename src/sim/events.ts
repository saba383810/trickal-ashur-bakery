import type { BreadId } from '../config/breads';

export interface Payment {
  total: number;
  base: number;
  tip: number;
  combo: number;
  nell: number;
  tipRate: number;
}

// sim → view/audio への通知。step / コマンドの中で積まれ、view が毎フレーム回収する。
export type GameEvent =
  | { type: 'pick'; bread: BreadId }
  | { type: 'pickFail'; bread: BreadId; reason: 'empty' | 'full' }
  | { type: 'return'; bread: BreadId }
  | { type: 'customerArrive'; customerId: number }
  | { type: 'servePartial'; customerId: number; breads: BreadId[] }
  | { type: 'serveWrong'; customerId: number }
  | { type: 'serveComplete'; customerId: number; payment: Payment; combo: number }
  | { type: 'customerAngry'; customerId: number }
  | { type: 'customerMochi'; customerId: number }
  | { type: 'komiArrive'; customerId: number }
  /** again = 待ちくたびれてまた寝た / false = 寝ているのに渡そうとした */
  | { type: 'komiSleep'; customerId: number; again: boolean }
  | { type: 'komiWake'; customerId: number }
  | { type: 'butterArrive'; customerId: number }
  | { type: 'butterShot'; customerId: number }
  | { type: 'bakeStart'; oven: number; bread: BreadId }
  | { type: 'ovenReady'; oven: number }
  | { type: 'ovenTakeOut'; oven: number; bread: BreadId; count: number }
  | { type: 'ovenBurnt'; oven: number }
  | { type: 'ovenClear'; oven: number }
  | { type: 'elfinEnter' }
  | { type: 'elfinEat'; bread: BreadId; price: number }
  | { type: 'elfinGrab' }
  | { type: 'elfinStun' }
  | { type: 'elfinLaunched' }
  | { type: 'elfinLeave'; full: boolean }
  /** ネルが来る / フィーバーが始まった */
  | { type: 'elfinFlee'; reason: 'nell' | 'fever' }
  | { type: 'nellAnnounce' }
  | { type: 'nellArrive'; customerId: number }
  | { type: 'nellPeek'; customerId: number }
  | { type: 'nellWrong'; customerId: number }
  | { type: 'nellSuccess'; customerId: number; tabPaid: number; payment: Payment }
  | { type: 'nellFail'; customerId: number }
  | { type: 'buffEnd' }
  /** ブルミが窓に張り付きに来た / タップされた / 帰った */
  | { type: 'burumiArrive'; window: 0 | 1 }
  | { type: 'burumiCatch'; window: 0 | 1; reward: number }
  | { type: 'burumiLeave'; window: 0 | 1 }
  | { type: 'feverStart'; duration: number }
  | { type: 'feverEnd' }
  | { type: 'timeWarning' }
  /** エンドレス: 会計で残り時間が延びた */
  | { type: 'timeExtend'; seconds: number }
  /** エンドレス: 忙しさが上がった */
  | { type: 'levelUp'; level: number }
  | { type: 'timeUp' };
