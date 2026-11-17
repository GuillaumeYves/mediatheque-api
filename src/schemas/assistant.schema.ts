import { z } from "zod";

export const MAX_QUESTION_LENGTH = 500;

export const questionSchema = z
  .object({
    question: z.string().trim().min(1).max(MAX_QUESTION_LENGTH),
  })
  .meta({ id: "QuestionAssistant" });

export type QuestionInput = z.output<typeof questionSchema>;
