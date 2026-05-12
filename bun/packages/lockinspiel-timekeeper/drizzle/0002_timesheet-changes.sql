DROP TABLE "timekeeper"."timesheet_group" CASCADE;--> statement-breakpoint
DROP TABLE "timekeeper"."timesheet_tag" CASCADE;--> statement-breakpoint

ALTER TABLE "timekeeper"."timesheet" DROP CONSTRAINT "timesheet_pk";--> statement-breakpoint
ALTER TABLE "timekeeper"."timesheet" ADD COLUMN "tags" jsonb NOT NULL DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "timekeeper"."timesheet" DROP COLUMN "timesheet_group";