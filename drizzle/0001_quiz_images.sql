CREATE TABLE "quiz_images" (
	"activity_id" text NOT NULL,
	"question" integer NOT NULL,
	"mime" text NOT NULL,
	"data" text NOT NULL,
	CONSTRAINT "quiz_images_activity_id_question_pk" PRIMARY KEY("activity_id","question")
);
--> statement-breakpoint
ALTER TABLE "quiz_images" ADD CONSTRAINT "quiz_images_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;