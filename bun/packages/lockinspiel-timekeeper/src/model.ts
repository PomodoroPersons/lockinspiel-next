import { t } from "elysia";

export const Timer = t.Object({
  time_split: t.Integer(),
  start_timestamp: t.Integer(),
  end_timestamp: t.Integer(),
  work: t.Boolean(),
  tags: t.Array(t.Integer()),
  name: t.String(),
});

export const TimerWID = t.Object({
  id: t.Integer(),
  ...Timer.properties,
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

export const TimeSplit = t.Object({
  name: t.String(),
  description: t.Nullable(t.String()),
  deleted: t.Boolean(),
  timers: t.Array(TimeSplitTimer),
});

export const TimeSplitWID = t.Object({
  id: t.Integer(),
  ...TimeSplit.properties,
});

export const model = {
  Timer: Timer,
  TimerWID: TimerWID,
  Tag: Tag,
  TagWID: TagWID,
  TimeSplitTimer: TimeSplitTimer,
  TimeSplit: TimeSplit,
  TimeSplitWID: TimeSplitWID,
};
