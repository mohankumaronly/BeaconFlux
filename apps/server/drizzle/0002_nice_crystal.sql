ALTER TABLE "chats" ADD COLUMN "pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "chats" ADD COLUMN "pinned_at" timestamp with time zone;