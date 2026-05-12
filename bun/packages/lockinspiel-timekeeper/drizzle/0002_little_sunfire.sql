CREATE TABLE "timekeeper.tag" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "timekeeper.tag_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar NOT NULL,
	"user_id" uuid,
	"deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "timekeeper.tag_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "timekeeper.time_split" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "timekeeper.time_split_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar NOT NULL,
	"desc" varchar,
	"deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timekeeper.time_split_timer" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "timekeeper.time_split_timer_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"time_split_id" integer NOT NULL,
	"len" interval NOT NULL,
	"name" varchar NOT NULL,
	"work" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timekeeper.timesheet_group" (
	"id" uuid PRIMARY KEY DEFAULT 'generate_uuidv7()' NOT NULL,
	"time_split_id" integer NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timekeeper.timesheet" (
	"timesheet_group" uuid NOT NULL,
	"start_time" timestamp with time zone PRIMARY KEY NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"user_id" uuid NOT NULL,
	"work" boolean NOT NULL,
	"time_split_timer" integer NOT NULL,
	CONSTRAINT "timekeeper.timesheet_start_time_end_time_unique" UNIQUE("start_time","end_time")
);
--> statement-breakpoint
CREATE TABLE "timekeeper.timesheet_tag" (
	"timesheet_group" uuid NOT NULL,
	"tag_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "timekeeper.timesheet_tag_timesheet_group_tag_id_pk" PRIMARY KEY("timesheet_group","tag_id")
);
--> statement-breakpoint
CREATE TABLE "auth.users" (
	"user_id" uuid PRIMARY KEY DEFAULT 'generate_uuidv7()' NOT NULL,
	"username" varchar NOT NULL,
	"role" varchar DEFAULT 'user' NOT NULL,
	CONSTRAINT "auth.users_username_unique" UNIQUE("username")
);
