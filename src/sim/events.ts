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
  /** バターがエルフィンをパチンコで撃った（すぐあとに elfinFlee が続く） */
  | { type: 'butterShot'; customerId: number }
  | { type: 'bakeStart'; oven: number; bread: BreadId }
  | { type: 'ovenReady'; oven: number }
  | { type: 'ovenTakeOut'; oven: number; bread: BreadId; count: number }
  | { type: 'ovenBurnt'; oven: number }
  | { type: 'ovenClear'; oven: number }
  | { type: 'elfinEnter' }
  /** パンを 1 個取った（代金はツケに） */
  | { type: 'elfinEat'; bread: BreadId; price: number }
  /** 取れるパンが無くてむくれた */
  | { type: 'elfinSulk' }
  /** took = パンを抱えて帰る / false = むくれて手ぶらで帰る */
  | { type: 'elfinLeave'; took: boolean }
  /** パンを取る前に、ネルが来る / フィーバーが始まった / バターに撃たれた で手ぶらで逃げる */
  | { type: 'elfinFlee'; reason: 'nell' | 'fever' | 'butter' }
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
