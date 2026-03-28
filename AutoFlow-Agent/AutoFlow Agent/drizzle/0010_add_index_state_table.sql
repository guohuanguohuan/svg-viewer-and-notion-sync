CREATE TABLE "index_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"path" text NOT NULL,
	"model" text NOT NULL,
	"dimension" smallint NOT NULL,
	"file_mtime" bigint NOT NULL,
	"file_size" bigint NOT NULL,
	"content_hash" text NOT NULL,
	"config_hash" text NOT NULL,
	"chunk_count" integer NOT NULL,
	"indexed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "index_state_path_index" ON "index_state" USING btree ("path");--> statement-breakpoint
CREATE INDEX "index_state_model_index" ON "index_state" USING btree ("model");--> statement-breakpoint
CREATE UNIQUE INDEX "index_state_path_model_unique" ON "index_state" USING btree ("path","model");