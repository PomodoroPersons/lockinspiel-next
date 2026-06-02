import { t, TSchema } from "elysia";

export const InsertableTimer = t.Object({
  time_split_timer: t.Integer(),
  start_time: t.Date(),
  end_time: t.Date(),
  tags: t.Array(t.Integer()),
});

export const Timer = t.Composite([
  t.Object({
    time_split: t.Integer(),
    work: t.Boolean(),
  }),
  InsertableTimer
]);

export const Tag = t.Object({
  name: t.String(),
});

export const TagWID = t.Composite([
  t.Object({
    id: t.Integer(),
  }),
  Tag,
]);

export const TimeSplitTimer = t.Object({
  len: t.Integer(),
  name: t.String(),
  work: t.Boolean(),
});

export const TimeSplitTimerWOrder = t.Composite([
  t.Object({
    order_idx: t.Integer(),
  }),
  TimeSplitTimer
]);

export const TimeSplitTimerWID = t.Composite([
  t.Object({
    id: t.Integer(),
  }),
  TimeSplitTimerWOrder
]);

export const TimeSplitNoTimers = t.Object({
  name: t.String(),
  description: t.Nullable(t.String()),
});

export const TimeSplit = <Type extends TSchema, Types extends TSchema[]>(timers: Type, ...otherTypes: Types) =>
  t.Composite([
    t.Object({
      timers: t.Array(timers),
    }),
    TimeSplitNoTimers,
    ...otherTypes
  ]);

export const model = {
  InsertableTimer: InsertableTimer,
  Timer: Timer,
  Tag: Tag,
  TagWID: TagWID,
  TimeSplitTimer: TimeSplitTimer,
  TimeSplitTimerWOrder: TimeSplitTimerWOrder,
  TimeSplitTimerWID: TimeSplitTimerWID,
  TimeSplitNoTimers: TimeSplitNoTimers,
  TimeSplit: TimeSplit(TimeSplitTimer),
  TimeSplitWID: TimeSplit(TimeSplitTimerWID, t.Object({
    id: t.Integer(),
  })),
};

console.dir(model, { depth: null })
