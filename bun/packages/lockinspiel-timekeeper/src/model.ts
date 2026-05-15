import { t, TSchema } from "elysia";

export const InsertableTimer = t.Object({
  time_split_timer: t.Integer(),
  start_time: t.Date(),
  end_time: t.Date(),
  tags: t.Array(t.Integer()),
});

export const Timer = t.Object({
  time_split: t.Integer(),
  work: t.Boolean(),
  ...InsertableTimer.properties,
});

export const Tag = t.Object({
  name: t.String(),
});

export const TagWID = t.Object({
  id: t.Integer(),
  ...Tag.properties,
});

export const TimeSplitTimer = t.Object({
  len: t.Integer(),
  name: t.String(),
  work: t.Boolean(),
});

export const TimeSplitTimerWOrder = t.Object({
  order_idx: t.Integer(),
  ...TimeSplitTimer.properties,
});

export const TimeSplitTimerWID = t.Object({
  id: t.Integer(),
  ...TimeSplitTimerWOrder.properties,
});

export const TimeSplitNoTimers = t.Object({
  name: t.String(),
  description: t.Nullable(t.String()),
});

export const TimeSplit = <Type extends TSchema>(timers: Type) =>
  t.Object({
    timers: t.Array(timers),
    ...TimeSplitNoTimers.properties,
  });

export const TimeSplitWID = t.Object({
  id: t.Integer(),
  ...TimeSplit(TimeSplitTimerWID).properties,
});

export const model = {
  Timer: Timer,
  InsertableTimer: InsertableTimer,
  Tag: Tag,
  TagWID: TagWID,
  TimeSplitTimer: TimeSplitTimer,
  TimeSplitTimerWOrder: TimeSplitTimerWOrder,
  TimeSplitTimerWID: TimeSplitTimerWID,
  TimeSplitNoTimers: TimeSplitNoTimers,
  TimeSplit: TimeSplit(TimeSplitTimer),
  TimeSplitWID: TimeSplitWID,
};
