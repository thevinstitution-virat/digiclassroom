CREATE TABLE "books" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"title" varchar(500) NOT NULL,
	"legacy_book_title" varchar(500) NOT NULL,
	"qdrant_collection" varchar(100) DEFAULT 'ncert-books-enhanced' NOT NULL,
	"organization_id" varchar(255),
	"taxonomy_node_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "books_legacy_title_org_idx" ON "books" USING btree ("legacy_book_title","organization_id");--> statement-breakpoint
CREATE INDEX "books_organization_idx" ON "books" USING btree ("organization_id");