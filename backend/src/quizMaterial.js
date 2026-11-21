const { z } = require("zod");
const { generateAnswer } = require("./gemini");

const questionSchema = z.object({
  question: z.string().trim().min(1).max(5000),
  options: z.array(z.string().trim().min(1).max(1000)).length(4),
  correctOptionIndex: z.number().int().min(0).max(3),
  points: z.number().int().min(1).max(100),
});

const draftSchema = z.object({
  questions: z.array(questionSchema).min(1).max(5),
});

async function generateQuizMaterial(lessons) {
  const answer = await generateAnswer(
    'Create up to 5 multiple-choice questions using only the supplied lessons. ' +
    'Each question must have 4 distinct options and exactly one correct answer. ' +
    'Use correctOptionIndex from 0 to 3 and points: 1. ' +
    'Return only valid JSON without Markdown fences: ' +
    '{"questions":[{"question":"text","options":["a","b","c","d"],' +
    '"correctOptionIndex":0,"points":1}]}',
    lessons.map((lesson) => ({
      lecture_title: lesson.title,
      content: lesson.transcript,
    }))
  );

  const json = answer.trim()
    .replace(/^(?:json)?\s*/i, "")
    .replace(/\s*$/, "");

  return draftSchema.parse(JSON.parse(json));
}

module.exports = { generateQuizMaterial };