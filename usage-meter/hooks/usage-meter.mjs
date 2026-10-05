// Usage Meter: 週間使用量と5時間使用量を、プロンプトの上に常時表示する。
//
// 各枠を必ず1行で表示（改行しない）。書式：
//   週間  ████░░░░░░░░  41%  経過 56%  リセットまで 3日10時間   文脈 34%
//   5時間 ██████░░░░░░  83%  経過 40%  リセットまで 3時間0分
// 「経過」＝前回リセットから次のリセットまでの期間のうち、いま何%進んだか。
//   使用% が 経過% より小さければ、時間の進みより使用が少ない（余裕あり）。
// 幅が足りないときは 文脈 → 「リセットまで」を「残り」 の順に削ってバーを確保し、折り返さない。
// 数字は $.session.usage() の rateLimits。更新は session.start / turn.complete / 60秒ごと。
// 契約プランでない場合や最初の応答前は rateLimits が空で、「取得待ち」と出す。

const REFRESH_MS = 60_000;
const WINDOW_MS = { seven_day: 7 * 24 * 3600_000, five_hour: 5 * 3600_000 };
const BAR_MAX = { seven_day: 24, five_hour: 14 };
const BAR_MIN = 6;

let limits = [];
let context = null;
let nowMs = 0;
let started = false;

export function register(on) {
  on("session.start", async ($, e, next) => {
    const result = await next(e);
    await refresh($);
    if (!started) {
      started = true;
      $.clock.every(REFRESH_MS, () => refresh($));
    }
    return result;
  });

  on("turn.complete", async ($, e, next) => {
    const result = await next(e);
    if (e.agentId) {
      return result;
    }
    await refresh($);
    return result;
  });

  on("ui.render", { component: "AbovePrompt" }, ($, e, next) => {
    if (e.hasSurvey) {
      return next(e);
    }
    const { Box, Text } = $.ui.resolve(e);
    const avail = (e.bodyColumns ?? 80) - 2;
    return Box({
      flexDirection: "column",
      paddingX: 1,
      children: [
        row(Box, Text, "週間  ", "seven_day", avail, true),
        row(Box, Text, "5時間 ", "five_hour", avail, false),
      ],
    });
  });
}

async function refresh($) {
  try {
    const u = await $.session.usage();
    limits = u.rateLimits ?? [];
    context = u.context ?? null;
    nowMs = await $.clock.now();
    $.ui.invalidate("ui.render");
  } catch {
    // 今回は更新なし。前の値のまま表示を続ける。
  }
}

// 表示幅：全角・かな・漢字は2、それ以外は1。
function width(s) {
  let w = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    w += c >= 0x1100 && (c <= 0x115f || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xff00 && c <= 0xff60)) ? 2 : 1;
  }
  return w;
}

function row(Box, Text, label, kind, avail, main) {
  const limit = limits.find((l) => l.kind === kind);
  if (!limit) {
    return Box({
      flexDirection: "row",
      children: [
        Text({ bold: main, children: label }),
        Text({ dimColor: true, children: "取得待ち" }),
      ],
    });
  }
  const pct = Math.max(0, Math.min(100, limit.percentUsed));
  const color = colorFor(pct);
  const pctText = ` ${String(Math.round(pct)).padStart(3)}%`;
  const elapsed = elapsedPct(limit, kind);
  const left = remaining(limit.resetsAt);
  const ctxPct = main && context && context.window
    ? Math.round(context.percent ?? ((context.tokens ?? 0) / context.window) * 100)
    : null;

  // 幅が足りなければ、文脈 → 「残り」表記 の順に削る。
  const variants = [
    { ctx: true, word: "リセットまで" },
    { ctx: false, word: "リセットまで" },
    { ctx: false, word: "残り" },
  ];
  let pick = variants[variants.length - 1];
  let barWidth = BAR_MIN;
  for (const v of variants) {
    const tail = tailText(elapsed, v.word, left, v.ctx && ctxPct != null ? ctxPct : null);
    const room = avail - width(label) - width(pctText) - width(tail);
    if (room >= BAR_MIN + 2 || v === variants[variants.length - 1]) {
      pick = v;
      barWidth = Math.max(BAR_MIN, Math.min(BAR_MAX[kind] ?? 14, room));
      break;
    }
  }
  const filled = Math.round((pct / 100) * barWidth);
  const children = [
    Text({ bold: main, children: label }),
    Text({ color, bold: main, children: "█".repeat(filled) }),
    Text({ dimColor: true, children: "░".repeat(barWidth - filled) }),
    Text({ color, bold: true, children: pctText }),
  ];
  if (elapsed != null) {
    children.push(Text({ dimColor: true, children: "  経過 " }));
    children.push(Text({ children: `${elapsed}%` }));
  }
  children.push(Text({ dimColor: true, children: `  ${pick.word} ${left}` }));
  if (pick.ctx && ctxPct != null) {
    children.push(Text({ dimColor: true, children: `   文脈 ${ctxPct}%` }));
  }
  return Box({ flexDirection: "row", children });
}

// バーの右側に並ぶ文字列（幅の見積り用）。
function tailText(elapsed, word, left, ctxPct) {
  return (elapsed != null ? `  経過 ${elapsed}%` : "") + `  ${word} ${left}` + (ctxPct != null ? `   文脈 ${ctxPct}%` : "");
}

// 前回リセット〜次回リセットのうち、いま何%進んだか。
function elapsedPct(limit, kind) {
  const win = WINDOW_MS[kind];
  if (!win || !limit.resetsAt || !nowMs) return null;
  const leftMs = Date.parse(limit.resetsAt) - nowMs;
  if (Number.isNaN(leftMs)) return null;
  return Math.max(0, Math.min(100, Math.round(((win - leftMs) / win) * 100)));
}

function colorFor(pct) {
  if (pct >= 90) return "red";
  if (pct >= 70) return "yellow";
  return "green";
}

function remaining(iso) {
  if (!iso || !nowMs) return "—";
  const ms = Date.parse(iso) - nowMs;
  if (!(ms > 0)) return "まもなく";
  const min = Math.floor(ms / 60_000);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return `${d}日${h}時間`;
  if (h > 0) return `${h}時間${m}分`;
  return `${m}分`;
}